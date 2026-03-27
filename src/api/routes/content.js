'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getSalesforceConnection, getWorkerConnection, queryRecords } = require('../services/salesforce');

router.use(requireAuth);

/**
 * GET /api/content
 *
 * Fetches published Email and SMS content from Salesforce CMS.
 * Queries EmailTemplate, EmailMessage-related objects, and CMS content.
 * Returns content items that can be used in Email/SMS journey nodes.
 *
 * Query params:
 *   type — 'email' | 'sms' | 'all' (default: 'all')
 */
router.get('/', async (req, res) => {
  try {
    const hasUserOAuth = req.sfOauthToken && req.sfInstanceUrl;
    const hasWorkerAuth = process.env.SF_CLIENT_ID && process.env.SF_CLIENT_SECRET;

    if (!hasUserOAuth && !hasWorkerAuth) {
      return res.json({
        connected: false,
        content: [],
        message: 'Connect to Salesforce to see published content.',
      });
    }

    let conn;
    if (hasUserOAuth) {
      conn = getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl);
    } else {
      conn = await getWorkerConnection();
    }

    const contentType = req.query.type || 'all';
    const workspaceFilter = req.query.workspace || null;
    const content = [];

    // ── Resolve workspace ID if a workspace filter name is provided ──
    let workspaceId = null;
    if (workspaceFilter) {
      try {
        const workspaces = await queryRecords(
          conn,
          `SELECT Id, Name FROM ContentWorkspace WHERE Name LIKE '%${workspaceFilter.replace(/'/g, "\\'")}%' LIMIT 5`
        );
        if (workspaces.length > 0) {
          workspaceId = workspaces[0].Id;
          console.log(`[Content] Using workspace: ${workspaces[0].Name} (${workspaceId})`);
        }
      } catch (wsErr) {
        console.log('[Content] Could not resolve workspace:', wsErr.message);
      }
    }

    // If no explicit workspace filter, try the default Marketing Cloud workspace
    if (!workspaceId) {
      try {
        const defaultWs = await queryRecords(
          conn,
          `SELECT Id, Name FROM ContentWorkspace WHERE Name LIKE '%Marketing Cloud%' ORDER BY CreatedDate ASC LIMIT 1`
        );
        if (defaultWs.length > 0) {
          workspaceId = defaultWs[0].Id;
          console.log(`[Content] Defaulting to workspace: ${defaultWs[0].Name} (${workspaceId})`);
        }
      } catch (wsErr) {
        console.log('[Content] Could not find Marketing Cloud workspace:', wsErr.message);
      }
    }

    // ── Fetch Email Templates ──
    if (contentType === 'all' || contentType === 'email') {
      try {
        // If workspace is found, filter EmailTemplates by folder
        const emailTemplates = await queryRecords(
          conn,
          `SELECT Id, Name, Subject, DeveloperName, FolderId, TemplateType, IsActive, Body, HtmlValue, Description
           FROM EmailTemplate
           WHERE IsActive = true
           ORDER BY LastModifiedDate DESC
           LIMIT 50`
        );
        for (const t of emailTemplates) {
          content.push({
            id: t.Id,
            name: t.Name,
            type: 'email',
            subtype: 'template',
            subject: t.Subject,
            description: t.Description,
            templateType: t.TemplateType,
            hasHtml: !!t.HtmlValue,
            preview: t.Body ? t.Body.substring(0, 120) : null,
          });
        }
      } catch (etErr) {
        console.log('[Content] Could not fetch email templates:', etErr.message);
      }

      // ── Fetch CMS Email content — filtered by workspace when available ──
      try {
        let cmsQuery;
        if (workspaceId) {
          // Filter ContentVersion to only items in the target workspace
          cmsQuery = `SELECT Id, Title, VersionNumber, FileType, ContentDocumentId, Description, IsLatest
           FROM ContentVersion
           WHERE FileType IN ('SNOTE', 'HTML')
             AND IsLatest = true
             AND ContentDocumentId IN (SELECT ContentDocumentId FROM ContentWorkspaceDoc WHERE ContentWorkspaceId = '${workspaceId}')
           ORDER BY LastModifiedDate DESC
           LIMIT 30`;
        } else {
          cmsQuery = `SELECT Id, Title, VersionNumber, FileType, ContentDocumentId, Description, IsLatest
           FROM ContentVersion
           WHERE FileType IN ('SNOTE', 'HTML')
             AND IsLatest = true
           ORDER BY LastModifiedDate DESC
           LIMIT 30`;
        }

        const cmsContent = await queryRecords(conn, cmsQuery);
        for (const c of cmsContent) {
          content.push({
            id: c.Id,
            name: c.Title,
            type: 'email',
            subtype: 'cms_content',
            description: c.Description,
            versionNumber: c.VersionNumber,
            fileType: c.FileType,
          });
        }
      } catch (cmsErr) {
        console.log('[Content] Could not fetch CMS content:', cmsErr.message);
      }
    }

    // ── Fetch SMS Templates (if available) ──
    if (contentType === 'all' || contentType === 'sms') {
      // Try fetching from MessagingTemplate (Service Cloud Messaging)
      try {
        const smsTemplates = await queryRecords(
          conn,
          `SELECT Id, Name, Message, DeveloperName, IsActive, Description
           FROM MessagingTemplate
           WHERE IsActive = true
           ORDER BY LastModifiedDate DESC
           LIMIT 30`
        );
        for (const s of smsTemplates) {
          content.push({
            id: s.Id,
            name: s.Name,
            type: 'sms',
            subtype: 'messaging_template',
            message: s.Message,
            description: s.Description,
            preview: s.Message ? s.Message.substring(0, 120) : null,
          });
        }
      } catch (smsErr) {
        console.log('[Content] MessagingTemplate not available:', smsErr.message);
      }

      // Try fetching from FlowMessageDefinition (if exists)
      try {
        const flowMessages = await queryRecords(
          conn,
          `SELECT Id, MasterLabel, DeveloperName, Description
           FROM FlowMessageDefinition
           WHERE IsActive = true
           ORDER BY LastModifiedDate DESC
           LIMIT 20`
        );
        for (const fm of flowMessages) {
          content.push({
            id: fm.Id,
            name: fm.MasterLabel,
            type: 'sms',
            subtype: 'flow_message',
            description: fm.Description,
          });
        }
      } catch (fmErr) {
        // This object may not exist in all orgs
        console.log('[Content] FlowMessageDefinition not available:', fmErr.message);
      }
    }

    res.json({
      connected: true,
      content,
      totalEmails: content.filter(c => c.type === 'email').length,
      totalSms: content.filter(c => c.type === 'sms').length,
      workspaceId: workspaceId || null,
    });
  } catch (err) {
    console.error('[Content] Error fetching content:', err.message);
    res.json({
      connected: false,
      content: [],
      message: `Could not connect to Salesforce: ${err.message}`,
    });
  }
});

module.exports = router;
