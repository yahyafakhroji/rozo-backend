/**
 * Authentication Types
 * Types for Privy authentication
 */

/**
 * Result from Privy JWT verification
 */
export interface AuthResult {
  success: boolean;
  payload?: {
    id?: string;
    [key: string]: unknown;
  };
  error?: string;
  embedded_wallet_address?: string | null;
}

/**
 * Authentication context stored in Hono context
 */
export interface AuthContext {
  privyId: string;
  walletAddress: string;
  token: string;
}
