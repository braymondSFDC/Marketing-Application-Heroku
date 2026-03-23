'use strict';

const jsforce = require('jsforce');

const API_VERSION = '62.0';

/**
 * Create an authenticated jsforce Connection using an OAuth token + instance URL.
 * This is used for per-request connections derived from the Canvas session.
 */
function getSalesforceConnection(accessToken, instanceUrl) {
  return new jsforce.Connection({
    instanceUrl,
    accessToken,
    version: API_VERSION,
  });
}

/**
 * Create a connection using OAuth2 client credentials for background worker operations.
 * Uses refresh token flow for long-lived access.
 */
async function getWorkerConnection(refreshToken) {
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SF_CLIENT_ID,
      clientSecret: process.env.SF_CLIENT_SECRET,
      loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
    },
    version: API_VERSION,
  });

  if (refreshToken) {
    conn.refreshToken = refreshToken;
    await conn.oauth2.refreshToken(refreshToken);
  }

  return conn;
}

/**
 * Describe a Salesforce object — returns all field metadata.
 * Useful for the Personalization Engine field picker.
 */
async function describeObject(conn, objectName) {
  const result = await conn.describe(objectName);

  return result.fields
    .filter((f) => f.type !== 'address' && f.type !== 'location') // exclude compound fields
    .map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      custom: f.custom,
      picklistValues: f.picklistValues?.length ? f.picklistValues : undefined,
      referenceTo: f.referenceTo?.length ? f.referenceTo : undefined,
      nillable: f.nillable,
      updateable: f.updateable,
    }));
}

/**
 * Execute a SOQL query and return records.
 */
async function queryRecords(conn, soql) {
  const result = await conn.query(soql);
  return result.records;
}

/**
 * Create a Salesforce record.
 */
async function createRecord(conn, objectName, data) {
  return conn.sobject(objectName).create(data);
}

/**
 * Update a Salesforce record.
 */
async function updateRecord(conn, objectName, data) {
  return conn.sobject(objectName).update(data);
}

/**
 * Publish a Platform Event.
 */
async function publishPlatformEvent(conn, eventName, payload) {
  return conn.sobject(eventName).create(payload);
}

/**
 * Publish multiple Platform Events in batch.
 * Respects the 150K/hour limit.
 */
async function publishPlatformEventsBatch(conn, eventName, payloads, batchSize = 200) {
  const results = [];
  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    const batchResult = await conn.sobject(eventName).create(batch);
    results.push(...(Array.isArray(batchResult) ? batchResult : [batchResult]));
  }
  return results;
}

module.exports = {
  getSalesforceConnection,
  getWorkerConnection,
  describeObject,
  queryRecords,
  createRecord,
  updateRecord,
  publishPlatformEvent,
  publishPlatformEventsBatch,
  API_VERSION,
};
