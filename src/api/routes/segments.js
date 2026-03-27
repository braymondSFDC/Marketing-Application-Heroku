'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSalesforceConnection, getWorkerConnection, queryRecords } = require('../services/salesforce');

router.use(requireAuth);

/**
 * GET /api/segments
 *
 * Fetches available segments from the connected Salesforce org.
 * Returns Campaigns, Contact List Views, and Lead List Views
 * that can be used as journey entry audiences.
 *
 * Uses per-user OAuth tokens when the user has connected via Salesforce OAuth.
 * Falls back to worker connection (client credentials) if OAuth not available.
 * Returns static fallback data if no SF connection is configured at all.
 */
router.get('/', async (req, res) => {
  try {
    // Priority 1: Per-user OAuth tokens (user authenticated via OAuth flow)
    // Priority 2: Worker connection (client credentials from env vars)
    // Priority 3: Static fallback data
    const hasUserOAuth = req.sfOauthToken && req.sfInstanceUrl;
    const hasWorkerAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET;

    if (!hasUserOAuth && !hasWorkerAuth) {
      // Return static fallback segments for standalone/demo mode
      return res.json({
        connected: false,
        segments: [
          { id: 'contact-all', name: 'All Contacts', type: 'object', object: 'Contact', count: null },
          { id: 'lead-all', name: 'All Leads', type: 'object', object: 'Lead', count: null },
        ],
        message: 'Salesforce not connected. Click "Connect to Salesforce" to fetch live segments.',
      });
    }

    // Get connection: prefer per-user OAuth, fall back to worker
    let conn;
    if (hasUserOAuth) {
      console.log('[Segments] Using per-user OAuth token');
      conn = getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl);
    } else {
      console.log('[Segments] Using worker connection (client credentials)');
      conn = await getWorkerConnection();
    }

    // Fetch Campaigns (most common segment source for marketing journeys)
    const campaigns = await queryRecords(
      conn,
      `SELECT Id, Name, Type, Status, NumberOfContacts, NumberOfLeads, StartDate, EndDate
       FROM Campaign
       WHERE IsActive = true
       ORDER BY LastModifiedDate DESC
       LIMIT 50`
    );

    // Fetch Reports that are Contact/Lead focused (potential segments)
    let reports = [];
    try {
      reports = await queryRecords(
        conn,
        `SELECT Id, Name, Description, FolderName, LastRunDate
         FROM Report
         WHERE Format = 'TABULAR'
         ORDER BY LastRunDate DESC NULLS LAST
         LIMIT 30`
      );
    } catch (reportErr) {
      // Report querying may fail if permissions are limited — that's ok
      console.warn('[Segments] Could not fetch reports:', reportErr.message);
    }

    // Build unified segment list
    const segments = [];

    // Add standard object options
    segments.push(
      { id: 'contact-all', name: 'All Contacts', type: 'object', object: 'Contact', count: null },
      { id: 'lead-all', name: 'All Leads', type: 'object', object: 'Lead', count: null }
    );

    // Add campaigns
    for (const c of campaigns) {
      segments.push({
        id: c.Id,
        name: c.Name,
        type: 'campaign',
        object: 'Campaign',
        status: c.Status,
        campaignType: c.Type,
        memberCount: (c.NumberOfContacts || 0) + (c.NumberOfLeads || 0),
        startDate: c.StartDate,
        endDate: c.EndDate,
      });
    }

    // Add reports
    for (const r of reports) {
      segments.push({
        id: r.Id,
        name: r.Name,
        type: 'report',
        object: 'Report',
        folder: r.FolderName,
        lastRunDate: r.LastRunDate,
        description: r.Description,
      });
    }

    res.json({
      connected: true,
      segments,
      totalCampaigns: campaigns.length,
      totalReports: reports.length,
    });
  } catch (err) {
    console.error('[Segments] Error fetching segments:', err.message);

    // If Salesforce connection fails, still return fallback
    res.json({
      connected: false,
      segments: [
        { id: 'contact-all', name: 'All Contacts', type: 'object', object: 'Contact', count: null },
        { id: 'lead-all', name: 'All Leads', type: 'object', object: 'Lead', count: null },
      ],
      message: `Could not connect to Salesforce: ${err.message}`,
    });
  }
});

module.exports = router;
