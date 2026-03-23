-- 001_create_journeys.sql
-- Core journey definitions table

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sf_campaign_id VARCHAR(18),
  sf_org_id VARCHAR(18) NOT NULL,
  sf_user_id VARCHAR(18) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'launching', 'published', 'active', 'paused', 'completed', 'failed')),
  canvas_state JSONB NOT NULL DEFAULT '{}',
  segment_object VARCHAR(50)
    CHECK (segment_object IS NULL OR segment_object IN ('Lead', 'Contact')),
  segment_filter JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_journeys_org ON journeys (sf_org_id);
CREATE INDEX idx_journeys_status ON journeys (status);
CREATE INDEX idx_journeys_campaign ON journeys (sf_campaign_id) WHERE sf_campaign_id IS NOT NULL;
