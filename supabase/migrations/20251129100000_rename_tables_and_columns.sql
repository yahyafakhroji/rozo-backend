-- ============================================================================
-- Migration: Rename Tables and Columns for Clarity
-- Description:
--   1. merchant_wallets -> wallets
--   2. merchant_devices -> devices
--   3. privy_wallet_id -> external_wallet_id (in wallets table)
-- ============================================================================

-- ============================================================================
-- Step 1: Rename merchant_wallets to wallets
-- ============================================================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_ensure_single_primary_wallet ON "public"."merchant_wallets";

-- Rename the table
ALTER TABLE "public"."merchant_wallets" RENAME TO "wallets";

-- Rename constraint
ALTER TABLE "public"."wallets"
RENAME CONSTRAINT "merchant_wallets_unique_address" TO "wallets_unique_address";

-- Rename indexes
ALTER INDEX IF EXISTS "idx_merchant_wallets_merchant_id" RENAME TO "idx_wallets_merchant_id";
ALTER INDEX IF EXISTS "idx_merchant_wallets_chain_id" RENAME TO "idx_wallets_chain_id";
ALTER INDEX IF EXISTS "idx_merchant_wallets_primary" RENAME TO "idx_wallets_primary";
ALTER INDEX IF EXISTS "idx_merchant_wallets_privy_wallet_id" RENAME TO "idx_wallets_external_wallet_id";

-- Update table comment
COMMENT ON TABLE "public"."wallets" IS 'Wallet addresses per blockchain for merchants';

-- Recreate trigger with updated table reference
CREATE TRIGGER trigger_ensure_single_primary_wallet
    BEFORE INSERT OR UPDATE OF is_primary ON "public"."wallets"
    FOR EACH ROW
    WHEN (NEW.is_primary = true)
    EXECUTE FUNCTION ensure_single_primary_wallet();

-- Update the helper function to use new table name
CREATE OR REPLACE FUNCTION get_merchant_wallet_address(
    p_merchant_id UUID,
    p_chain_id TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_address TEXT;
BEGIN
    SELECT address INTO v_address
    FROM "public"."wallets"
    WHERE merchant_id = p_merchant_id
      AND chain_id = p_chain_id
      AND is_primary = true
    LIMIT 1;

    RETURN v_address;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update the trigger function to use new table name
CREATE OR REPLACE FUNCTION ensure_single_primary_wallet()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a wallet as primary, unset all other primaries for this merchant+chain
    IF NEW.is_primary = true THEN
        UPDATE "public"."wallets"
        SET is_primary = false, updated_at = now()
        WHERE merchant_id = NEW.merchant_id
          AND chain_id = NEW.chain_id
          AND wallet_id != NEW.wallet_id
          AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: Rename privy_wallet_id to external_wallet_id in wallets table
-- ============================================================================

ALTER TABLE "public"."wallets"
RENAME COLUMN "privy_wallet_id" TO "external_wallet_id";

-- Update column comment
COMMENT ON COLUMN "public"."wallets"."external_wallet_id" IS 'External wallet ID from provider (e.g., Privy) for server-side wallet operations';

-- ============================================================================
-- Step 3: Rename merchant_devices to devices
-- ============================================================================

-- Rename the table
ALTER TABLE "public"."merchant_devices" RENAME TO "devices";

-- Rename constraint (if exists)
ALTER TABLE "public"."devices"
RENAME CONSTRAINT "merchant_devices_pkey" TO "devices_pkey";

-- Rename indexes (if they exist)
ALTER INDEX IF EXISTS "idx_merchant_devices_merchant_id" RENAME TO "idx_devices_merchant_id";
ALTER INDEX IF EXISTS "merchant_devices_pkey" RENAME TO "devices_pkey";

-- Update table comment
COMMENT ON TABLE "public"."devices" IS 'FCM devices for push notifications';

-- ============================================================================
-- Step 4: Update RLS policies if they exist
-- ============================================================================

-- Drop and recreate policies for wallets table
DROP POLICY IF EXISTS "merchant_wallets_select_own" ON "public"."wallets";
DROP POLICY IF EXISTS "merchant_wallets_insert_own" ON "public"."wallets";
DROP POLICY IF EXISTS "merchant_wallets_update_own" ON "public"."wallets";
DROP POLICY IF EXISTS "merchant_wallets_delete_own" ON "public"."wallets";

-- Drop and recreate policies for devices table
DROP POLICY IF EXISTS "merchant_devices_select_own" ON "public"."devices";
DROP POLICY IF EXISTS "merchant_devices_insert_own" ON "public"."devices";
DROP POLICY IF EXISTS "merchant_devices_update_own" ON "public"."devices";
DROP POLICY IF EXISTS "merchant_devices_delete_own" ON "public"."devices";
