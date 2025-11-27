-- Migration: Add Performance Indexes
-- Description: Adds indexes for frequently queried columns to improve query performance

-- ============================================================================
-- Merchants Table Indexes
-- ============================================================================

-- Index for looking up merchants by dynamic_id (primary auth method)
CREATE INDEX IF NOT EXISTS idx_merchants_dynamic_id
ON merchants(dynamic_id)
WHERE dynamic_id IS NOT NULL;

-- Index for looking up merchants by privy_id (secondary auth method)
CREATE INDEX IF NOT EXISTS idx_merchants_privy_id
ON merchants(privy_id)
WHERE privy_id IS NOT NULL;

-- Index for filtering merchants by status
CREATE INDEX IF NOT EXISTS idx_merchants_status
ON merchants(status);

-- ============================================================================
-- Orders Table Indexes
-- ============================================================================

-- Composite index for merchant order listings (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_orders_merchant_status_created
ON orders(merchant_id, status, created_at DESC);

-- Index for payment callback lookups by order number
CREATE INDEX IF NOT EXISTS idx_orders_number
ON orders(number);

-- Index for payment callback lookups by payment_id
CREATE INDEX IF NOT EXISTS idx_orders_payment_id
ON orders(payment_id);

-- Index for expired order cleanup job
CREATE INDEX IF NOT EXISTS idx_orders_status_expired_at
ON orders(status, expired_at)
WHERE status = 'PENDING';

-- ============================================================================
-- Deposits Table Indexes
-- ============================================================================

-- Composite index for merchant deposit listings
CREATE INDEX IF NOT EXISTS idx_deposits_merchant_status_created
ON deposits(merchant_id, status, created_at DESC);

-- Index for payment callback lookups by deposit number
CREATE INDEX IF NOT EXISTS idx_deposits_number
ON deposits(number);

-- Index for payment callback lookups by payment_id
CREATE INDEX IF NOT EXISTS idx_deposits_payment_id
ON deposits(payment_id);

-- ============================================================================
-- Withdrawals Table Indexes
-- ============================================================================

-- Composite index for merchant withdrawal listings
CREATE INDEX IF NOT EXISTS idx_withdrawals_merchant_created
ON withdrawals(merchant_id, created_at DESC);

-- ============================================================================
-- Merchant Devices Table Indexes
-- ============================================================================

-- Index for looking up devices by merchant (for notifications)
CREATE INDEX IF NOT EXISTS idx_merchant_devices_merchant_id
ON merchant_devices(merchant_id);

-- ============================================================================
-- Currency Rates Table Indexes (if exists)
-- ============================================================================

-- Index for looking up currency rates
CREATE INDEX IF NOT EXISTS idx_currency_rates_currency
ON currency_rates(currency)
WHERE currency IS NOT NULL;

-- ============================================================================
-- Audit Logs Table (create if not exists)
-- ============================================================================

-- Create audit_logs table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(merchant_id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying audit logs by merchant
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id
ON audit_logs(merchant_id, created_at DESC);

-- Index for filtering audit logs by action
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
ON audit_logs(action, created_at DESC);

-- ============================================================================
-- Rate Limiting Table (create if not exists)
-- ============================================================================

-- Create rate_limits table for tracking request rates
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- merchant_id or IP address
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(identifier, endpoint)
);

-- Index for looking up rate limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint
ON rate_limits(identifier, endpoint);

-- Index for cleaning up old rate limit entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
ON rate_limits(window_start);

-- ============================================================================
-- Add Comments for Documentation
-- ============================================================================

COMMENT ON INDEX idx_merchants_dynamic_id IS 'Speeds up merchant lookup during Dynamic auth';
COMMENT ON INDEX idx_merchants_privy_id IS 'Speeds up merchant lookup during Privy auth';
COMMENT ON INDEX idx_orders_merchant_status_created IS 'Optimizes order listing queries with status filter';
COMMENT ON INDEX idx_orders_number IS 'Speeds up payment callback order lookup by number';
COMMENT ON INDEX idx_deposits_number IS 'Speeds up payment callback deposit lookup by number';
COMMENT ON TABLE audit_logs IS 'Tracks sensitive operations for security and compliance';
COMMENT ON TABLE rate_limits IS 'Tracks request rates for rate limiting';
