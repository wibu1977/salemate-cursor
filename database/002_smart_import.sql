-- Smart Import: product extra columns + saved mapping templates
-- Run in Supabase SQL Editor if not using SQLAlchemy create_all alone.

ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata_json JSONB;

CREATE TABLE IF NOT EXISTS import_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    entity VARCHAR(32) NOT NULL DEFAULT 'products',
    column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    duplicate_strategy VARCHAR(32) NOT NULL DEFAULT 'update',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_templates_workspace ON import_templates (workspace_id);
