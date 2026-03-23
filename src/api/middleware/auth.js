'use strict';

const crypto = require('crypto');

/**
 * Verify a Salesforce Canvas signed request.
 * The signed request is a base64-encoded signature + '.' + base64-encoded JSON envelope.
 * HMAC-SHA256 is used with the Connected App consumer secret.
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

/**
 * Express middleware — requires a valid Canvas session.
 * Canvas context is stored in req.session.canvasContext after the initial POST.
 */
function requireCanvasAuth(req, res, next) {
  if (!req.session || !req.session.canvasContext) {
    return res.status(401).json({ error: 'Unauthorized — no Canvas session' });
  }

  // Attach convenience properties
  req.sfOrgId = req.session.canvasContext.context.organization.organizationId;
  req.sfUserId = req.session.canvasContext.context.user.userId;
  req.sfInstanceUrl = req.session.canvasContext.client.instanceUrl;
  req.sfOauthToken = req.session.canvasContext.client.oauthToken;

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
  requireCanvasAuth,
  verifyWebhookSignature,
};
