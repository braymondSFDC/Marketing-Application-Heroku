'use strict';

const { createRecord, queryRecords } = require('./salesforce');

/**
 * Upload an Email Template to Salesforce.
 * Used during the "Launch" orchestration — one template per email node.
 */
async function uploadEmailTemplate(conn, { journeyId, nodeName, subject, htmlBody, textBody }) {
  const devName = sanitizeApiName(`JB_${journeyId.slice(0, 8)}_${nodeName}`);

  const templateData = {
    Name: `${nodeName} — Journey ${journeyId.slice(0, 8)}`,
    DeveloperName: devName,
    Subject: subject || `Email from Journey ${journeyId.slice(0, 8)}`,
    HtmlValue: htmlBody || '<html><body><p>Email content</p></body></html>',
    Body: textBody || 'Email content',
    TemplateType: 'custom',
    Encoding: 'UTF-8',
    IsActive: true,
  };

  // Check if folder exists; if not, use the default public folder
  const folders = await queryRecords(
    conn,
    "SELECT Id FROM Folder WHERE Type = 'Email' AND DeveloperName = 'JourneyBuilderTemplates' LIMIT 1"
  );

  if (folders.length > 0) {
    templateData.FolderId = folders[0].Id;
  }

  const result = await createRecord(conn, 'EmailTemplate', templateData);

  if (!result.success) {
    throw new Error(`Failed to create EmailTemplate: ${JSON.stringify(result.errors)}`);
  }

  return {
    templateId: result.id,
    developerName: devName,
  };
}

/**
 * Upload multiple templates for all email nodes in a journey.
 * Returns a map of nodeId → templateId.
 */
async function uploadAllTemplates(conn, journeyId, emailNodes) {
  const templateMap = {};

  for (const node of emailNodes) {
    const config = node.config || {};
    const result = await uploadEmailTemplate(conn, {
      journeyId,
      nodeName: config.name || `Email_${node.id.slice(0, 8)}`,
      subject: config.subject,
      htmlBody: config.htmlBody,
      textBody: config.textBody,
    });

    templateMap[node.id] = result;
  }

  return templateMap;
}

/**
 * Sanitize a string for use as a Salesforce API name.
 */
function sanitizeApiName(name) {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

module.exports = {
  uploadEmailTemplate,
  uploadAllTemplates,
  sanitizeApiName,
};
