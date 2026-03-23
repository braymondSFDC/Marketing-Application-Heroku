'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { verifyWebhookSignature } = require('../middleware/auth');
const { Redis } = require('ioredis');

// Redis publisher for real-time events
let redisPublisher;

function getRedisPublisher() {
  if (!redisPublisher) {
    redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return redisPublisher;
}

/**
 * POST /api/webhooks/email-engagement
 *
 * Receives email engagement events from Salesforce.
 * Pipeline: SF Enhanced Email → Platform Event → Apex HTTP Callout → This endpoint
 *
 * Stores the event and publishes to Redis for real-time Socket.io delivery.
 */
router.post('/email-engagement', verifyWebhookSignature, async (req, res) => {
  try {
    const {
      eventType,  // open, click, bounce, unsubscribe
      email,
      contactId,
      leadId,
      journeyId,
      nodeId,
      linkUrl,
      timestamp,
    } = req.body;

    if (!eventType || !journeyId) {
      return res.status(400).json({ error: 'eventType and journeyId are required' });
    }

    // 1. Persist the engagement event
    await db.query(
      `INSERT INTO engagement_events (journey_id, node_id, event_type, contact_id, lead_id, email, metadata, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        journeyId,
        nodeId || null,
        eventType,
        contactId || null,
        leadId || null,
        email || null,
        JSON.stringify({ linkUrl: linkUrl || null }),
        timestamp || new Date().toISOString(),
      ]
    );

    // 2. Publish to Redis for real-time delivery via Socket.io
    const publisher = getRedisPublisher();
    await publisher.publish(
      `journey:${journeyId}`,
      JSON.stringify({
        type: 'engagement_event',
        nodeId,
        eventType,
        contactId: contactId || leadId,
        email,
        timestamp: timestamp || new Date().toISOString(),
      })
    );

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Webhook] Engagement error:', err.message);
    res.status(500).json({ error: 'Failed to process engagement event' });
  }
});

/**
 * GET /api/webhooks/stats/:journeyId
 * Return aggregated engagement stats for a journey.
 */
router.get('/stats/:journeyId', async (req, res) => {
  try {
    const { journeyId } = req.params;

    // Overall journey stats
    const overallStats = await db.query(
      `SELECT
         event_type,
         COUNT(*) as count
       FROM engagement_events
       WHERE journey_id = $1
       GROUP BY event_type`,
      [journeyId]
    );

    // Per-node stats
    const nodeStats = await db.query(
      `SELECT
         node_id,
         event_type,
         COUNT(*) as count
       FROM engagement_events
       WHERE journey_id = $1 AND node_id IS NOT NULL
       GROUP BY node_id, event_type`,
      [journeyId]
    );

    // Format response
    const overall = {};
    for (const row of overallStats.rows) {
      overall[row.event_type] = parseInt(row.count, 10);
    }

    const byNode = {};
    for (const row of nodeStats.rows) {
      if (!byNode[row.node_id]) byNode[row.node_id] = {};
      byNode[row.node_id][row.event_type] = parseInt(row.count, 10);
    }

    res.json({ overall, byNode });
  } catch (err) {
    console.error('[Webhook] Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch engagement stats' });
  }
});

module.exports = router;
