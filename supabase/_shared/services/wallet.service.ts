/**
 * Wallet Service
 * Handles merchant wallet operations with the new wallet management system
 */

import type {
  MerchantWalletData,
  MerchantWalletResult,
  AddMerchantWalletRequest,
  UpdateMerchantWalletRequest,
  ChainData,
  TokenData,
  TypedSupabaseClient,
} from "../types/common.types.ts";

// ============================================================================
// Chain Operations
// ============================================================================

/**
 * Get all active chains
 */
export async function getActiveChains(
  supabase: TypedSupabaseClient,
): Promise<{ success: boolean; chains?: ChainData[]; error?: string }> {
  try {
    const { data: chains, error } = await supabase
      .from("chains")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, chains: chains as ChainData[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch chains",
    };
  }
}

/**
 * Get chain by ID
 */
export async function getChainById(
  supabase: TypedSupabaseClient,
  chainId: string,
): Promise<{ success: boolean; chain?: ChainData; error?: string }> {
  try {
    const { data: chain, error } = await supabase
      .from("chains")
      .select("*")
      .eq("chain_id", chainId)
      .single();

    if (error || !chain) {
      return { success: false, error: "Chain not found" };
    }

    return { success: true, chain: chain as ChainData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch chain",
    };
  }
}

// ============================================================================
// Wallet Operations
// ============================================================================

/**
 * Get all wallets for a merchant
 */
export async function getMerchantWallets(
  supabase: TypedSupabaseClient,
  merchantId: string,
): Promise<MerchantWalletResult> {
  try {
    const { data: wallets, error } = await supabase
      .from("merchant_wallets")
      .select(`
        *,
        chain:chains(*)
      `)
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, wallets: wallets as MerchantWalletData[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch wallets",
    };
  }
}

/**
 * Get merchant's primary wallet for a specific chain
 */
export async function getMerchantWalletByChain(
  supabase: TypedSupabaseClient,
  merchantId: string,
  chainId: string,
): Promise<MerchantWalletResult> {
  try {
    const { data: wallet, error } = await supabase
      .from("merchant_wallets")
      .select(`
        *,
        chain:chains(*)
      `)
      .eq("merchant_id", merchantId)
      .eq("chain_id", chainId)
      .eq("is_primary", true)
      .single();

    if (error || !wallet) {
      return { success: false, error: `No primary wallet found for chain ${chainId}` };
    }

    return { success: true, wallet: wallet as MerchantWalletData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch wallet",
    };
  }
}

/**
 * Get wallet by ID
 */
export async function getWalletById(
  supabase: TypedSupabaseClient,
  walletId: string,
  merchantId: string,
): Promise<MerchantWalletResult> {
  try {
    const { data: wallet, error } = await supabase
      .from("merchant_wallets")
      .select(`
        *,
        chain:chains(*)
      `)
      .eq("wallet_id", walletId)
      .eq("merchant_id", merchantId)
      .single();

    if (error || !wallet) {
      return { success: false, error: "Wallet not found" };
    }

    return { success: true, wallet: wallet as MerchantWalletData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch wallet",
    };
  }
}

/**
 * Add a new wallet for merchant
 */
