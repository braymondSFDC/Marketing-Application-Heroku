'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSalesforceConnection, getWorkerConnection, createRecord, queryRecords } = require('../services/salesforce');

router.use(requireAuth);

/**
 * GET /api/campaigns
 *
 * Fetches active campaigns from the connected Salesforce org.
 * Uses per-user OAuth when available, falls back to worker connection.
 */
router.get('/', async (req, res) => {
  try {
    const hasUserOAuth = req.sfOauthToken && req.sfInstanceUrl;
    const hasWorkerAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET;

    if (!hasUserOAuth && !hasWorkerAuth) {
      return res.json({ campaigns: [], connected: false });
    }

    let conn;
    if (hasUserOAuth) {
      conn = getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl);
    } else {
      conn = await getWorkerConnection();
    }

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
 * POST /api/campaigns
 *
 * Creates a new Campaign in the connected Salesforce org.
 * Returns the newly created campaign record.
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const hasUserOAuth = req.sfOauthToken && req.sfInstanceUrl;
    const hasWorkerAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET;

    if (!hasUserOAuth && !hasWorkerAuth) {
      return res.status(400).json({ error: 'Not connected to Salesforce. Connect first to create campaigns.' });
    }

    let conn;
    if (hasUserOAuth) {
      conn = getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl);
    } else {
      conn = await getWorkerConnection();
    }

    const result = await createRecord(conn, 'Campaign', {
      Name: name,
      Type: type || null,
      Status: status || 'Planned',
      IsActive: true,
    });

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
