/**
 * Response Utilities
 * Standardized response helpers for consistent API responses
 */

import { corsHeaders } from "../config/cors.ts";

/**
 * Create a success response with data
 */
export function successResponse<T>(
  data: T,
  status = 200,
  message?: string,
): Response {
  return Response.json(
    {
      success: true,
      ...(message && { message }),
      data,
    },
    { status, headers: corsHeaders },
  );
}

/**
 * Create a simple success response without data
 */
export function okResponse(message: string, status = 200): Response {
  return Response.json(
    { success: true, message },
    { status, headers: corsHeaders },
  );
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status = 400,
  code?: string,
): Response {
  return Response.json(
    {
      success: false,
      error,
      ...(code && { code }),
    },
    { status, headers: corsHeaders },
  );
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    total: number;
    limit: number;
    offset: number;
  },
  dataKey = "data",
): Response {
  return Response.json(
    {
      success: true,
      [dataKey]: data,
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
    },
    { status: 200, headers: corsHeaders },
  );
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(
  error = "Missing or invalid authorization header",
  details?: string,
): Response {
  return Response.json(
    {
      success: false,
      error,
      ...(details && { details }),
    },
    { status: 401, headers: corsHeaders },
  );
}

/**
 * Create a forbidden response
 */
export function forbiddenResponse(error: string, code?: string): Response {
  return Response.json(
    {
      success: false,
      error,
      ...(code && { code }),
    },
    { status: 403, headers: corsHeaders },
  );
}

/**
 * Create a not found response
 */
export function notFoundResponse(error = "Not found"): Response {
  return Response.json(
    { success: false, error },
    { status: 404, headers: corsHeaders },
  );
}

/**
 * Create a server error response
 */
export function serverErrorResponse(error?: unknown): Response {
  const message = error instanceof Error
    ? error.message
    : "Internal server error";
  return Response.json(
    { success: false, error: `Server error: ${message}` },
    { status: 500, headers: corsHeaders },
  );
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(error: string): Response {
  return Response.json(
    { success: false, error },
    { status: 400, headers: corsHeaders },
  );
}

/**
 * Create a method not allowed response
 */
export function methodNotAllowedResponse(method: string): Response {
  return Response.json(
    { success: false, error: `Method ${method} not allowed` },
    { status: 405, headers: corsHeaders },
  );
}

/**
 * Create a missing environment variables response
 */
export function missingEnvResponse(): Response {
  return Response.json(
    { success: false, error: "Missing environment variables" },
    { status: 500, headers: corsHeaders },
  );
}

/**
 * Create a PIN required response
 */
export function pinRequiredResponse(): Response {
  return Response.json(
    {
      success: false,
      error: "PIN code is required for this operation",
      code: "PIN_REQUIRED",
    },
    { status: 400, headers: corsHeaders },
  );
}

/**
 * Create a PIN validation failed response
 */
export function pinValidationFailedResponse(
  error: string,
  attemptsRemaining?: number,
  isBlocked?: boolean,
): Response {
  return Response.json(
    {
      success: false,
      error,
      attempts_remaining: attemptsRemaining,
      is_blocked: isBlocked,
    },
    { status: 401, headers: corsHeaders },
  );
}

/**
 * Create a blocked account response
 */
export function blockedAccountResponse(): Response {
  return Response.json(
    {
      success: false,
      error: "Account blocked due to PIN security violations",
      code: "PIN_BLOCKED",
    },
    { status: 403, headers: corsHeaders },
  );
}

/**
 * Create an inactive account response
 */
export function inactiveAccountResponse(): Response {
  return Response.json(
    {
      success: false,
      error: "Account is inactive",
      code: "INACTIVE",
    },
    { status: 403, headers: corsHeaders },
  );
}
