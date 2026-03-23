'use strict';

const db = require('../../../db');

/**
 * Process engagement sync jobs.
 * These are triggered when bulk engagement data needs to be aggregated
 * or when the real-time webhook pipeline needs catch-up processing.
 */
async function processSyncEngagement(job) {
  const { journeyId, batchId } = job.data;

  try {
    console.log(`[EngagementSync] Processing batch ${batchId || 'all'} for journey ${journeyId}`);

    // Aggregate stats per node
    const stats = await db.query(
      `SELECT
         node_id,
         event_type,
         COUNT(*) as count,
         MAX(occurred_at) as last_event
       FROM engagement_events
       WHERE journey_id = $1
       GROUP BY node_id, event_type`,
      [journeyId]
    );

    // Update journey canvas_state with aggregated stats
    const journey = await db.query(
      'SELECT canvas_state FROM journeys WHERE id = $1',
      [journeyId]
    );

    if (journey.rows.length > 0) {
      const canvasState = journey.rows[0].canvas_state || {};
      canvasState._stats = {};

      for (const row of stats.rows) {
        if (!row.node_id) continue;
        if (!canvasState._stats[row.node_id]) {
          canvasState._stats[row.node_id] = {};
        }
        canvasState._stats[row.node_id][row.event_type] = {
          count: parseInt(row.count, 10),
          lastEvent: row.last_event,
        };
      }

      await db.query(
        'UPDATE journeys SET canvas_state = $1, updated_at = NOW() WHERE id = $2',
        [canvasState, journeyId]
      );
    }

    return { processed: stats.rows.length };
  } catch (err) {
    console.error(`[EngagementSync] Failed for journey ${journeyId}:`, err.message);
    throw err;
  }
}

module.exports = { processSyncEngagement };
