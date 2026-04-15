-- ============================================
-- SALEMATE V1 - Hybrid Clustering Migration
-- Adds CustomerSegment table + FK columns
-- Run AFTER 001_initial_schema.sql
-- ============================================

-- New table: immutable segment snapshots per clustering run
CREATE TABLE customer_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    cluster_key VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    recommendation TEXT,

    customer_count INTEGER DEFAULT 0,
    avg_orders FLOAT DEFAULT 0.0,
    avg_spent FLOAT DEFAULT 0.0,
    avg_recency_days FLOAT DEFAULT 0.0,

    is_latest BOOLEAN DEFAULT TRUE,
    run_id VARCHAR(36) NOT NULL,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_segments_workspace ON customer_segments(workspace_id);
CREATE INDEX idx_segments_latest ON customer_segments(workspace_id, is_latest) WHERE is_latest = TRUE;
CREATE INDEX idx_segments_run ON customer_segments(run_id);

-- Add segment FK to customers (nullable, backward compat)
ALTER TABLE customers ADD COLUMN segment_id UUID REFERENCES customer_segments(id);
CREATE INDEX idx_customers_segment ON customers(segment_id);

-- Add target_segment FK to campaigns (nullable, backward compat)
ALTER TABLE campaigns ADD COLUMN target_segment_id UUID REFERENCES customer_segments(id);
ALTER TABLE campaigns ALTER COLUMN target_cluster DROP NOT NULL;
CREATE INDEX idx_campaigns_segment ON campaigns(target_segment_id);
