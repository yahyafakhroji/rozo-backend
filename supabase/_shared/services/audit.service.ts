/**
 * Audit Logging Service
 * Tracks sensitive operations for security and compliance
 */

import type { TypedSupabaseClient } from "../types/common.types.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Audit action types
 */
export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",

  // PIN Operations
  PIN_SET = "PIN_SET",
  PIN_UPDATED = "PIN_UPDATED",
  PIN_REVOKED = "PIN_REVOKED",
  PIN_VALIDATION_SUCCESS = "PIN_VALIDATION_SUCCESS",
  PIN_VALIDATION_FAILED = "PIN_VALIDATION_FAILED",
  PIN_BLOCKED = "PIN_BLOCKED",

  // Order Operations
  ORDER_CREATED = "ORDER_CREATED",
  ORDER_COMPLETED = "ORDER_COMPLETED",
  ORDER_FAILED = "ORDER_FAILED",
  ORDER_EXPIRED = "ORDER_EXPIRED",
  PAYMENT_REGENERATED = "PAYMENT_REGENERATED",

  // Deposit Operations
  DEPOSIT_CREATED = "DEPOSIT_CREATED",
  DEPOSIT_COMPLETED = "DEPOSIT_COMPLETED",
  DEPOSIT_FAILED = "DEPOSIT_FAILED",

  // Withdrawal Operations
  WITHDRAWAL_INITIATED = "WITHDRAWAL_INITIATED",
  WITHDRAWAL_COMPLETED = "WITHDRAWAL_COMPLETED",
  WITHDRAWAL_FAILED = "WITHDRAWAL_FAILED",

  // Device Operations
  DEVICE_REGISTERED = "DEVICE_REGISTERED",
  DEVICE_UNREGISTERED = "DEVICE_UNREGISTERED",

  // Wallet Operations
  WALLET_TRANSFER_INITIATED = "WALLET_TRANSFER_INITIATED",
  WALLET_TRANSFER_COMPLETED = "WALLET_TRANSFER_COMPLETED",
  WALLET_TRANSFER_FAILED = "WALLET_TRANSFER_FAILED",

  // Profile Operations
  PROFILE_UPDATED = "PROFILE_UPDATED",
  SETTINGS_CHANGED = "SETTINGS_CHANGED",

  // Security Events
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_TOKEN = "INVALID_TOKEN",
}

/**
 * Resource types for audit logs
 */
export type AuditResourceType =
  | "merchant"
  | "order"
  | "deposit"
  | "withdrawal"
  | "device"
  | "wallet"
  | "pin";

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  merchantId: string;
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit log record from database
 */
export interface AuditLogRecord {
  id: string;
  merchant_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Audit Logging Functions
// ============================================================================

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(
  supabase: TypedSupabaseClient,
  entry: AuditLogEntry,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      merchant_id: entry.merchantId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      metadata: entry.metadata || {},
    });

    if (error) {
      console.error("Failed to log audit event:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Audit logging error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Log audit event without awaiting (fire-and-forget)
 * Use for non-critical audit logs where response time is important
 */
export function logAuditEventAsync(
  supabase: TypedSupabaseClient,
  entry: AuditLogEntry,
): void {
  // Fire and forget - don't await
  logAuditEvent(supabase, entry).catch((error) => {
    console.error("Async audit logging failed:", error);
  });
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get audit logs for a merchant
 */
export async function getMerchantAuditLogs(
  supabase: TypedSupabaseClient,
  merchantId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
    from?: string;
    to?: string;
  } = {},
): Promise<{ success: boolean; logs?: AuditLogRecord[]; total?: number; error?: string }> {
  try {
    const { limit = 50, offset = 0, action, from, to } = options;

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("merchant_id", merchantId);

    if (action) {
      query = query.eq("action", action);
    }

    if (from) {
      query = query.gte("created_at", from);
    }

    if (to) {
      query = query.lte("created_at", to);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      logs: data as AuditLogRecord[],
      total: count || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Convenience Functions for Common Audit Events
// ============================================================================

/**
 * Log PIN operation
 */
export function logPinOperation(
  supabase: TypedSupabaseClient,
  merchantId: string,
  action: AuditAction.PIN_SET | AuditAction.PIN_UPDATED | AuditAction.PIN_REVOKED | AuditAction.PIN_BLOCKED,
  ipAddress?: string,
  userAgent?: string,
): void {
  logAuditEventAsync(supabase, {
    merchantId,
    action,
    resourceType: "pin",
    ipAddress,
    userAgent,
  });
}

/**
 * Log PIN validation attempt
 */
export function logPinValidation(
  supabase: TypedSupabaseClient,
  merchantId: string,
  success: boolean,
  attemptsRemaining?: number,
  ipAddress?: string,
  userAgent?: string,
): void {
  logAuditEventAsync(supabase, {
    merchantId,
    action: success ? AuditAction.PIN_VALIDATION_SUCCESS : AuditAction.PIN_VALIDATION_FAILED,
    resourceType: "pin",
    ipAddress,
    userAgent,
    metadata: {
      attemptsRemaining,
    },
  });
}

/**
 * Log order event
 */
export function logOrderEvent(
  supabase: TypedSupabaseClient,
  merchantId: string,
  orderId: string,
  action: AuditAction.ORDER_CREATED | AuditAction.ORDER_COMPLETED | AuditAction.ORDER_FAILED | AuditAction.ORDER_EXPIRED,
  metadata?: Record<string, unknown>,
): void {
  logAuditEventAsync(supabase, {
    merchantId,
    action,
    resourceType: "order",
    resourceId: orderId,
    metadata,
  });
}

/**
 * Log withdrawal event
 */
export function logWithdrawalEvent(
  supabase: TypedSupabaseClient,
  merchantId: string,
  withdrawalId: string,
  action: AuditAction.WITHDRAWAL_INITIATED | AuditAction.WITHDRAWAL_COMPLETED | AuditAction.WITHDRAWAL_FAILED,
  metadata?: Record<string, unknown>,
): void {
  logAuditEventAsync(supabase, {
    merchantId,
    action,
    resourceType: "withdrawal",
    resourceId: withdrawalId,
    metadata,
  });
}

/**
 * Log wallet transfer event
 */
export function logWalletTransfer(
  supabase: TypedSupabaseClient,
  merchantId: string,
  action: AuditAction.WALLET_TRANSFER_INITIATED | AuditAction.WALLET_TRANSFER_COMPLETED | AuditAction.WALLET_TRANSFER_FAILED,
  metadata: {
    amount: number;
    recipient: string;
    txHash?: string;
  },
): void {
  logAuditEventAsync(supabase, {
    merchantId,
    action,
    resourceType: "wallet",
    metadata,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(
  supabase: TypedSupabaseClient,
  merchantId: string,
  action: AuditAction.SUSPICIOUS_ACTIVITY | AuditAction.RATE_LIMIT_EXCEEDED | AuditAction.INVALID_TOKEN,
  metadata: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
): void {
  logAuditEventAsync(supabase, {
    merchantId,
    action,
    ipAddress,
    userAgent,
    metadata,
  });
}
