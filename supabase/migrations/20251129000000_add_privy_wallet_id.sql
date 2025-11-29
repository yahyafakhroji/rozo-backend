-- ============================================================================
-- Migration: Add Privy Wallet ID to merchant_wallets
-- Description: Store Privy wallet ID for server-side wallet operations (balance lookup, etc.)
-- ============================================================================

-- Add privy_wallet_id column to merchant_wallets
ALTER TABLE "public"."merchant_wallets"
ADD COLUMN IF NOT EXISTS "privy_wallet_id" TEXT;

-- Add index for faster lookups by privy_wallet_id
CREATE INDEX IF NOT EXISTS "idx_merchant_wallets_privy_wallet_id"
ON "public"."merchant_wallets" ("privy_wallet_id")
WHERE "privy_wallet_id" IS NOT NULL;

-- Add comment
COMMENT ON COLUMN "public"."merchant_wallets"."privy_wallet_id" IS 'Privy wallet ID for server-side wallet operations';
