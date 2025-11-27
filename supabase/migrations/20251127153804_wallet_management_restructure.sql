-- ============================================================================
-- Migration: Wallet Management Restructure
-- Description: Add chains table, merchant_wallets table, and migrate wallet data
-- ============================================================================

-- ============================================================================
-- Step 1: Create chains table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."chains" (
    "chain_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "chain_type" TEXT NOT NULL, -- 'evm', 'stellar', 'solana'
    "icon_url" TEXT,
    "explorer_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment
COMMENT ON TABLE "public"."chains" IS 'Supported blockchain networks';

-- ============================================================================
-- Step 2: Insert initial chain data
-- ============================================================================
INSERT INTO "public"."chains" ("chain_id", "name", "chain_type", "icon_url", "explorer_url", "is_active")
VALUES
    ('8453', 'Base', 'evm', NULL, 'https://basescan.org', true),
    ('stellar', 'Stellar', 'stellar', NULL, 'https://stellar.expert/explorer/public', true)
ON CONFLICT ("chain_id") DO NOTHING;

-- ============================================================================
-- Step 3: Create merchant_wallets table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."merchant_wallets" (
    "wallet_id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    "merchant_id" UUID NOT NULL REFERENCES "public"."merchants"("merchant_id") ON DELETE CASCADE,
    "chain_id" TEXT NOT NULL REFERENCES "public"."chains"("chain_id") ON DELETE RESTRICT,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "source" TEXT NOT NULL DEFAULT 'privy', -- 'privy', 'manual'
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- Prevent duplicate addresses per merchant per chain
    CONSTRAINT "merchant_wallets_unique_address" UNIQUE ("merchant_id", "chain_id", "address")
);

-- Add comment
COMMENT ON TABLE "public"."merchant_wallets" IS 'Merchant wallet addresses per blockchain';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_merchant_wallets_merchant_id" ON "public"."merchant_wallets" ("merchant_id");
CREATE INDEX IF NOT EXISTS "idx_merchant_wallets_chain_id" ON "public"."merchant_wallets" ("chain_id");
CREATE INDEX IF NOT EXISTS "idx_merchant_wallets_primary" ON "public"."merchant_wallets" ("merchant_id", "chain_id", "is_primary") WHERE "is_primary" = true;

-- ============================================================================
-- Step 4: Update tokens table to reference chains
-- ============================================================================
-- Add new columns if they don't exist
ALTER TABLE "public"."tokens" ADD COLUMN IF NOT EXISTS "icon_url" TEXT;
ALTER TABLE "public"."tokens" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."tokens" ADD COLUMN IF NOT EXISTS "decimals" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "public"."tokens" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE "public"."tokens" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add foreign key to chains table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tokens_chain_id_fkey'
        AND table_name = 'tokens'
    ) THEN
        -- First, ensure all existing chain_ids exist in chains table
        INSERT INTO "public"."chains" ("chain_id", "name", "chain_type", "is_active")
        SELECT DISTINCT t.chain_id, t.chain_name,
            CASE
                WHEN t.chain_id = 'stellar' THEN 'stellar'
                ELSE 'evm'
            END,
            true
        FROM "public"."tokens" t
        WHERE NOT EXISTS (SELECT 1 FROM "public"."chains" c WHERE c.chain_id = t.chain_id)
        ON CONFLICT ("chain_id") DO NOTHING;

        -- Now add the foreign key
        ALTER TABLE "public"."tokens"
        ADD CONSTRAINT "tokens_chain_id_fkey"
        FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("chain_id") ON DELETE RESTRICT;
    END IF;
END $$;

-- ============================================================================
-- Step 5: Migrate existing wallet data from merchants to merchant_wallets
-- ============================================================================
-- Migrate wallet_address (Base chain)
INSERT INTO "public"."merchant_wallets" ("merchant_id", "chain_id", "address", "source", "is_primary", "is_verified")
SELECT
    m.merchant_id,
    '8453' as chain_id, -- Base chain ID
    m.wallet_address,
    'privy' as source,
    true as is_primary,
    true as is_verified
FROM "public"."merchants" m
WHERE m.wallet_address IS NOT NULL AND m.wallet_address != ''
ON CONFLICT ("merchant_id", "chain_id", "address") DO NOTHING;

-- Migrate stellar_address (Stellar chain)
INSERT INTO "public"."merchant_wallets" ("merchant_id", "chain_id", "address", "source", "is_primary", "is_verified")
SELECT
    m.merchant_id,
    'stellar' as chain_id,
    m.stellar_address,
    'manual' as source,
    true as is_primary,
    false as is_verified
FROM "public"."merchants" m
WHERE m.stellar_address IS NOT NULL AND m.stellar_address != ''
ON CONFLICT ("merchant_id", "chain_id", "address") DO NOTHING;

-- ============================================================================
-- Step 6: Create function to ensure only one primary wallet per merchant per chain
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_single_primary_wallet()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a wallet as primary, unset all other primaries for this merchant+chain
    IF NEW.is_primary = true THEN
        UPDATE "public"."merchant_wallets"
        SET is_primary = false, updated_at = now()
        WHERE merchant_id = NEW.merchant_id
          AND chain_id = NEW.chain_id
          AND wallet_id != NEW.wallet_id
          AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_primary_wallet ON "public"."merchant_wallets";
CREATE TRIGGER trigger_ensure_single_primary_wallet
    BEFORE INSERT OR UPDATE OF is_primary ON "public"."merchant_wallets"
    FOR EACH ROW
    WHEN (NEW.is_primary = true)
    EXECUTE FUNCTION ensure_single_primary_wallet();

-- ============================================================================
-- Step 7: Create helper function to get merchant wallet by chain
-- ============================================================================
CREATE OR REPLACE FUNCTION get_merchant_wallet_address(
    p_merchant_id UUID,
    p_chain_id TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_address TEXT;
BEGIN
    SELECT address INTO v_address
    FROM "public"."merchant_wallets"
    WHERE merchant_id = p_merchant_id
      AND chain_id = p_chain_id
      AND is_primary = true
    LIMIT 1;

    RETURN v_address;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Note: wallet_address and stellar_address columns are kept for now
-- They will be dropped in a future migration after code is fully migrated
-- ============================================================================
-- Future migration will include:
-- ALTER TABLE "public"."merchants" DROP COLUMN IF EXISTS "wallet_address";
-- ALTER TABLE "public"."merchants" DROP COLUMN IF EXISTS "stellar_address";
