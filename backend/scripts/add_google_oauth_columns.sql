-- Chạy trên Postgres hiện có nếu đã có bảng workspaces / chưa có cột OAuth.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    kind VARCHAR(50) NOT NULL DEFAULT 'sheets_products',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    result_json JSONB,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS ix_import_jobs_workspace_id ON import_jobs (workspace_id);
CREATE INDEX IF NOT EXISTS ix_import_jobs_status ON import_jobs (status);