export async function addMerchantWallet(
  supabase: TypedSupabaseClient,
  merchantId: string,
  request: AddMerchantWalletRequest,
): Promise<MerchantWalletResult> {
  try {
    // Validate chain exists
    const chainResult = await getChainById(supabase, request.chain_id);
    if (!chainResult.success) {
      return { success: false, error: `Invalid chain: ${request.chain_id}` };
    }

    // Check if this is the first wallet for this chain (auto-set as primary)
    const { count } = await supabase
      .from("merchant_wallets")
      .select("*", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("chain_id", request.chain_id);

    const isFirstWallet = count === 0;

    const now = new Date().toISOString();
    const walletData = {
      merchant_id: merchantId,
      chain_id: request.chain_id,
      address: request.address,
      label: request.label || null,
      source: request.source || "manual",
      is_primary: request.is_primary ?? isFirstWallet,
      is_verified: request.source === "privy",
      created_at: now,
      updated_at: now,
    };

    const { data: wallet, error } = await supabase
      .from("merchant_wallets")
      .insert(walletData)
      .select(`
        *,
        chain:chains(*)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Wallet address already exists for this chain" };
      }
      return { success: false, error: error.message };
    }

    return { success: true, wallet: wallet as MerchantWalletData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add wallet",
    };
  }
}

/**
 * Update a merchant wallet
 */
export async function updateMerchantWallet(
  supabase: TypedSupabaseClient,
  walletId: string,
  merchantId: string,
  request: UpdateMerchantWalletRequest,
): Promise<MerchantWalletResult> {
  try {
    // Verify wallet belongs to merchant
    const existingWallet = await getWalletById(supabase, walletId, merchantId);
    if (!existingWallet.success) {
      return existingWallet;
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (request.label !== undefined) {
      updateData.label = request.label;
    }

    if (request.is_primary !== undefined) {
      updateData.is_primary = request.is_primary;
    }

    const { data: wallet, error } = await supabase
      .from("merchant_wallets")
      .update(updateData)
      .eq("wallet_id", walletId)
      .eq("merchant_id", merchantId)
      .select(`
        *,
        chain:chains(*)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, wallet: wallet as MerchantWalletData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update wallet",
    };
  }
}

/**
 * Delete a merchant wallet
 */
export async function deleteMerchantWallet(
  supabase: TypedSupabaseClient,
  walletId: string,
  merchantId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify wallet belongs to merchant
    const existingWallet = await getWalletById(supabase, walletId, merchantId);
    if (!existingWallet.success) {
      return { success: false, error: "Wallet not found" };
    }

    // Don't allow deleting primary wallet if it's the only one for that chain
    if (existingWallet.wallet?.is_primary) {
      const { count } = await supabase
        .from("merchant_wallets")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .eq("chain_id", existingWallet.wallet.chain_id);

      if (count === 1) {
        return {
          success: false,
          error: "Cannot delete the only wallet for this chain. Add another wallet first or set a different primary.",
        };
      }
    }

    const { error } = await supabase
      .from("merchant_wallets")
      .delete()
      .eq("wallet_id", walletId)
      .eq("merchant_id", merchantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete wallet",
    };
  }
}

/**
 * Set a wallet as primary for its chain
 */
export async function setWalletAsPrimary(
  supabase: TypedSupabaseClient,
  walletId: string,
  merchantId: string,
): Promise<MerchantWalletResult> {
  return updateMerchantWallet(supabase, walletId, merchantId, { is_primary: true });
}

// ============================================================================
// Destination Address Resolution
// ============================================================================

/**
 * Get destination wallet address for a merchant based on their default token
 * This replaces the old getDestinationAddress function in merchant.service.ts
 */
export async function getDestinationWalletAddress(
  supabase: TypedSupabaseClient,
  merchantId: string,
  token: TokenData,
): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    // Get the chain_id from the token
    const chainId = token.chain_id;

    // Get the merchant's primary wallet for this chain
    const walletResult = await getMerchantWalletByChain(supabase, merchantId, chainId);

    if (!walletResult.success || !walletResult.wallet) {
      // Fallback: Try to get from old merchant table columns for backward compatibility
      const { data: merchant, error: merchantError } = await supabase
        .from("merchants")
        .select("wallet_address, stellar_address")
        .eq("merchant_id", merchantId)
        .single();

      if (merchantError || !merchant) {
        return { success: false, error: "Merchant not found" };
      }

      // Use legacy columns as fallback
      if (chainId === "stellar" && merchant.stellar_address) {
        return { success: true, address: merchant.stellar_address };
      }
      if (merchant.wallet_address) {
        return { success: true, address: merchant.wallet_address };
      }

      return { success: false, error: `No wallet found for chain ${chainId}` };
    }

    return { success: true, address: walletResult.wallet.address };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get destination address",
    };
  }
}

/**
 * Sync Privy wallet to merchant_wallets table
 * Called when user logs in or updates their Privy wallet
 */
export async function syncPrivyWallet(
  supabase: TypedSupabaseClient,
  merchantId: string,
  walletAddress: string,
  chainId: string = "8453", // Default to Base
): Promise<MerchantWalletResult> {
  try {
    // Check if wallet already exists
    const { data: existing } = await supabase
      .from("merchant_wallets")
      .select("wallet_id")
      .eq("merchant_id", merchantId)
      .eq("chain_id", chainId)
      .eq("address", walletAddress)
      .single();

    if (existing) {
      // Wallet already exists, return it
      return getWalletById(supabase, existing.wallet_id, merchantId);
    }

    // Add new Privy wallet
    return addMerchantWallet(supabase, merchantId, {
      chain_id: chainId,
      address: walletAddress,
      source: "privy",
      is_primary: true,
      label: "Privy Wallet",
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync Privy wallet",
    };
  }
}
