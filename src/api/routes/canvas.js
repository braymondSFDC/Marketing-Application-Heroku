'use strict';

const express = require('express');
const router = express.Router();
const { verifySignedRequest } = require('../middleware/auth');

/**
 * POST /canvas
 *
 * Entry point for Salesforce Canvas. Salesforce POSTs a signed request
 * containing the user context, org info, and OAuth token.
 *
 * After verification, the Canvas context is stored in the session and
 * the user is redirected to the React SPA.
 */
router.post('/', (req, res) => {
  try {
    const signedRequest = req.body.signed_request;

    if (!signedRequest) {
      return res.status(400).json({ error: 'Missing signed_request parameter' });
    }

    const consumerSecret = process.env.CANVAS_CONSUMER_SECRET;
    if (!consumerSecret) {
      console.error('[Canvas] CANVAS_CONSUMER_SECRET not configured');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    // Verify and decode the signed request
    const canvasContext = verifySignedRequest(signedRequest, consumerSecret);

    // Store in session for subsequent API calls
    req.session.canvasContext = canvasContext;

    // Log the connection
    const orgId = canvasContext.context?.organization?.organizationId;
    const userId = canvasContext.context?.user?.userId;
    const userName = canvasContext.context?.user?.userName;
    console.log(`[Canvas] Authenticated: user=${userName} (${userId}), org=${orgId}`);

    // Return an HTML page that bootstraps the React SPA inside the Canvas iframe
    const instanceUrl = canvasContext.client?.instanceUrl || '';
    const targetOrigin = canvasContext.client?.targetOrigin || instanceUrl;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Journey Builder</title>
        <script>
          // Pass Canvas context to the React app via window
          window.__CANVAS_CONTEXT__ = ${JSON.stringify({
            orgId,
            userId,
            userName,
            instanceUrl,
            targetOrigin,
          })};
        </script>
      </head>
      <body>
        <div id="root"></div>
        <script src="/static/js/bundle.js"></script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[Canvas] Verification failed:', err.message);
    res.status(401).json({ error: 'Canvas authentication failed' });
  }
});

/**
 * GET /canvas/context
 *
 * Return the current Canvas session context (for the React app to read).
 */
router.get('/context', (req, res) => {
  if (!req.session || !req.session.canvasContext) {
    return res.status(401).json({ error: 'No active Canvas session' });
  }

  const ctx = req.session.canvasContext;
  res.json({
    orgId: ctx.context?.organization?.organizationId,
    orgName: ctx.context?.organization?.name,
    userId: ctx.context?.user?.userId,
    userName: ctx.context?.user?.userName,
    fullName: ctx.context?.user?.fullName,
    instanceUrl: ctx.client?.instanceUrl,
  });
});

module.exports = router;
