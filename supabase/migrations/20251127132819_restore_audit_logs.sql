-- Migration: Restore audit_logs table
-- Description: Recreates the audit_logs table for tracking sensitive operations

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES public.merchants(merchant_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.audit_logs IS 'Tracks sensitive operations for security and compliance auditing';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action performed (e.g., PIN_SET, WALLET_TRANSFER_COMPLETED)';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource affected (merchant, order, deposit, withdrawal, device, wallet, pin)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context about the action';

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON public.audit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_created ON public.audit_logs(merchant_id, created_at DESC);

-- Grant permissions to service_role only (audit logs should not be accessible by anon/authenticated)
GRANT SELECT, INSERT ON public.audit_logs TO service_role;

-- Revoke permissions from anon and authenticated (security best practice)
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM authenticated;
