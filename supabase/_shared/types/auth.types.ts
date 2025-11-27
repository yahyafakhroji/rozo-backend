/**
 * Authentication Types
 */

import type { JwtPayload } from "npm:jsonwebtoken";

export interface AuthResult {
  success: boolean;
  payload?: JwtPayload;
  error?: string;
  embedded_wallet_address?: string | null;
}

export interface DualAuthResult {
  success: boolean;
  userProviderId: string | null;
  userProviderWalletAddress: string | null;
  isPrivyAuth: boolean;
  error?: string;
}

export interface VerifiedCredential {
  address?: string;
  wallet_provider: string;
  chain?: string;
  id: string;
  public_identifier: string;
  wallet_name?: string;
  format: string;
  signInEnabled: boolean;
}

export interface DecodedJWT {
  verified_credentials?: VerifiedCredential[];
  sub?: string;
  email?: string;
}

export interface AuthContext {
  userProviderId: string;
  userProviderWalletAddress: string;
  isPrivyAuth: boolean;
  token: string;
}
