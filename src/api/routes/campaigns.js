'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSalesforceConnection, getWorkerConnection, createRecord, queryRecords, describeObject } = require('../services/salesforce');

router.use(requireAuth);

/**
 * Helper to get a Salesforce connection from request
 */
function getConnection(req) {
  const hasUserOAuth = req.sfOauthToken && req.sfInstanceUrl;
  const hasWorkerAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET;

  if (!hasUserOAuth && !hasWorkerAuth) return null;

  if (hasUserOAuth) {
    return { conn: getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl), connected: true };
  }
  return { connPromise: getWorkerConnection(), connected: true };
}

/**
 * GET /api/campaigns
 */
router.get('/', async (req, res) => {
  try {
    const connInfo = getConnection(req);
    if (!connInfo) return res.json({ campaigns: [], connected: false });

    const conn = connInfo.conn || await connInfo.connPromise;

    const campaigns = await queryRecords(
      conn,
      `SELECT Id, Name, Type, Status, NumberOfContacts, NumberOfLeads, StartDate, EndDate
       FROM Campaign
       WHERE IsActive = true
       ORDER BY LastModifiedDate DESC
       LIMIT 50`
    );

    res.json({
      campaigns: campaigns.map((c) => ({
        id: c.Id,
        name: c.Name,
        type: c.Type,
        status: c.Status,
        memberCount: (c.NumberOfContacts || 0) + (c.NumberOfLeads || 0),
        startDate: c.StartDate,
        endDate: c.EndDate,
      })),
      connected: true,
    });
  } catch (err) {
    console.error('[Campaigns] Error fetching campaigns:', err.message);
    res.json({ campaigns: [], connected: false, error: err.message });
  }
});

/**
 * GET /api/campaigns/metadata
 *
 * Returns picklist values for Campaign fields (Type, Status, Business Unit, etc.)
 * Used by the CampaignPicker to populate creation form dropdowns.
 */
router.get('/metadata', async (req, res) => {
  try {
    const connInfo = getConnection(req);
    if (!connInfo) {
      return res.json({ connected: false, fields: {} });
    }

    const conn = connInfo.conn || await connInfo.connPromise;
    const fields = await describeObject(conn, 'Campaign');

    // Extract ALL picklist fields — include standard ones (Type, Status)
    // and ALL custom picklist fields (catches any Business Unit variant)
    const picklistFields = {};

    for (const f of fields) {
      const isStandardPicklist = (f.name === 'Type' || f.name === 'Status') && f.type === 'picklist';
      const isCustomPicklist = f.custom && f.type === 'picklist';

      if ((isStandardPicklist || isCustomPicklist) && f.picklistValues && f.picklistValues.length > 0) {
        picklistFields[f.name] = {
          label: f.label,
          name: f.name,
          custom: f.custom || false,
          values: f.picklistValues
            .filter(pv => pv.active !== false)
            .map(pv => ({ label: pv.label, value: pv.value })),
        };
      }
    }

    console.log('[Campaigns] Metadata fields found:', Object.keys(picklistFields).join(', '));
    res.json({ connected: true, fields: picklistFields });
  } catch (err) {
    console.error('[Campaigns] Error fetching metadata:', err.message);
    res.json({ connected: false, fields: {}, error: err.message });
  }
});

/**
 * POST /api/campaigns
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, status, customFields } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const connInfo = getConnection(req);
    if (!connInfo) {
      return res.status(400).json({ error: 'Not connected to Salesforce. Connect first to create campaigns.' });
    }

    const conn = connInfo.conn || await connInfo.connPromise;

    // Build campaign record
    const campaignData = {
      Name: name,
      Type: type || null,
      Status: status || 'Planned',
      IsActive: true,
    };

    // Add any custom picklist field values (Business Unit, Region, etc.)
    if (customFields && typeof customFields === 'object') {
      for (const [fieldName, value] of Object.entries(customFields)) {
        if (value && fieldName.endsWith('__c')) {
          campaignData[fieldName] = value;
        }
      }
    }

    const result = await createRecord(conn, 'Campaign', campaignData);

    if (!result.success) {
      throw new Error(result.errors?.join(', ') || 'Failed to create campaign');
    }

    res.status(201).json({
      campaign: {
        id: result.id,
        name,
        type: type || null,
        status: status || 'Planned',
      },
    });
  } catch (err) {
    console.error('[Campaigns] Error creating campaign:', err.message);
    res.status(500).json({ error: `Failed to create campaign: ${err.message}` });
  }
});

module.exports = router;
