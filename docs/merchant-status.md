# Merchant Status & PIN System

This document covers the merchant status management system, PIN code security, and authentication architecture.

## Merchant Status System

The system implements a comprehensive merchant status management system with PIN code security:

### Merchant Statuses

- **`ACTIVE`**: Normal operation, can create orders and process payments
- **`INACTIVE`**: Account disabled, cannot perform any operations
- **`PIN_BLOCKED`**: Account blocked due to PIN security violations

### Status Enforcement

All functions check merchant status before processing:

- Orders creation blocked for `INACTIVE` or `PIN_BLOCKED` merchants
- Withdrawals blocked for `INACTIVE` or `PIN_BLOCKED` merchants
- Deposits blocked for `INACTIVE` or `PIN_BLOCKED` merchants

### Status Transition Logic

```typescript
// Example status check in functions
if (merchant.status === 'PIN_BLOCKED') {
  return {
    success: false,
    error: 'Account blocked due to PIN security violations',
    code: 'PIN_BLOCKED'
  };
}

if (merchant.status === 'INACTIVE') {
  return {
    success: false,
    error: 'Account is inactive',
    code: 'INACTIVE'
  };
}
```

## PIN Code System

### Database Fields

- **`pin_code_hash`**: Securely stored PIN hash
- **`pin_code_attempts`**: Tracks failed PIN attempts
- **`pin_code_blocked_at`**: Timestamp when account was blocked
- **`pin_code_last_attempt_at`**: Timestamp of last PIN attempt

### PIN Code Features

- **Secure Storage**: PIN codes are hashed before storage
- **Attempt Tracking**: Failed attempts are logged and counted
- **Blocking Logic**: Account gets `PIN_BLOCKED` status after excessive failures
- **Timestamps**: Comprehensive audit trail for security monitoring

### PIN Validation Process

1. **Input Validation**: Validate PIN format and length
2. **Hash Comparison**: Compare input with stored hash
3. **Attempt Tracking**: Log attempt (success or failure)
4. **Status Update**: Block account if too many failures
5. **Audit Logging**: Record all PIN-related activities

## Authentication Architecture

### Privy Authentication

The system uses Privy for authentication:

- **Provider**: [Privy](https://privy.io/)
- **Type**: Modern wallet authentication and user management
- **Database Field**: `privy_id` (required, unique)
- **Features**:
  - Embedded wallet management
  - Secure JWT token verification
  - Modern authentication flow

### Authentication Flow

```typescript
// Privy authentication pattern
const privy = await verifyPrivyJWT(token, PRIVY_APP_ID, PRIVY_APP_SECRET);

if (!privy.success) {
  return { error: 'Invalid or expired token' };
}

const privyId = privy.payload?.id;
const walletAddress = privy.embedded_wallet_address;
```

### Database Query Pattern

```typescript
// Query merchant by Privy ID
const { data: merchant } = await supabase
  .from("merchants")
  .select("*")
  .eq("privy_id", privyId)
  .single();
```

## Security Features

### Account Security

- **Status Validation**: All operations check merchant status
- **PIN Protection**: Additional security layer for sensitive operations
- **Audit Trail**: Comprehensive logging of security events
- **Automatic Blocking**: System automatically blocks compromised accounts

### Authentication Security

- **Privy JWT**: Secure token verification via Privy SDK
- **Wallet Integration**: Blockchain-based authentication with embedded wallets
- **Session Management**: Proper token handling and validation

### Data Protection

- **Hashed PINs**: PIN codes never stored in plain text
- **Secure Fields**: Sensitive data properly encrypted
- **Access Control**: Role-based access to different functions
- **Input Validation**: Comprehensive data validation and sanitization

## Implementation Examples

### Merchant Status Check

```typescript
async function validateMerchantStatus(merchant: any): Promise<ValidationResult> {
  if (merchant.status === 'PIN_BLOCKED') {
    return {
      success: false,
      error: 'Account blocked due to PIN security violations',
      code: 'PIN_BLOCKED'
    };
  }

  if (merchant.status === 'INACTIVE') {
    return {
      success: false,
      error: 'Account is inactive',
      code: 'INACTIVE'
    };
  }

  return { success: true };
}
```

### PIN Validation

```typescript
async function validatePIN(
  inputPIN: string,
  storedHash: string,
  merchantId: string
): Promise<ValidationResult> {
  const isValid = await bcrypt.compare(inputPIN, storedHash);
  
  if (!isValid) {
    await incrementPINAttempts(merchantId);
    return { success: false, error: 'Invalid PIN' };
  }

  await resetPINAttempts(merchantId);
  return { success: true };
}
```

### Authentication Middleware

```typescript
async function privyAuthMiddleware(c: Context, next: Next) {
  const token = extractBearerToken(c.req.header('Authorization'));

  // Verify with Privy
  const privy = await verifyPrivyJWT(token, PRIVY_APP_ID, PRIVY_APP_SECRET);

  if (!privy.success) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Set context variables
  c.set('privyId', privy.payload?.id);
  c.set('walletAddress', privy.embedded_wallet_address);

  await next();
}
```

## Monitoring & Logging

### Security Events

- **PIN Attempts**: All PIN validation attempts logged
- **Status Changes**: Account status transitions tracked
- **Authentication**: Login attempts and failures monitored
- **Blocking Events**: Automatic account blocking logged

### Audit Trail

- **Timestamp Tracking**: All security events timestamped
- **User Identification**: Clear identification of users and actions
- **IP Logging**: Network-level security monitoring
- **Error Tracking**: Comprehensive error logging for security analysis

## Best Practices

### Development

1. **Always Check Status**: Validate merchant status before any operation
2. **Secure PIN Handling**: Never log or store PIN codes in plain text
3. **Privy Auth**: Use Privy middleware for all authenticated endpoints
4. **Error Handling**: Provide clear error messages for security events
5. **Audit Logging**: Log all security-related activities

### Security

1. **Regular Audits**: Monitor PIN attempt patterns
2. **Status Monitoring**: Track account status changes
3. **Access Control**: Implement proper role-based access
4. **Input Validation**: Validate all user inputs using Zod schemas
5. **Secure Storage**: Use proper encryption for sensitive data
