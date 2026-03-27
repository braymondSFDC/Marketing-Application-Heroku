'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDefaultOrgContext } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Salesforce OAuth 2.0 Web Server Flow
// ---------------------------------------------------------------------------

const SF_LOGIN_URL = (process.env.SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/+$/, '');

/**
 * GET /auth/salesforce
 *
 * Redirects the user to the Salesforce OAuth authorization page.
 * Requires SF_CLIENT_ID and SF_CALLBACK_URL env vars.
 */
router.get('/salesforce', (req, res) => {
  const clientId = process.env.SF_CLIENT_ID;
  const callbackUrl = process.env.SF_CALLBACK_URL;

  if (!clientId || !callbackUrl) {
    return res.status(500).json({
      error: 'Salesforce OAuth not configured. Set SF_CLIENT_ID and SF_CALLBACK_URL.',
    });
  }

  // CSRF protection — random state stored in session
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  // PKCE — generate code_verifier and code_challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  req.session.codeVerifier = codeVerifier;
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const authUrl =
    `${SF_LOGIN_URL}/services/oauth2/authorize?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=${encodeURIComponent('api refresh_token web full')}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log('[Auth] Redirecting to Salesforce OAuth:', authUrl.split('?')[0]);
  res.redirect(authUrl);
});

/**
 * GET /auth/salesforce/callback
 *
 * Handles the OAuth callback from Salesforce.
 * Exchanges the authorization code for access + refresh tokens.
 * Stores tokens in session and updates app context.
 */
router.get('/salesforce/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors from Salesforce
    if (error) {
      console.error('[Auth] Salesforce OAuth error:', error, error_description);
      return res.redirect('/?auth_error=' + encodeURIComponent(error_description || error));
    }

    // Verify CSRF state
    if (!state || state !== req.session.oauthState) {
      console.error('[Auth] OAuth state mismatch');
      return res.redirect('/?auth_error=invalid_state');
    }
    delete req.session.oauthState;

    if (!code) {
      return res.redirect('/?auth_error=no_code');
    }

    const clientId = process.env.SF_CLIENT_ID;
    const clientSecret = process.env.SF_CLIENT_SECRET;
    const callbackUrl = process.env.SF_CALLBACK_URL;
    const codeVerifier = req.session.codeVerifier;
    delete req.session.codeVerifier;

    // Exchange code for tokens (with PKCE code_verifier)
    const tokenUrl = `${SF_LOGIN_URL}/services/oauth2/token`;
    const tokenParams = {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    };
    // Include client_secret only if set (some Connected Apps don't require it with PKCE)
    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }
    const params = new URLSearchParams(tokenParams);

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[Auth] Token exchange failed:', tokenRes.status, errBody);
      return res.redirect('/?auth_error=token_exchange_failed');
    }

    const tokenData = await tokenRes.json();

    // Fetch user identity info
    let userInfo = {};
    try {
      const idRes = await fetch(tokenData.id, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (idRes.ok) {
        userInfo = await idRes.json();
      }
    } catch (idErr) {
      console.warn('[Auth] Could not fetch user identity:', idErr.message);
    }

    // Store tokens and org info in session
    req.session.appContext = {
      orgId: tokenData.id ? tokenData.id.split('/')[4] : userInfo.organization_id || 'unknown',
      orgName: userInfo.organization_id || 'Salesforce Org',
      userId: userInfo.user_id || 'unknown',
      userName: userInfo.username || userInfo.email || 'unknown',
      fullName: userInfo.display_name || userInfo.username || 'Salesforce User',
      instanceUrl: tokenData.instance_url,
      oauthToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      oauthConnected: true,
    };

    console.log('[Auth] Salesforce OAuth successful for:', req.session.appContext.userName);
    res.redirect('/');
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err.message);
    res.redirect('/?auth_error=callback_failed');
  }
});

/**
 * GET /auth/status
 *
 * Returns the current Salesforce connection status.
 */
router.get('/status', (req, res) => {
  const ctx = req.session.appContext;

  if (ctx?.oauthConnected && ctx?.oauthToken) {
    return res.json({
      connected: true,
      orgId: ctx.orgId,
      userName: ctx.userName,
      fullName: ctx.fullName,
      instanceUrl: ctx.instanceUrl,
    });
  }

  res.json({ connected: false });
});

/**
 * POST /auth/disconnect
 *
 * Clears Salesforce OAuth tokens from the session.
 * Reverts to standalone mode.
 */
router.post('/disconnect', (req, res) => {
  // Revoke the token at Salesforce (best-effort)
  if (req.session.appContext?.oauthToken && req.session.appContext?.instanceUrl) {
    const revokeUrl = `${req.session.appContext.instanceUrl}/services/oauth2/revoke?token=${encodeURIComponent(req.session.appContext.oauthToken)}`;
    fetch(revokeUrl, { method: 'POST' }).catch(() => {});
  }

  // Reset to standalone defaults
  req.session.appContext = getDefaultOrgContext();

  res.json({ disconnected: true });
});

// ---------------------------------------------------------------------------
// Existing Context & Session Routes
// ---------------------------------------------------------------------------

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
