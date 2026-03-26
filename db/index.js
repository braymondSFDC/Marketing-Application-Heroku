'use strict';

// ---------------------------------------------------------------------------
// Database layer — Postgres if DATABASE_URL is set, in-memory otherwise
// ---------------------------------------------------------------------------

const hasDatabase = !!process.env.DATABASE_URL;

if (hasDatabase) {
  // ── Postgres mode ──
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err.message);
  });

  async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.slice(0, 120));
    }
    return result;
  }

  async function getClient() {
    return pool.connect();
  }

  console.log('[DB] Using PostgreSQL');
  module.exports = { query, getClient, pool, mode: 'postgres' };

} else {
  // ── In-memory mode ──
  // Simple in-memory storage for when no database is configured.
  // Data persists only during the dyno lifetime.
  const { v4: uuidv4 } = require('uuid');

  const store = {
    journeys: [],
    journey_nodes: [],
    journey_edges: [],
    engagement_events: [],
    deployment_logs: [],
  };

  /**
   * Minimal SQL-like query parser for the journey builder's queries.
   * Only supports the exact patterns used by the route handlers.
   */
  async function query(text, params) {
    const sql = text.replace(/\s+/g, ' ').trim();

    // ── Transaction commands (no-op in memory) ──
    if (/^BEGIN/i.test(sql) || /^COMMIT/i.test(sql) || /^ROLLBACK/i.test(sql)) {
      return { rows: [] };
    }

    // ── SELECT 1 (health check) ──
    if (/SELECT 1/i.test(sql)) {
      return { rows: [{ ok: 1 }] };
    }

    // ── INSERT INTO journeys ──
    if (/INSERT INTO journeys/i.test(sql)) {
      const journey = {
        id: params[0],
        name: params[1],
        sf_org_id: params[2],
        sf_user_id: params[3],
        segment_object: params[4] || null,
        segment_filter: params[5] || null,
        canvas_state: params[6] || {},
        status: 'draft',
        sf_campaign_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.journeys.push(journey);
      return { rows: [journey] };
    }

    // ── INSERT INTO engagement_events ──
    if (/INSERT INTO engagement_events/i.test(sql)) {
      const event = {
        id: uuidv4(),
        journey_id: params[0] || null,
        node_id: params[1] || null,
        event_type: params[2],
        contact_id: params[3] || null,
        lead_id: params[4] || null,
        email: params[5] || null,
        metadata: params[6] || null,
        occurred_at: params[7] || new Date().toISOString(),
      };
      store.engagement_events.push(event);
      return { rows: [event] };
    }

    // ── SELECT ... FROM engagement_events ... GROUP BY event_type ──
    if (/FROM engagement_events.*GROUP BY/i.test(sql)) {
      const events = store.engagement_events.filter(e => e.journey_id === params[0]);
      // Check if grouping by node_id too
      if (/GROUP BY node_id/i.test(sql)) {
        const groups = {};
        for (const e of events) {
          if (!e.node_id) continue;
          const key = `${e.node_id}:${e.event_type}`;
          if (!groups[key]) groups[key] = { node_id: e.node_id, event_type: e.event_type, count: 0 };
          groups[key].count++;
        }
        return { rows: Object.values(groups) };
      } else {
        const groups = {};
        for (const e of events) {
          if (!groups[e.event_type]) groups[e.event_type] = { event_type: e.event_type, count: 0 };
          groups[e.event_type].count++;
        }
        return { rows: Object.values(groups) };
      }
    }

    // ── INSERT INTO deployment_logs ──
    if (/INSERT INTO deployment_logs/i.test(sql)) {
      // Extract hardcoded string values from the SQL (e.g. 'launch_initiated', 'pending')
      const hardcoded = sql.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
      const log = {
        id: uuidv4(),
        journey_id: params[0],
        action: params[1] || hardcoded[0] || 'unknown',
        status: params[2] || hardcoded[1] || 'pending',
        sf_resource_id: null,
        error_message: null,
        created_at: new Date().toISOString(),
      };
      store.deployment_logs.push(log);
      return { rows: [log] };
    }

    // ── SELECT ... FROM deployment_logs WHERE journey_id ──
    if (/FROM deployment_logs WHERE journey_id/i.test(sql)) {
      const rows = store.deployment_logs
        .filter(l => l.journey_id === params[0])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);
      return { rows };
    }

    // ── SELECT * FROM journeys WHERE id = $1 AND sf_org_id = $2 ──
    if (/SELECT \* FROM journeys WHERE id/i.test(sql)) {
      const rows = store.journeys.filter(j => j.id === params[0] && j.sf_org_id === params[1]);
      return { rows };
    }

    // ── SELECT id FROM journeys WHERE id = $1 AND sf_org_id = $2 ──
    if (/SELECT id FROM journeys WHERE id/i.test(sql)) {
      const rows = store.journeys
        .filter(j => j.id === params[0] && j.sf_org_id === params[1])
        .map(j => ({ id: j.id }));
      return { rows };
    }

    // ── SELECT id, status FROM journeys WHERE id ──
    if (/SELECT id,\s*status FROM journeys WHERE id/i.test(sql)) {
      const rows = store.journeys
        .filter(j => j.id === params[0] && j.sf_org_id === params[1])
        .map(j => ({ id: j.id, status: j.status }));
      return { rows };
    }

    // ── SELECT status FROM journeys WHERE id ──
    if (/SELECT status FROM journeys WHERE id/i.test(sql)) {
      const rows = store.journeys
        .filter(j => j.id === params[0] && j.sf_org_id === params[1])
        .map(j => ({ status: j.status }));
      return { rows };
    }

    // ── SELECT ... FROM journeys WHERE sf_org_id = $1 ORDER BY ──
    if (/FROM journeys\s+WHERE sf_org_id/i.test(sql)) {
      const rows = store.journeys
        .filter(j => j.sf_org_id === params[0])
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return { rows };
    }

    // ── UPDATE journeys SET canvas_state = $1 ... WHERE id = $2 AND sf_org_id = $3 ──
    // (canvas bulk-save — 3 params)
    if (/UPDATE journeys SET canvas_state/i.test(sql) && params && params.length === 3) {
      const idx = store.journeys.findIndex(j => j.id === params[1] && j.sf_org_id === params[2]);
      if (idx >= 0) {
        store.journeys[idx].canvas_state = params[0];
        store.journeys[idx].updated_at = new Date().toISOString();
        return { rows: [store.journeys[idx]] };
      }
      return { rows: [] };
    }

    // ── UPDATE journeys SET status = 'launching' WHERE id = $1 ──
    // (launch route — 1 param, status hardcoded in SQL)
    if (/UPDATE journeys SET status\s*=/i.test(sql) && params && params.length === 1) {
      const statusMatch = sql.match(/status\s*=\s*'([^']+)'/i);
      const newStatus = statusMatch ? statusMatch[1] : 'launching';
      const idx = store.journeys.findIndex(j => j.id === params[0]);
      if (idx >= 0) {
        store.journeys[idx].status = newStatus;
        store.journeys[idx].updated_at = new Date().toISOString();
        return { rows: [store.journeys[idx]] };
      }
      return { rows: [] };
    }

    // ── UPDATE journeys SET (full update — 7 params) ──
    if (/UPDATE journeys/i.test(sql) && params && params.length >= 7) {
      // params: [name, segment_object, segment_filter, canvas_state, status, id, sf_org_id]
      const idx = store.journeys.findIndex(j => j.id === params[5] && j.sf_org_id === params[6]);
      if (idx >= 0) {
        const j = store.journeys[idx];
        if (params[0] != null) j.name = params[0];
        if (params[1] != null) j.segment_object = params[1];
        if (params[2] != null) j.segment_filter = params[2];
        if (params[3] != null) j.canvas_state = params[3];
        if (params[4] != null) j.status = params[4];
        j.updated_at = new Date().toISOString();
        return { rows: [j] };
      }
      return { rows: [] };
    }

    // ── UPDATE journeys (generic fallback for any other param count) ──
    if (/UPDATE journeys/i.test(sql)) {
      console.warn('[DB:memory] UPDATE journeys with unexpected params:', params?.length);
      return { rows: [] };
    }

    // ── DELETE FROM journeys ──
    if (/DELETE FROM journeys WHERE id/i.test(sql)) {
      const id = params[0];
      store.journeys = store.journeys.filter(j => j.id !== id);
      store.journey_nodes = store.journey_nodes.filter(n => n.journey_id !== id);
      store.journey_edges = store.journey_edges.filter(e => e.journey_id !== id);
      return { rows: [] };
    }

    // ── UPDATE journey_nodes SET ... WHERE id = $5 AND journey_id = $6 ──
    if (/UPDATE journey_nodes/i.test(sql)) {
      // params: [position_x, position_y, config, sort_order, nodeId, journeyId]
      const idx = store.journey_nodes.findIndex(
        n => n.id === params[4] && n.journey_id === params[5]
      );
      if (idx >= 0) {
        const n = store.journey_nodes[idx];
        if (params[0] != null) n.position_x = params[0];
        if (params[1] != null) n.position_y = params[1];
        if (params[2] != null) n.config = params[2];
        if (params[3] != null) n.sort_order = params[3];
        return { rows: [n] };
      }
      return { rows: [] };
    }

    // ── DELETE FROM journey_nodes WHERE id = $1 AND journey_id = $2 ──
    if (/DELETE FROM journey_nodes WHERE id/i.test(sql)) {
      const before = store.journey_nodes.length;
      store.journey_nodes = store.journey_nodes.filter(
        n => !(n.id === params[0] && n.journey_id === params[1])
      );
      // Also remove edges connected to this node
      store.journey_edges = store.journey_edges.filter(
        e => e.source_node_id !== params[0] && e.target_node_id !== params[0]
      );
      const deleted = before > store.journey_nodes.length;
      return { rows: deleted ? [{ id: params[0] }] : [] };
    }

    // ── DELETE FROM journey_nodes WHERE journey_id ──
    if (/DELETE FROM journey_nodes WHERE journey_id/i.test(sql)) {
      store.journey_nodes = store.journey_nodes.filter(n => n.journey_id !== params[0]);
      return { rows: [] };
    }

    // ── DELETE FROM journey_edges WHERE id = $1 AND journey_id = $2 ──
    if (/DELETE FROM journey_edges WHERE id/i.test(sql)) {
      const before = store.journey_edges.length;
      store.journey_edges = store.journey_edges.filter(
        e => !(e.id === params[0] && e.journey_id === params[1])
      );
      const deleted = before > store.journey_edges.length;
      return { rows: deleted ? [{ id: params[0] }] : [] };
    }

    // ── DELETE FROM journey_edges WHERE journey_id ──
    if (/DELETE FROM journey_edges WHERE journey_id/i.test(sql)) {
      store.journey_edges = store.journey_edges.filter(e => e.journey_id !== params[0]);
      return { rows: [] };
    }

    // ── SELECT * FROM journey_nodes ──
    if (/FROM journey_nodes WHERE journey_id/i.test(sql)) {
      const rows = store.journey_nodes
        .filter(n => n.journey_id === params[0])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      return { rows };
    }

    // ── SELECT * FROM journey_edges ──
    if (/FROM journey_edges WHERE journey_id/i.test(sql)) {
      const rows = store.journey_edges.filter(e => e.journey_id === params[0]);
      return { rows };
    }

    // ── INSERT INTO journey_nodes ──
    if (/INSERT INTO journey_nodes/i.test(sql)) {
      const node = {
        id: params[0],
        journey_id: params[1],
        node_type: params[2],
        position_x: params[3] || 0,
        position_y: params[4] || 0,
        config: params[5] || {},
        sort_order: params[6] || 0,
        created_at: new Date().toISOString(),
      };
      store.journey_nodes.push(node);
      return { rows: [node] };
    }

    // ── INSERT INTO journey_edges ──
    if (/INSERT INTO journey_edges/i.test(sql)) {
      const edge = {
        id: params[0],
        journey_id: params[1],
        source_node_id: params[2],
        target_node_id: params[3],
        label: params[4] || null,
        condition: params[5] || null,
      };
      store.journey_edges.push(edge);
      return { rows: [edge] };
    }

    // ── information_schema (for health check) ──
    if (/information_schema\.tables/i.test(sql)) {
      return { rows: Object.keys(store).map(t => ({ table_name: t })) };
    }

    // ── _migrations (for health check) ──
    if (/FROM _migrations/i.test(sql)) {
      return { rows: [] };
    }

    // ── CREATE TABLE / CREATE INDEX / CREATE EXTENSION (migration no-ops) ──
    if (/^CREATE /i.test(sql)) {
      return { rows: [] };
    }

    // ── Fallback — return empty result ──
    console.warn('[DB:memory] Unhandled query:', sql.slice(0, 120));
    return { rows: [] };
  }

  async function getClient() {
    // Return a mock client for migration compatibility
    return {
      query: async (text, params) => query(text, params),
      release: () => {},
    };
  }

  console.log('[DB] Using in-memory storage (no DATABASE_URL configured)');
  module.exports = { query, getClient, pool: null, mode: 'memory' };
}
