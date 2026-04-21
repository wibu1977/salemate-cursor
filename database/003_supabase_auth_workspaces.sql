-- Salemate: Supabase Auth + workspace owner_user_id
-- Chạy sau 001 (và 002 nếu có) trên cùng database Postgres.

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES app_users(id);

ALTER TABLE workspaces ALTER COLUMN owner_facebook_id DROP NOT NULL;

COMMENT ON COLUMN workspaces.owner_user_id IS 'Supabase auth.users.id (JWT sub)';
COMMENT ON COLUMN workspaces.owner_facebook_id IS 'Meta user id — nullable khi chủ workspace chỉ đăng nhập Supabase';
