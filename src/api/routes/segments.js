'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSalesforceConnection, getWorkerConnection, queryRecords, describeObject } = require('../services/salesforce');

router.use(requireAuth);

/**
 * GET /api/segments
 *
 * Fetches available segments from the connected Salesforce org.
 * Returns: Data Cloud Segments, Campaigns, List Views, and Reports
 * that can be used as journey entry audiences.
 */
router.get('/', async (req, res) => {
  try {
    const hasUserOAuth = req.sfOauthToken && req.sfInstanceUrl;
    const hasWorkerAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET;

    if (!hasUserOAuth && !hasWorkerAuth) {
      return res.json({
        connected: false,
        segments: [
          { id: 'contact-all', name: 'All Contacts', type: 'object', object: 'Contact', count: null },
          { id: 'lead-all', name: 'All Leads', type: 'object', object: 'Lead', count: null },
        ],
        message: 'Salesforce not connected. Click "Connect to Salesforce" to fetch live segments.',
      });
    }

    let conn;
    if (hasUserOAuth) {
      console.log('[Segments] Using per-user OAuth token');
      conn = getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl);
    } else {
      console.log('[Segments] Using worker connection (client credentials)');
      conn = await getWorkerConnection();
    }

    // ── Fetch Data Cloud Segments (Segment objects) ──
    let dataCloudSegments = [];
    try {
      dataCloudSegments = await queryRecords(
        conn,
        `SELECT Id, Name, SegmentStatus, Description, SegmentType, LastCalculatedDate
         FROM Segment
         WHERE SegmentStatus = 'Published'
         ORDER BY LastModifiedDate DESC
         LIMIT 50`
      );
    } catch (dcErr) {
      // Data Cloud may not be enabled — that's ok
      console.log('[Segments] Data Cloud segments not available:', dcErr.message);
    }

    // ── Fetch Campaigns ──
    const campaigns = await queryRecords(
      conn,
      `SELECT Id, Name, Type, Status, NumberOfContacts, NumberOfLeads, StartDate, EndDate
       FROM Campaign
       WHERE IsActive = true
       ORDER BY LastModifiedDate DESC
       LIMIT 50`
    );

    // ── Fetch Contact List Views ──
    let contactListViews = [];
    try {
      const lvResult = await conn.request(`/services/data/v62.0/sobjects/Contact/listviews`);
      contactListViews = (lvResult.listviews || []).slice(0, 20).map((lv) => ({
        id: lv.id,
        name: lv.label || lv.developerName,
        soqlCompatible: lv.soqlCompatible,
      }));
    } catch (lvErr) {
      console.log('[Segments] Could not fetch Contact list views:', lvErr.message);
    }

    // ── Fetch Lead List Views ──
    let leadListViews = [];
    try {
      const lvResult = await conn.request(`/services/data/v62.0/sobjects/Lead/listviews`);
      leadListViews = (lvResult.listviews || []).slice(0, 20).map((lv) => ({
        id: lv.id,
        name: lv.label || lv.developerName,
        soqlCompatible: lv.soqlCompatible,
      }));
    } catch (lvErr) {
      console.log('[Segments] Could not fetch Lead list views:', lvErr.message);
    }

    // ── Fetch Reports ──
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
      console.warn('[Segments] Could not fetch reports:', reportErr.message);
    }

    // Build unified segment list
    const segments = [];

    // Data Cloud segments first (highest value)
    for (const s of dataCloudSegments) {
      segments.push({
        id: s.Id,
        name: s.Name,
        type: 'data_cloud_segment',
        object: 'Segment',
        status: s.SegmentStatus,
        segmentType: s.SegmentType,
        description: s.Description,
        lastCalculated: s.LastCalculatedDate,
      });
    }

    // Standard object options
    segments.push(
      { id: 'contact-all', name: 'All Contacts', type: 'object', object: 'Contact', count: null },
      { id: 'lead-all', name: 'All Leads', type: 'object', object: 'Lead', count: null }
    );

    // Contact list views
    for (const lv of contactListViews) {
      segments.push({
        id: lv.id,
        name: lv.name,
        type: 'listview',
        object: 'Contact',
      });
    }

    // Lead list views
    for (const lv of leadListViews) {
      segments.push({
        id: lv.id,
        name: lv.name,
        type: 'listview',
        object: 'Lead',
      });
    }

    // Campaigns
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

    // Reports
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
      totalDataCloudSegments: dataCloudSegments.length,
      totalCampaigns: campaigns.length,
      totalListViews: contactListViews.length + leadListViews.length,
      totalReports: reports.length,
    });
  } catch (err) {
    console.error('[Segments] Error fetching segments:', err.message);

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
