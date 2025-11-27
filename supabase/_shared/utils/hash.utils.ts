/**
 * Hash Utilities
 * Bcrypt hashing and verification utilities
 */

import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { CONSTANTS } from "../config/constants.ts";

/**
 * Hash a PIN code using bcryptjs
 */
export async function hashPinCode(pinCode: string): Promise<string> {
  const salt = bcrypt.genSaltSync(CONSTANTS.PIN.BCRYPT_SALT_ROUNDS);
  return bcrypt.hashSync(pinCode, salt);
}

/**
 * Verify a PIN code against its hash
 */
export async function verifyPinCode(
  pinCode: string,
  hashedPin: string,
): Promise<boolean> {
  return bcrypt.compareSync(pinCode, hashedPin);
}

/**
 * Validate PIN code input format
 */
export function validatePinCodeInput(
  pinCode: string,
): { valid: boolean; error?: string } {
  if (!pinCode || typeof pinCode !== "string") {
    return { valid: false, error: "PIN code is required" };
  }

  const pinRegex = new RegExp(`^\\d{${CONSTANTS.PIN.LENGTH}}$`);
  if (!pinRegex.test(pinCode)) {
    return {
      valid: false,
      error: `PIN code must be exactly ${CONSTANTS.PIN.LENGTH} digits`,
    };
  }

  return { valid: true };
}
