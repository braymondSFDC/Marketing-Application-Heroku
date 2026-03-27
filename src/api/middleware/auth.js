'use strict';

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CANVAS AUTH — preserved for future Canvas integration
// ---------------------------------------------------------------------------

/**
 * Verify a Salesforce Canvas signed request.
 * HMAC-SHA256 with Connected App consumer secret.
 * NOTE: Preserved for future use when Canvas license is available.
 */
function verifySignedRequest(signedRequest, consumerSecret) {
  if (!signedRequest || !consumerSecret) {
    throw new Error('Missing signed request or consumer secret');
  }

  const parts = signedRequest.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed signed request');
  }

  const [encodedSig, encodedEnvelope] = parts;
  const signature = Buffer.from(encodedSig, 'base64');

  const expected = crypto
    .createHmac('sha256', consumerSecret)
    .update(encodedEnvelope)
    .digest();

  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) {
    throw new Error('Invalid signed request signature');
  }

  return JSON.parse(Buffer.from(encodedEnvelope, 'base64').toString('utf8'));
}

// ---------------------------------------------------------------------------
// STANDALONE AUTH — session-based, no Canvas dependency
// ---------------------------------------------------------------------------

/**
 * Default org context used in standalone mode.
 * Configurable via environment variables.
 */
function getDefaultOrgContext() {
  return {
    orgId: process.env.SF_ORG_ID || 'standalone-org',
    orgName: process.env.SF_ORG_NAME || 'Marketing Journey Builder',
    userId: process.env.SF_USER_ID || 'standalone-user',
    userName: process.env.SF_USERNAME || 'admin@journeybuilder.app',
    fullName: process.env.SF_USER_FULLNAME || 'Journey Builder Admin',
    instanceUrl: process.env.SF_INSTANCE_URL || null,
  };
}

/**
 * Express middleware — ensures a valid session context exists.
 *
 * If the user has authenticated via Salesforce OAuth, uses their tokens.
 * Otherwise, falls back to standalone defaults so the app works without SF.
 * Attaches convenience properties to req for route handlers.
 */
function requireAuth(req, res, next) {
  if (!req.session.appContext) {
    req.session.appContext = getDefaultOrgContext();
  }

  const ctx = req.session.appContext;

  // Use OAuth tokens when user has connected via Salesforce
  if (ctx.oauthConnected && ctx.oauthToken) {
    req.sfOrgId = ctx.orgId;
    req.sfUserId = ctx.userId;
    req.sfInstanceUrl = ctx.instanceUrl;
    req.sfOauthToken = ctx.oauthToken;
    req.sfRefreshToken = ctx.refreshToken || null;
    req.sfConnected = true;
  } else {
    // Standalone mode — fall back to env var defaults
    req.sfOrgId = ctx.orgId;
    req.sfUserId = ctx.userId;
    req.sfInstanceUrl = ctx.instanceUrl || null;
    req.sfOauthToken = null;
    req.sfRefreshToken = null;
    req.sfConnected = false;
  }

  next();
}

/**
 * Verify webhook payload using HMAC-SHA256 shared secret.
 * Expects header: x-webhook-signature
 */
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const payload = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}

module.exports = {
  verifySignedRequest,
  requireAuth,
  verifyWebhookSignature,
  getDefaultOrgContext,
};
