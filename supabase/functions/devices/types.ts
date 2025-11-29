/**
 * Devices Function Types
 * Uses database types for consistency
 */

import type { Tables } from "../../_shared/database.types.ts";

// ============================================================================
// Database Types
// ============================================================================

/** Device row from database */
export type Device = Tables<"devices">;

// ============================================================================
// Request Types
// ============================================================================

/** POST /devices - Register device request */
export interface RegisterDeviceRequest {
  device_id: string;
  fcm_token: string;
  platform: string;
}

// ============================================================================
// Response Data Types
// ============================================================================

/** Device data returned to clients */
export interface DeviceData {
  id: string;
  merchant_id: string;
  device_id: string;
  fcm_token: string;
  platform: string;
  created_at: string | null;
  updated_at: string | null;
}
