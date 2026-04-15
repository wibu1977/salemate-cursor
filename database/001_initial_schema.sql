-- ============================================
-- SALEMATE V1 - Initial Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- WORKSPACES
-- ============================================
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner_facebook_id VARCHAR(100) UNIQUE NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255),
    ai_system_prompt TEXT,
    report_hour INTEGER DEFAULT 9,
    language VARCHAR(10) DEFAULT 'vi',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workspaces_owner ON workspaces(owner_facebook_id);

-- ============================================
-- SHOP PAGES
-- ============================================
CREATE TABLE shop_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    page_id VARCHAR(100) UNIQUE NOT NULL,
    page_name VARCHAR(255) NOT NULL,
    page_access_token TEXT NOT NULL,
    platform VARCHAR(20) DEFAULT 'facebook',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shop_pages_workspace ON shop_pages(workspace_id);
CREATE INDEX idx_shop_pages_page_id ON shop_pages(page_id);

-- ============================================
-- CUSTOMERS (Single Customer View)
-- ============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    email VARCHAR(255),
    name VARCHAR(255),
    facebook_psid VARCHAR(100),
    instagram_psid VARCHAR(100),
    cluster VARCHAR(50),
    total_orders INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    last_order_at TIMESTAMP,
    metadata_json JSONB,
    opted_in_recurring BOOLEAN DEFAULT FALSE,
    recurring_token TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_workspace ON customers(workspace_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_fb_psid ON customers(facebook_psid);
CREATE INDEX idx_customers_ig_psid ON customers(instagram_psid);
CREATE INDEX idx_customers_cluster ON customers(workspace_id, cluster);

-- ============================================
-- PRODUCTS (Inventory)
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price INTEGER DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'KRW',
    quantity INTEGER DEFAULT 0,
    stock_threshold INTEGER DEFAULT 5,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    embedding vector(1536),
    sheets_row_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- ORDERS
-- ============================================
CREATE TYPE order_status AS ENUM (
    'pending', 'payment_sent', 'confirmed',
    'flagged', 'rejected', 'cancelled', 'completed'
);

CREATE TYPE payment_method AS ENUM ('toss', 'bank_transfer', 'ocr_verified');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    memo_code VARCHAR(20) UNIQUE NOT NULL,
    status order_status DEFAULT 'pending',
    payment_method payment_method,
    total_amount INTEGER DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'KRW',
    customer_phone VARCHAR(20),
    customer_address TEXT,
    customer_note TEXT,
    toss_payment_key VARCHAR(200),
    bill_image_url TEXT,
    bill_image_hash VARCHAR(64),
    ocr_data JSONB,
    flag_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_workspace ON orders(workspace_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_memo ON orders(memo_code);
CREATE INDEX idx_orders_status ON orders(workspace_id, status);
CREATE INDEX idx_orders_bill_hash ON orders(bill_image_hash);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price INTEGER DEFAULT 0,
    subtotal INTEGER DEFAULT 0
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- CAMPAIGNS
-- ============================================
CREATE TYPE campaign_status AS ENUM (
    'draft', 'pending_approval', 'approved',
    'sending', 'completed', 'cancelled'
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_cluster VARCHAR(50) NOT NULL,
    status campaign_status DEFAULT 'draft',
    message_template TEXT NOT NULL,
    ai_generated BOOLEAN DEFAULT TRUE,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);

-- ============================================
-- CAMPAIGN MESSAGES
-- ============================================
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    meta_message_id VARCHAR(200)
);

CREATE INDEX idx_campaign_messages_campaign ON campaign_messages(campaign_id);

-- ============================================
-- FRAUD LOGS
-- ============================================
CREATE TYPE fraud_check_result AS ENUM ('pass', 'flag', 'reject');

CREATE TABLE fraud_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL,
    result fraud_check_result NOT NULL,
    details TEXT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fraud_logs_order ON fraud_logs(order_id);

-- ============================================
-- CONVERSATIONS (AI Chatbot State)
-- ============================================
CREATE TYPE conversation_state AS ENUM (
    'greeting', 'consulting', 'collecting_order',
    'awaiting_payment', 'completed'
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    page_id VARCHAR(100) NOT NULL,
    platform VARCHAR(20) DEFAULT 'facebook',
    state conversation_state DEFAULT 'greeting',
    order_id UUID REFERENCES orders(id),
    context JSONB,
    last_message_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
