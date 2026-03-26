'use strict';

const express = require('express');
const router = express.Router();
const { getDefaultOrgContext } = require('../middleware/auth');

/**
 * GET /auth/context
 *
 * Returns the current session context.
 * In standalone mode, auto-initializes with default org context.
 */
router.get('/context', (req, res) => {
  if (!req.session.appContext) {
    req.session.appContext = getDefaultOrgContext();
  }

  res.json(req.session.appContext);
});

/**
 * POST /auth/context
 *
 * Update the session context (e.g., when a user changes their display name or org).
 * Useful for future multi-org support.
 */
router.post('/context', (req, res) => {
  const { orgId, orgName, userName, fullName } = req.body;

  if (!req.session.appContext) {
    req.session.appContext = getDefaultOrgContext();
  }

  if (orgId) req.session.appContext.orgId = orgId;
  if (orgName) req.session.appContext.orgName = orgName;
  if (userName) req.session.appContext.userName = userName;
  if (fullName) req.session.appContext.fullName = fullName;

  res.json(req.session.appContext);
});

/**
 * DELETE /auth/session
 *
 * Destroy the current session (logout).
 */
router.delete('/session', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to destroy session' });
    }
    res.json({ loggedOut: true });
  });
});

module.exports = router;
