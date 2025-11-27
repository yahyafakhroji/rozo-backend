/**
 * API Response Types
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    totalPages: number;
  };
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  code?: string;
}

export interface CurrencyConversionResult {
  success: boolean;
  usdAmount?: number;
  error?: string;
}

export interface PinValidationResult {
  success: boolean;
  attempts_remaining: number;
  is_blocked: boolean;
  message: string;
}

export interface PinManagementResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface PinValidationMiddlewareOptions {
  supabase: unknown;
  merchantId: string;
  pinCode: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ExpiredOrderStats {
  totalExpired: number;
  updatedOrders: number;
  errors: number;
  processingTimeMs: number;
}
