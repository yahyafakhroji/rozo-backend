/**
 * Orders Function Types
 * Uses database types for consistency
 */

import type { Tables, Enums } from "../../_shared/database.types.ts";
import type { DaimoPayment } from "../../_shared/types/common.types.ts";

// ============================================================================
// Database Types
// ============================================================================

/** Order row from database */
export type Order = Tables<"orders">;

/** Payment status enum */
export type PaymentStatus = Enums<"payment_status">;

/** Re-export payment detail type */
export type PaymentDetail = DaimoPayment;

// ============================================================================
// Request Types
// ============================================================================

/** POST /orders - Create order request */
export interface CreateOrderRequest {
  amount: number;
  currency: string;
  description?: string;
  number?: string;
  preferred_token_id?: string;
}

/** POST /orders/:orderId/regenerate-payment request */
export interface RegeneratePaymentRequest {
  preferred_token_id?: string;
}

/** Order data with QR code */
export interface OrderData extends Order {
  qrcode: string;
}

/** POST /orders response data */
export interface CreateOrderData {
  payment_detail: PaymentDetail;
  order_id: string;
  order_number: string | null;
  expired_at: string;
  qrcode: string;
}

/** POST /orders/:orderId/regenerate-payment response data */
export interface RegeneratePaymentData {
  order_id: string;
  expired_at: string;
  qrcode: string;
  payment_detail: PaymentDetail;
}

/** GET /orders pagination info */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
}

/** GET /orders response data (paginated list) */
export interface OrdersListData {
  orders: Order[];
  pagination: PaginationInfo;
}
