-- Migration: Remove Dynamic authentication
-- Description: Drop dynamic_id column and related indexes as the project has fully migrated to Privy

-- Step 1: Drop any indexes on dynamic_id
DROP INDEX IF EXISTS "public"."merchants_dynamic_id_idx";
DROP INDEX IF EXISTS "public"."idx_merchants_dynamic_id";

-- Step 2: Drop the unique constraint on dynamic_id if it exists
ALTER TABLE "public"."merchants"
DROP CONSTRAINT IF EXISTS "merchants_dynamic_id_key";

-- Step 3: Make privy_id required (NOT NULL) for all new merchants
-- First, ensure all existing merchants have a privy_id
-- Note: This will fail if there are merchants without privy_id - you should migrate them first
DO $$
BEGIN
  -- Check if there are merchants without privy_id
  IF EXISTS (SELECT 1 FROM "public"."merchants" WHERE privy_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot make privy_id NOT NULL: There are merchants without privy_id. Please migrate them first.';
  END IF;
END $$;

-- Step 4: Add NOT NULL constraint to privy_id
ALTER TABLE "public"."merchants"
ALTER COLUMN privy_id SET NOT NULL;

-- Step 5: Add unique constraint on privy_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchants_privy_id_key' AND conrelid = 'public.merchants'::regclass
  ) THEN
    ALTER TABLE "public"."merchants" ADD CONSTRAINT "merchants_privy_id_key" UNIQUE ("privy_id");
  END IF;
END $$;

-- Step 6: Drop dynamic_id column
ALTER TABLE "public"."merchants"
DROP COLUMN IF EXISTS "dynamic_id";

-- Step 7: Add comment to document the change
COMMENT ON TABLE "public"."merchants" IS 'Merchant accounts - authenticated via Privy';
COMMENT ON COLUMN "public"."merchants"."privy_id" IS 'Privy user ID (required, unique) - primary authentication identifier';
