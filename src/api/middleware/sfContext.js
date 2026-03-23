'use strict';

const { getSalesforceConnection } = require('../services/salesforce');

/**
 * Middleware — injects an authenticated jsforce Connection onto req.sfConn.
 * Uses the OAuth token from the Canvas session to create a connection
 * pointed at the user's Salesforce instance.
 */
async function injectSalesforceContext(req, res, next) {
  try {
    if (!req.sfOauthToken || !req.sfInstanceUrl) {
      return res.status(401).json({ error: 'No Salesforce context available' });
    }

    req.sfConn = getSalesforceConnection(req.sfOauthToken, req.sfInstanceUrl);
    next();
  } catch (err) {
    console.error('[sfContext] Failed to create Salesforce connection:', err.message);
    res.status(500).json({ error: 'Failed to establish Salesforce connection' });
  }
}

module.exports = { injectSalesforceContext };
