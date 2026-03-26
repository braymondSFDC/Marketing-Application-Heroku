'use strict';

const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { requireAuth } = require('../middleware/auth');
const { Queue } = require('bullmq');
const { Redis } = require('ioredis');

// BullMQ queue for launch jobs
let launchQueue;

function getLaunchQueue() {
  if (!launchQueue) {
    const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
    launchQueue = new Queue('journey-launch', { connection });
  }
  return launchQueue;
}

router.use(requireAuth);

/**
 * POST /api/journeys/:id/launch
 *
 * "One-Click Launch" — enqueues the full orchestration sequence:
 *   1. Create Campaign
 *   2. Upload Email Templates
 *   3. Generate & Deploy Flow
 *   4. Activate Flow
 *   5. Populate Campaign Members
 *   6. Publish Platform Events
 *   7. Post to Chatter
 */
router.post('/:id/launch', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch journey with nodes and edges
    const journey = await db.query(
      'SELECT * FROM journeys WHERE id = $1 AND sf_org_id = $2',
      [id, req.sfOrgId]
    );

    if (journey.rows.length === 0) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const journeyData = journey.rows[0];

    if (journeyData.status === 'active') {
      return res.status(400).json({ error: 'Journey is already active' });
    }

    const [nodesResult, edgesResult] = await Promise.all([
      db.query('SELECT * FROM journey_nodes WHERE journey_id = $1 ORDER BY sort_order', [id]),
      db.query('SELECT * FROM journey_edges WHERE journey_id = $1', [id]),
    ]);

    if (nodesResult.rows.length === 0) {
      return res.status(400).json({ error: 'Journey has no nodes. Add steps before launching.' });
    }

    // Validate: must have at least one trigger node
    const hasTrigger = nodesResult.rows.some((n) => n.node_type === 'trigger');
    if (!hasTrigger) {
      return res.status(400).json({ error: 'Journey must have a trigger node.' });
    }

    // Update status to "launching"
    await db.query(
      "UPDATE journeys SET status = 'launching', updated_at = NOW() WHERE id = $1",
      [id]
    );

    // Enqueue the launch job for the worker dyno
    const queue = getLaunchQueue();
    const job = await queue.add(
      'launch',
      {
        journeyId: id,
        journey: journeyData,
        nodes: nodesResult.rows,
        edges: edgesResult.rows,
        sfOauthToken: req.sfOauthToken,
        sfInstanceUrl: req.sfInstanceUrl,
        sfOrgId: req.sfOrgId,
        sfUserId: req.sfUserId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      }
    );

    // Log the launch initiation
    await db.query(
      `INSERT INTO deployment_logs (journey_id, action, status)
       VALUES ($1, 'launch_initiated', 'pending')`,
      [id]
    );

    // Notify connected clients via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`journey:${id}`).emit('journey:status', {
        journeyId: id,
        status: 'launching',
        jobId: job.id,
      });
    }

    res.json({
      launched: true,
      jobId: job.id,
      message: 'Journey launch initiated. You will receive real-time updates.',
    });
  } catch (err) {
    console.error('[Launch] Error:', err.message);
    res.status(500).json({ error: 'Failed to launch journey' });
  }
});

/**
 * GET /api/journeys/:id/launch/status
 * Check the status of a launch job.
 */
router.get('/:id/launch/status', async (req, res) => {
  try {
    const logs = await db.query(
      `SELECT action, status, sf_resource_id, error_message, created_at
       FROM deployment_logs
       WHERE journey_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    const journey = await db.query(
      'SELECT status FROM journeys WHERE id = $1 AND sf_org_id = $2',
      [req.params.id, req.sfOrgId]
    );

    res.json({
      journeyStatus: journey.rows[0]?.status || 'unknown',
      logs: logs.rows,
    });
  } catch (err) {
    console.error('[Launch] Status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch launch status' });
  }
});

module.exports = router;
