/**
 * Request Validation Schemas
 * Centralized Zod schemas for request validation
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

/**
 * Date range schema
 */
export const DateRangeSchema = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
}).refine(
  (data) => new Date(data.from) <= new Date(data.to),
  { message: "from date must be before or equal to to date" }
);

export type DateRangeParams = z.infer<typeof DateRangeSchema>;

/**
 * Currency code schema (3-letter ISO)
 */
export const CurrencyCodeSchema = z.string()
  .min(3)
  .max(3)
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a valid 3-letter code");

/**
 * Positive amount schema
 */
export const PositiveAmountSchema = z.number()
  .positive("Amount must be positive")
  .finite("Amount must be a valid number");

/**
 * Ethereum address schema
 */
export const EthereumAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address");

/**
 * Stellar address schema
 */
export const StellarAddressSchema = z.string()
  .regex(/^G[A-Z0-9]{55}$/, "Must be a valid Stellar public key");

/**
 * UUID schema
 */
export const UUIDSchema = z.string().uuid();

/**
 * Order status filter schema (case-insensitive, outputs uppercase)
 */
export const OrderStatusSchema = z.string()
  .transform((val) => val.toUpperCase())
  .pipe(z.enum([
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
    "EXPIRED",
    "DISCREPANCY",
  ]));

/**
 * Group by schema for reports
 */
export const GroupBySchema = z.enum(["day", "week", "month"]).default("day");

// ============================================================================
// Order Schemas
// ============================================================================

/**
 * Create order request schema
 */
export const CreateOrderSchema = z.object({
  display_currency: CurrencyCodeSchema,
  display_amount: PositiveAmountSchema,
  description: z.string().max(500).optional(),
  redirect_uri: z.string().url().optional(),
  preferred_token_id: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/**
 * Regenerate payment request schema
 */
export const RegeneratePaymentSchema = z.object({
  preferred_token_id: z.string().optional(),
});

export type RegeneratePaymentInput = z.infer<typeof RegeneratePaymentSchema>;

// ============================================================================
// Deposit Schemas
// ============================================================================

/**
 * Create deposit request schema
 */
export const CreateDepositSchema = z.object({
  display_currency: CurrencyCodeSchema,
  display_amount: PositiveAmountSchema,
  redirect_uri: z.string().url().optional(),
});

export type CreateDepositInput = z.infer<typeof CreateDepositSchema>;

// ============================================================================
// Withdrawal Schemas
// ============================================================================

/**
 * Create withdrawal request schema
 */
export const CreateWithdrawalSchema = z.object({
  recipient: z.string().min(1, "Recipient is required"),
  amount: PositiveAmountSchema,
  currency: CurrencyCodeSchema,
});

export type CreateWithdrawalInput = z.infer<typeof CreateWithdrawalSchema>;

// ============================================================================
// Device Schemas
// ============================================================================

/**
 * Platform enum
 */
export const PlatformSchema = z.enum(["ios", "android"]);

/**
 * Register device request schema
 */
export const RegisterDeviceSchema = z.object({
  device_id: z.string().min(1, "Device ID is required"),
  fcm_token: z.string().min(1, "FCM token is required"),
  platform: PlatformSchema,
});

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;

/**
 * Unregister device request schema
 */
export const UnregisterDeviceSchema = z.object({
  device_id: z.string().min(1, "Device ID is required"),
});

export type UnregisterDeviceInput = z.infer<typeof UnregisterDeviceSchema>;

// ============================================================================
// Wallet Schemas
// ============================================================================

/**
 * Transaction request schema (EVM)
 */
export const TransactionRequestSchema = z.object({
  walletId: z.string().min(1, "Wallet ID is required"),
  recipientAddress: EthereumAddressSchema,
  amount: PositiveAmountSchema,
  signature: z.string().min(1, "Signature is required"),
  requestId: z.string().optional(),
});

export type TransactionRequestInput = z.infer<typeof TransactionRequestSchema>;

/**
 * Stellar transfer request schema
 */
export const StellarTransferSchema = z.object({
  walletId: z.string().min(1, "Wallet ID is required"),
  destinationAddress: StellarAddressSchema,
  amount: z.union([
    z.number().positive(),
    z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a valid number"),
  ]).transform((val) => String(val)),
});

export type StellarTransferInput = z.infer<typeof StellarTransferSchema>;

// ============================================================================
// PIN Schemas
// ============================================================================

/**
 * PIN code schema (6-digit numeric string)
 */
export const PinCodeSchema = z.string()
  .length(6, "PIN code must be 6 digits")
  .regex(/^\d{6}$/, "PIN code must contain only digits");

/**
 * Set PIN request schema
 */
export const SetPinSchema = z.object({
  pin_code: PinCodeSchema,
});

export type SetPinInput = z.infer<typeof SetPinSchema>;

/**
 * Update PIN request schema
 */
export const UpdatePinSchema = z.object({
  current_pin: PinCodeSchema,
  new_pin: PinCodeSchema,
}).refine(
  (data) => data.current_pin !== data.new_pin,
  { message: "New PIN must be different from current PIN" }
);

export type UpdatePinInput = z.infer<typeof UpdatePinSchema>;

/**
 * Revoke PIN request schema
 */
export const RevokePinSchema = z.object({
  pin_code: PinCodeSchema,
});

export type RevokePinInput = z.infer<typeof RevokePinSchema>;

// ============================================================================
// Report Schemas
// ============================================================================

/**
 * Report request schema
 */
export const ReportRequestSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  group_by: GroupBySchema.optional(),
}).refine(
  (data) => new Date(data.from) <= new Date(data.to),
  { message: "from date must be before or equal to to date" }
).refine(
  (data) => {
    const diff = new Date(data.to).getTime() - new Date(data.from).getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days <= 365;
  },
  { message: "Date range cannot exceed 1 year" }
);

export type ReportRequestInput = z.infer<typeof ReportRequestSchema>;

// ============================================================================
// Webhook Schemas
// ============================================================================

/**
 * Daimo webhook metadata schema
 */
export const DaimoWebhookMetadataSchema = z.object({
  appId: z.string().optional(),
  orderNumber: z.string(),
  merchantToken: z.string(),
  transaction_hash: z.string().optional(),
  actual_amount: z.string().optional(),
  from_address: z.string().optional(),
  block_number: z.number().optional(),
}).passthrough();

/**
 * Daimo webhook payment schema
 */
export const DaimoWebhookPaymentSchema = z.object({
  id: z.string(),
  status: z.string(),
  metadata: DaimoWebhookMetadataSchema,
  payinchainid: z.string().optional(),
  payintokenaddress: z.string().optional(),
}).passthrough();

/**
 * Daimo webhook event schema
 */
export const DaimoWebhookEventSchema = z.object({
  event: z.enum([
    "payment_started",
    "payment.completed",
    "payment_completed",
    "payment_bounced",
    "payment_refunded",
  ]),
  timestamp: z.string().optional(),
  payment: DaimoWebhookPaymentSchema,
});

export type DaimoWebhookEventInput = z.infer<typeof DaimoWebhookEventSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Parse and validate request body with Zod schema
 * Returns typed data or throws ApiError
 */
export function parseBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    throw new ValidationError(errors.join(", "));
  }
  return result.data;
}

/**
 * Safe parse that returns result object instead of throwing
 */
export function safeParseBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return { success: false, error: errors.join(", ") };
  }
  return { success: true, data: result.data };
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Re-export Zod for convenience
export { z };
