'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../../../db');
const { requireCanvasAuth } = require('../middleware/auth');

router.use(requireCanvasAuth);

/**
 * POST /api/journeys/:journeyId/nodes
 * Add a node to a journey.
 */
router.post('/:journeyId/nodes', async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { node_type, position_x, position_y, config, sort_order } = req.body;

    // Verify journey belongs to this org
    const journey = await db.query(
      'SELECT id FROM journeys WHERE id = $1 AND sf_org_id = $2',
      [journeyId, req.sfOrgId]
    );

    if (journey.rows.length === 0) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    if (!node_type) {
      return res.status(400).json({ error: 'node_type is required' });
    }

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO journey_nodes (id, journey_id, node_type, position_x, position_y, config, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, journeyId, node_type, position_x || 0, position_y || 0, config || {}, sort_order || 0]
    );

    res.status(201).json({ node: result.rows[0] });
  } catch (err) {
    console.error('[Nodes] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create node' });
  }
});

/**
 * PUT /api/journeys/:journeyId/nodes/:nodeId
 * Update a node's config or position.
 */
router.put('/:journeyId/nodes/:nodeId', async (req, res) => {
  try {
    const { journeyId, nodeId } = req.params;
    const { position_x, position_y, config, sort_order } = req.body;

    const result = await db.query(
      `UPDATE journey_nodes
       SET position_x = COALESCE($1, position_x),
           position_y = COALESCE($2, position_y),
           config = COALESCE($3, config),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND journey_id = $6
       RETURNING *`,
      [position_x, position_y, config, sort_order, nodeId, journeyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ node: result.rows[0] });
  } catch (err) {
    console.error('[Nodes] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

/**
 * DELETE /api/journeys/:journeyId/nodes/:nodeId
 * Remove a node (cascades to edges).
 */
router.delete('/:journeyId/nodes/:nodeId', async (req, res) => {
  try {
    const { journeyId, nodeId } = req.params;

    const result = await db.query(
      'DELETE FROM journey_nodes WHERE id = $1 AND journey_id = $2 RETURNING id',
      [nodeId, journeyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('[Nodes] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

/**
 * POST /api/journeys/:journeyId/edges
 * Create an edge between two nodes.
 */
router.post('/:journeyId/edges', async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { source_node_id, target_node_id, label, condition } = req.body;

    if (!source_node_id || !target_node_id) {
      return res.status(400).json({ error: 'source_node_id and target_node_id required' });
    }

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO journey_edges (id, journey_id, source_node_id, target_node_id, label, condition)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, journeyId, source_node_id, target_node_id, label || null, condition || null]
    );

    res.status(201).json({ edge: result.rows[0] });
  } catch (err) {
    console.error('[Edges] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create edge' });
  }
});

/**
 * DELETE /api/journeys/:journeyId/edges/:edgeId
 */
router.delete('/:journeyId/edges/:edgeId', async (req, res) => {
  try {
    const { journeyId, edgeId } = req.params;

    const result = await db.query(
      'DELETE FROM journey_edges WHERE id = $1 AND journey_id = $2 RETURNING id',
      [edgeId, journeyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edge not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('[Edges] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete edge' });
  }
});

/**
 * PUT /api/journeys/:journeyId/canvas
 * Bulk-save the entire canvas state (all nodes + edges at once).
 * This is called when the React Flow canvas auto-saves.
 */
router.put('/:journeyId/canvas', async (req, res) => {
  const client = await db.getClient();

  try {
    const { journeyId } = req.params;
    const { nodes, edges, canvas_state } = req.body;

    await client.query('BEGIN');

    // Update the raw canvas state JSON
    await client.query(
      'UPDATE journeys SET canvas_state = $1, updated_at = NOW() WHERE id = $2 AND sf_org_id = $3',
      [canvas_state || {}, journeyId, req.sfOrgId]
    );

    // Clear existing nodes and edges
    await client.query('DELETE FROM journey_edges WHERE journey_id = $1', [journeyId]);
    await client.query('DELETE FROM journey_nodes WHERE journey_id = $1', [journeyId]);

    // Re-insert nodes
    if (nodes && nodes.length > 0) {
      for (const node of nodes) {
        await client.query(
          `INSERT INTO journey_nodes (id, journey_id, node_type, position_x, position_y, config, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            node.id || uuidv4(),
            journeyId,
            node.node_type || node.type,
            node.position_x ?? node.position?.x ?? 0,
            node.position_y ?? node.position?.y ?? 0,
            node.config || node.data || {},
            node.sort_order || 0,
          ]
        );
      }
    }

    // Re-insert edges
    if (edges && edges.length > 0) {
      for (const edge of edges) {
        await client.query(
          `INSERT INTO journey_edges (id, journey_id, source_node_id, target_node_id, label, condition)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            edge.id || uuidv4(),
            journeyId,
            edge.source_node_id || edge.source,
            edge.target_node_id || edge.target,
            edge.label || null,
            edge.condition || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ saved: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Canvas] Bulk save error:', err.message);
    res.status(500).json({ error: 'Failed to save canvas' });
  } finally {
    client.release();
  }
});

module.exports = router;
