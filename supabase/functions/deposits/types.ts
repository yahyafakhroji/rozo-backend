/**
 * Deposits Function Types
 * Uses database types for consistency
 */

import type { Tables, Enums } from "../../_shared/database.types.ts";
import type { DaimoPayment } from "../../_shared/types/common.types.ts";

// ============================================================================
// Database Types
// ============================================================================

/** Deposit row from database */
export type Deposit = Tables<"deposits">;

/** Payment status enum */
export type PaymentStatus = Enums<"payment_status">;

/** Re-export payment detail type */
export type PaymentDetail = DaimoPayment;

// ============================================================================
// Request Types
// ============================================================================

/** POST /deposits - Create deposit request */
export interface CreateDepositRequest {
  amount: number;
  currency: string;
  number?: string;
}

// ============================================================================
// Response Data Types
// ============================================================================

/** Deposit data with QR code */
export interface DepositData extends Deposit {
  qrcode: string;
}

/** POST /deposits response data */
export interface CreateDepositData {
  deposit_id: string;
  qrcode: string;
}
