-- 003_create_engagement_events.sql
-- Email engagement events (populated by webhooks from Salesforce)
-- and deployment logs for the launch orchestration sequence

CREATE TABLE IF NOT EXISTS engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id),
  node_id UUID REFERENCES journey_nodes(id),
  event_type VARCHAR(50) NOT NULL
    CHECK (event_type IN ('open', 'click', 'bounce', 'unsubscribe', 'delivered', 'dropped')),
  contact_id VARCHAR(18),
  lead_id VARCHAR(18),
  email VARCHAR(255),
  metadata JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES journeys(id),
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  sf_resource_id VARCHAR(18),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for engagement queries
CREATE INDEX idx_engagement_journey ON engagement_events (journey_id);
CREATE INDEX idx_engagement_node ON engagement_events (node_id);
CREATE INDEX idx_engagement_type ON engagement_events (event_type);
CREATE INDEX idx_engagement_occurred ON engagement_events (occurred_at DESC);
CREATE INDEX idx_deployment_journey ON deployment_logs (journey_id);
