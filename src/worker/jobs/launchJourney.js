'use strict';

const db = require('../../../db');
const { getSalesforceConnection, publishPlatformEventsBatch } = require('../../api/services/salesforce');
const { createCampaign, populateCampaignMembers } = require('../../api/services/campaignService');
const { uploadAllTemplates } = require('../../api/services/templateService');
const { deployFlow, activateFlow } = require('../../api/services/deployService');
const { Redis } = require('ioredis');

/**
 * Process the "One-Click Launch" orchestration sequence.
 *
 * Steps:
 *   1. Create Campaign record in Salesforce
 *   2. Upload Email Templates for each email node
 *   3. Generate Flow XML and deploy via Metadata API
 *   4. Activate the deployed Flow
 *   5. Populate Campaign Members from segment
 *   6. Publish Platform Events to trigger the Flow
 *   7. Post launch summary to Chatter
 */
async function processLaunchJob(job) {
  const {
    journeyId,
    journey,
    nodes,
    edges,
    sfOauthToken,
    sfInstanceUrl,
    sfOrgId,
  } = job.data;

  const conn = getSalesforceConnection(sfOauthToken, sfInstanceUrl);
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const notify = (status, step, detail) => {
    redis.publish(
      `journey:${journeyId}`,
      JSON.stringify({ type: 'launch_progress', status, step, detail, timestamp: new Date().toISOString() })
    );
  };

  try {
    // ─── Step 1: Create Campaign ───────────────────────────────────
    notify('in_progress', 1, 'Creating Campaign record...');
    await logStep(journeyId, 'create_campaign', 'pending');

    const campaignId = await createCampaign(conn, { ...journey, id: journeyId });

    await db.query(
      'UPDATE journeys SET sf_campaign_id = $1 WHERE id = $2',
      [campaignId, journeyId]
    );
    await logStep(journeyId, 'create_campaign', 'success', campaignId);
    await job.updateProgress(15);

    // ─── Step 2: Upload Email Templates ────────────────────────────
    const emailNodes = nodes.filter((n) => n.node_type === 'email');

    if (emailNodes.length > 0) {
      notify('in_progress', 2, `Uploading ${emailNodes.length} email template(s)...`);
      await logStep(journeyId, 'upload_templates', 'pending');

      var templateMap = await uploadAllTemplates(conn, journeyId, emailNodes);
      await logStep(journeyId, 'upload_templates', 'success');
    } else {
      var templateMap = {};
    }
    await job.updateProgress(30);

    // ─── Step 3: Generate & Deploy Flow ────────────────────────────
    notify('in_progress', 3, 'Generating and deploying Salesforce Flow...');
    await logStep(journeyId, 'deploy_flow', 'pending');

    const deployResult = await deployFlow(conn, { ...journey, id: journeyId }, nodes, edges, templateMap);
    await logStep(journeyId, 'deploy_flow', 'success');
    await job.updateProgress(55);

    // ─── Step 4: Activate Flow ─────────────────────────────────────
    notify('in_progress', 4, 'Activating Flow...');
    await logStep(journeyId, 'activate_flow', 'pending');

    await activateFlow(conn, deployResult.flowApiName);
    await logStep(journeyId, 'activate_flow', 'success');
    await job.updateProgress(70);

    // ─── Step 5: Populate Campaign Members ─────────────────────────
    if (journey.segment_object && journey.segment_filter) {
      notify('in_progress', 5, 'Populating Campaign Members...');
      await logStep(journeyId, 'populate_members', 'pending');

      const memberResult = await populateCampaignMembers(
        conn,
        campaignId,
        journey.segment_object,
        journey.segment_filter
      );
      await logStep(journeyId, 'populate_members', 'success');
      notify('in_progress', 5, `Added ${memberResult.count} Campaign Members`);
    }
    await job.updateProgress(85);

    // ─── Step 6: Publish Platform Events ───────────────────────────
    if (journey.segment_object) {
      notify('in_progress', 6, 'Publishing Platform Events to trigger Flow...');
      await logStep(journeyId, 'publish_events', 'pending');

      // Query segment members for Platform Event payload
      const memberQuery = journey.segment_object === 'Lead'
        ? `SELECT Id, Email, FirstName, LastName FROM Lead LIMIT 50000`
        : `SELECT Id, Email, FirstName, LastName FROM Contact LIMIT 50000`;

      const members = await conn.query(memberQuery);

      if (members.records && members.records.length > 0) {
        const events = members.records.map((m) => ({
          Email__c: m.Email,
          FirstName__c: m.FirstName,
          LastName__c: m.LastName,
          ContactId__c: journey.segment_object === 'Contact' ? m.Id : null,
          LeadId__c: journey.segment_object === 'Lead' ? m.Id : null,
          JourneyId__c: journeyId,
          CampaignId__c: campaignId,
        }));

        await publishPlatformEventsBatch(conn, 'Journey_Entry__e', events);
      }

      await logStep(journeyId, 'publish_events', 'success');
    }
    await job.updateProgress(95);

    // ─── Step 7: Post to Chatter ───────────────────────────────────
    try {
      await conn.chatter.resource('/feed-elements').create({
        body: {
          messageSegments: [
            {
              type: 'Text',
              text: `🚀 Journey "${journey.name}" has been launched! Campaign: ${campaignId}`,
            },
          ],
        },
        feedElementType: 'FeedItem',
        subjectId: campaignId,
      });
    } catch (chatterErr) {
      console.warn('[Launch] Chatter post failed (non-fatal):', chatterErr.message);
    }

    // ─── Finalize ──────────────────────────────────────────────────
    await db.query(
      "UPDATE journeys SET status = 'active', updated_at = NOW() WHERE id = $1",
      [journeyId]
    );

    notify('completed', 7, 'Journey launched successfully!');
    await job.updateProgress(100);

    redis.quit();
    return { success: true, campaignId, flowApiName: deployResult.flowApiName };
  } catch (err) {
    console.error(`[Launch] Job failed for journey ${journeyId}:`, err.message);

    await db.query(
      "UPDATE journeys SET status = 'failed', updated_at = NOW() WHERE id = $1",
      [journeyId]
    );

    await logStep(journeyId, 'launch_failed', 'failed', null, err.message);
    notify('failed', 0, err.message);

    redis.quit();
    throw err;
  }
}

async function logStep(journeyId, action, status, sfResourceId = null, errorMessage = null) {
  await db.query(
    `INSERT INTO deployment_logs (journey_id, action, status, sf_resource_id, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [journeyId, action, status, sfResourceId, errorMessage]
  );
}

module.exports = { processLaunchJob };
