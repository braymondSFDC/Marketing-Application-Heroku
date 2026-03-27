'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../../../db');
const { requireAuth } = require('../middleware/auth');

// All journey routes require authentication
router.use(requireAuth);

/**
 * GET /api/journeys
 * List all journeys for the current org.
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, sf_campaign_id, status, segment_object, created_at, updated_at
       FROM journeys
       WHERE sf_org_id = $1
       ORDER BY updated_at DESC`,
      [req.sfOrgId]
    );

    res.json({ journeys: result.rows });
  } catch (err) {
    console.error('[Journeys] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch journeys' });
  }
});

/**
 * GET /api/journeys/:id
 * Get a single journey with its nodes and edges.
 */
router.get('/:id', async (req, res) => {
  try {
    const journey = await db.query(
      'SELECT * FROM journeys WHERE id = $1 AND sf_org_id = $2',
      [req.params.id, req.sfOrgId]
    );

    if (journey.rows.length === 0) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    const [nodes, edges] = await Promise.all([
      db.query(
        'SELECT * FROM journey_nodes WHERE journey_id = $1 ORDER BY sort_order ASC',
        [req.params.id]
      ),
      db.query(
        'SELECT * FROM journey_edges WHERE journey_id = $1',
        [req.params.id]
      ),
    ]);

    res.json({
      journey: journey.rows[0],
      nodes: nodes.rows,
      edges: edges.rows,
    });
  } catch (err) {
    console.error('[Journeys] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch journey' });
  }
});

/**
 * POST /api/journeys
 * Create a new journey.
 */
router.post('/', async (req, res) => {
  try {
    const { name, segment_object, segment_filter, canvas_state } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Journey name is required' });
    }

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO journeys (id, name, sf_org_id, sf_user_id, segment_object, segment_filter, canvas_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, name, req.sfOrgId, req.sfUserId, segment_object || null, segment_filter || null, canvas_state || {}]
    );

    res.status(201).json({ journey: result.rows[0] });
  } catch (err) {
    console.error('[Journeys] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create journey' });
  }
});

/**
 * PUT /api/journeys/:id
 * Update a journey (name, segment, canvas state, status).
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, segment_object, segment_filter, canvas_state, status, sf_campaign_id } = req.body;

    // Verify ownership
    const existing = await db.query(
      'SELECT id, status FROM journeys WHERE id = $1 AND sf_org_id = $2',
      [req.params.id, req.sfOrgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    // Don't allow editing active/published journeys (except status changes)
    if (['active', 'published'].includes(existing.rows[0].status) && !status) {
      return res.status(400).json({ error: 'Cannot modify an active journey. Pause it first.' });
    }

    const result = await db.query(
      `UPDATE journeys
       SET name = COALESCE($1, name),
           segment_object = COALESCE($2, segment_object),
           segment_filter = COALESCE($3, segment_filter),
           canvas_state = COALESCE($4, canvas_state),
           status = COALESCE($5, status),
           sf_campaign_id = COALESCE($6, sf_campaign_id),
           updated_at = NOW()
       WHERE id = $7 AND sf_org_id = $8
       RETURNING *`,
      [name, segment_object, segment_filter, canvas_state, status, sf_campaign_id, req.params.id, req.sfOrgId]
    );

    res.json({ journey: result.rows[0] });
  } catch (err) {
    console.error('[Journeys] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update journey' });
  }
});

/**
 * DELETE /api/journeys/:id
 * Delete a draft journey. Cannot delete active journeys.
 */
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT id, status FROM journeys WHERE id = $1 AND sf_org_id = $2',
      [req.params.id, req.sfOrgId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    if (existing.rows[0].status === 'active') {
      return res.status(400).json({ error: 'Cannot delete an active journey. Pause it first.' });
    }

    await db.query('DELETE FROM journeys WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[Journeys] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete journey' });
  }
});

module.exports = router;
