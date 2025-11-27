/**
 * Common Validators
 * Reusable validation functions
 */

import { CONSTANTS, VALID_ORDER_STATUSES } from "../config/constants.ts";
import type { ValidationResult } from "../types/api.types.ts";

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  limitParam: string | null,
  offsetParam: string | null,
): ValidationResult & { limit?: number; offset?: number } {
  let limit = CONSTANTS.PAGINATION.DEFAULT_LIMIT;
  let offset = CONSTANTS.PAGINATION.DEFAULT_OFFSET;

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return { success: false, error: "Limit must be a positive integer" };
    }
    limit = Math.min(parsedLimit, CONSTANTS.PAGINATION.MAX_LIMIT);
  }

  if (offsetParam) {
    const parsedOffset = parseInt(offsetParam, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return {
        success: false,
        error: "Offset must be a non-negative integer",
      };
    }
    offset = parsedOffset;
  }

  return { success: true, limit, offset };
}

/**
 * Validate order status filter
 */
export function validateStatusFilter(
  status: string | null,
): ValidationResult & { status?: string } {
  if (!status) {
    return { success: true };
  }

  const normalizedStatus = status.toLowerCase();
  if (
    !(VALID_ORDER_STATUSES as readonly string[]).includes(normalizedStatus)
  ) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
    };
  }

  return { success: true, status: normalizedStatus.toUpperCase() };
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date);
}

/**
 * Validate date range for reports
 */
export function validateDateRange(
  from: string | null,
  to: string | null,
): ValidationResult & { from?: string; to?: string } {
  if (!from || !to) {
    return {
      success: false,
      error: "Missing required parameters: 'from' and 'to' dates (YYYY-MM-DD format)",
    };
  }

  if (!validateDateFormat(from) || !validateDateFormat(to)) {
    return {
      success: false,
      error: "Invalid date format. Use YYYY-MM-DD format",
    };
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { success: false, error: "Invalid date format" };
  }

  if (fromDate > toDate) {
    return {
      success: false,
      error: "Invalid date range: 'from' must be before 'to'",
    };
  }

  // Check if date range is too large (max 1 year)
  const daysDiff = Math.ceil(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysDiff > 365) {
    return { success: false, error: "Date range cannot exceed 1 year" };
  }

  return { success: true, from, to };
}

/**
 * Validate group_by parameter for reports
 */
export function validateGroupBy(
  groupBy: string | null,
): ValidationResult & { groupBy?: "day" | "week" | "month" } {
  if (!groupBy) {
    return { success: true, groupBy: "day" };
  }

  if (!["day", "week", "month"].includes(groupBy)) {
    return {
      success: false,
      error: "Invalid group_by parameter. Must be 'day', 'week', or 'month'",
    };
  }

  return { success: true, groupBy: groupBy as "day" | "week" | "month" };
}

/**
 * Validate required string field
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
): ValidationResult {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return { success: false, error: `${fieldName} is required` };
  }
  return { success: true };
}

/**
 * Validate required number field
 */
export function validateRequiredNumber(
  value: unknown,
  fieldName: string,
  options?: { min?: number; max?: number },
): ValidationResult {
  if (value === undefined || value === null || typeof value !== "number") {
    return { success: false, error: `${fieldName} is required and must be a number` };
  }

  if (isNaN(value)) {
    return { success: false, error: `${fieldName} must be a valid number` };
  }

  if (options?.min !== undefined && value < options.min) {
    return { success: false, error: `${fieldName} must be at least ${options.min}` };
  }

  if (options?.max !== undefined && value > options.max) {
    return { success: false, error: `${fieldName} must be at most ${options.max}` };
  }

  return { success: true };
}

/**
 * Validate positive amount
 */
export function validatePositiveAmount(
  amount: unknown,
  fieldName = "amount",
): ValidationResult {
  if (typeof amount !== "number" || amount <= 0) {
    return { success: false, error: `${fieldName} must be a positive number` };
  }
  return { success: true };
}

/**
 * Validate Ethereum address
 */
export function validateEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Stellar public key
 */
export function validateStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

/**
 * Validate platform for device registration
 */
export function validatePlatform(
  platform: unknown,
): ValidationResult & { platform?: "ios" | "android" } {
  if (!platform || typeof platform !== "string") {
    return { success: false, error: "Platform is required" };
  }

  if (!["ios", "android"].includes(platform)) {
    return { success: false, error: "Invalid platform. Must be ios or android" };
  }

  return { success: true, platform: platform as "ios" | "android" };
}
