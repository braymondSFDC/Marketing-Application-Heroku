-- 002_create_nodes_edges.sql
-- Journey nodes (each step) and edges (connections)

CREATE TABLE IF NOT EXISTS journey_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  node_type VARCHAR(50) NOT NULL
    CHECK (node_type IN ('trigger', 'email', 'wait', 'split', 'condition', 'update', 'webhook', 'exit')),
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  sf_resource_id VARCHAR(18),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES journey_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES journey_nodes(id) ON DELETE CASCADE,
  label VARCHAR(100),
  condition JSONB
);

-- Indexes
CREATE INDEX idx_nodes_journey ON journey_nodes (journey_id);
CREATE INDEX idx_nodes_type ON journey_nodes (node_type);
CREATE INDEX idx_edges_journey ON journey_edges (journey_id);
CREATE INDEX idx_edges_source ON journey_edges (source_node_id);
CREATE INDEX idx_edges_target ON journey_edges (target_node_id);
