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

    // Extract relevant picklist fields
    const picklistFields = {};
    const interestingFields = ['Type', 'Status', 'BusinessUnit__c', 'Business_Unit__c', 'BU__c'];

    for (const f of fields) {
      // Include standard picklist fields and any field with "business" or "unit" in the name
      const isInteresting = interestingFields.includes(f.name) ||
        (f.name.toLowerCase().includes('business') && f.type === 'picklist') ||
        (f.name.toLowerCase().includes('unit') && f.type === 'picklist') ||
        f.name === 'Type' || f.name === 'Status';

      if (isInteresting && f.picklistValues && f.picklistValues.length > 0) {
        picklistFields[f.name] = {
          label: f.label,
          name: f.name,
          values: f.picklistValues
            .filter(pv => pv.active !== false)
            .map(pv => ({ label: pv.label, value: pv.value })),
        };
      }
    }

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
    const { name, type, status, businessUnit } = req.body;

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

    // Add business unit field if provided (detect the actual field name)
    if (businessUnit) {
      // Try common field names for Business Unit
      const fields = await describeObject(conn, 'Campaign');
      const buField = fields.find(f =>
        f.name === 'BusinessUnit__c' ||
        f.name === 'Business_Unit__c' ||
        f.name === 'BU__c' ||
        (f.label.toLowerCase().includes('business unit') && f.type === 'picklist')
      );
      if (buField) {
        campaignData[buField.name] = businessUnit;
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
        businessUnit: businessUnit || null,
      },
    });
  } catch (err) {
    console.error('[Campaigns] Error creating campaign:', err.message);
    res.status(500).json({ error: `Failed to create campaign: ${err.message}` });
  }
});

module.exports = router;
