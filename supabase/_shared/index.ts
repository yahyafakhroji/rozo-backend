/**
 * Shared Module - Main Export
 *
 * This is the main entry point for all shared utilities, services,
 * middleware, validators, types, and config.
 *
 * Usage:
 *   import { corsHeaders, validateMerchant, ... } from "../_shared/index.ts";
 *
 * Or import from specific modules:
 *   import { corsHeaders } from "../_shared/config/index.ts";
 *   import { validateMerchant } from "../_shared/services/index.ts";
 */

// Config exports
export * from "./config/index.ts";

// Types exports
export * from "./types/index.ts";

// Utils exports
export * from "./utils/index.ts";

// Services exports
export * from "./services/index.ts";

// Middleware exports
export * from "./middleware/index.ts";

// Validators exports
export * from "./validators/index.ts";
