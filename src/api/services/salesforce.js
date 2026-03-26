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
 * Supports three authentication modes:
 *   1. Refresh token flow (if refreshToken provided)
 *   2. Username/password + security token flow (SF_USERNAME + SF_PASSWORD)
 *   3. Client credentials flow (SF_CLIENT_ID + SF_CLIENT_SECRET only — requires Connected App)
 */
async function getWorkerConnection(refreshToken) {
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;

  const conn = new jsforce.Connection({
    oauth2: {
      clientId,
      clientSecret,
      loginUrl,
    },
    version: API_VERSION,
  });

  // Mode 1: Refresh token (highest priority)
  if (refreshToken) {
    conn.refreshToken = refreshToken;
    await conn.oauth2.refreshToken(refreshToken);
    return conn;
  }

  // Mode 2: Username + password login
  const sfUsername = process.env.SF_USERNAME;
  const sfPassword = process.env.SF_PASSWORD;
  const sfToken = process.env.SF_SECURITY_TOKEN || '';

  if (sfUsername && sfPassword) {
    await conn.login(sfUsername, sfPassword + sfToken);
    return conn;
  }

  // Mode 3: Client credentials flow (OAuth 2.0 client_credentials grant)
  if (clientId && clientSecret) {
    const tokenUrl = `${loginUrl}/services/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Client credentials auth failed: ${response.status} — ${errorBody}`);
    }

    const tokenData = await response.json();
    return new jsforce.Connection({
      instanceUrl: tokenData.instance_url,
      accessToken: tokenData.access_token,
      version: API_VERSION,
    });
  }

  throw new Error('No Salesforce authentication method configured. Set SF_USERNAME+SF_PASSWORD or configure Connected App client credentials.');
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
