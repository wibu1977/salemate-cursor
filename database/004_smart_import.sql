-- Smart import: product metadata for unmapped columns + workspace import templates
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata_json JSONB;

CREATE TABLE IF NOT EXISTS import_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity VARCHAR(50) NOT NULL DEFAULT 'products',
    name VARCHAR(100) NOT NULL DEFAULT 'default',
    mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_import_templates_workspace_entity_name UNIQUE (workspace_id, entity, name)
);

CREATE INDEX IF NOT EXISTS idx_import_templates_workspace ON import_templates(workspace_id);
