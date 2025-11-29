# API Restructuring Plan

## Overview

Restructure API endpoints for consistency, clarity, and scalability. Single release approach - remove old endpoints and implement new structure.

---

## Endpoint Migration Map

### UNCHANGED (No changes needed)

| Current | New | Function Folder |
|---------|-----|-----------------|
| `GET /orders` | `GET /orders` | `orders/` |
| `GET /orders/:orderId` | `GET /orders/:orderId` | `orders/` |
| `POST /orders` | `POST /orders` | `orders/` |
| `POST /orders/:orderId/regenerate-payment` | `POST /orders/:orderId/regenerate-payment` | `orders/` |
| `GET /deposits` | `GET /deposits` | `deposits/` |
| `GET /deposits/:depositId` | `GET /deposits/:depositId` | `deposits/` |
| `POST /deposits` | `POST /deposits` | `deposits/` |
| `GET /withdrawals` | `GET /withdrawals` | `withdrawals/` |
| `POST /withdrawals` | `POST /withdrawals` | `withdrawals/` |
| `GET /reports` | `GET /reports` | `reports/` |
| `GET /reports/quick-stats` | `GET /reports/quick-stats` | `reports/` |
| `POST /payment-callback` | `POST /payment-callback` | `payment-callback/` |
| `GET /api-docs/*` | `GET /api-docs/*` | `api-docs/` |

### RENAMED: `/merchants` → `/profile`

| Current | New | Notes |
|---------|-----|-------|
| `GET /merchants/` | `GET /profile` | Get profile |
| `POST /merchants/` | `POST /profile` | Create profile |
| `PUT /merchants/` | `PUT /profile` | Update profile |
| `GET /merchants/status` | `GET /profile/status` | Get status |
| `POST /merchants/pin` | `POST /profile/pin` | Set PIN |
| `PUT /merchants/pin` | `PUT /profile/pin` | Update PIN |
| `DELETE /merchants/pin` | `DELETE /profile/pin` | Revoke PIN |
| `POST /merchants/pin/validate` | `POST /profile/pin/validate` | Validate PIN |

### MOVED: `/merchants/wallets` → `/wallets`

| Current | New | Notes |
|---------|-----|-------|
| `GET /merchants/wallets` | `GET /wallets` | List wallets |
| `GET /merchants/wallets/:walletId` | `GET /wallets/:walletId` | Get wallet |
| `POST /merchants/wallets` | `POST /wallets` | Add wallet |
| `PUT /merchants/wallets/:walletId` | `PUT /wallets/:walletId` | Update wallet |
| `PUT /merchants/wallets/:walletId/primary` | `PUT /wallets/:walletId/primary` | Set primary |
| `DELETE /merchants/wallets/:walletId` | `DELETE /wallets/:walletId` | Delete wallet |
| `POST /merchants/wallets/sync` | `POST /wallets/sync` | Sync Privy wallet |
| `GET /merchants/chains` | `GET /wallets/chains` | List chains (under wallets) |

### RENAMED: `/wallets` (transfers) → `/transfers`

| Current | New | Notes |
|---------|-----|-------|
| `POST /wallets/:walletId` | `POST /transfers/evm` | EVM transfer |
| `POST /wallets/:walletId/enable-usdc` | `POST /transfers/stellar/trustline` | Stellar trustline |
| `POST /wallets/:walletId/stellar-transfer` | `POST /transfers/stellar` | Stellar transfer |

### MOVED: Cron jobs → `/cron/*`

| Current | New | Notes |
|---------|-----|-------|
| `POST /expired-orders` | `POST /cron/expired-orders` | Cron job |
| `GET /expired-orders/health` | `GET /cron/expired-orders/health` | Health check |
| `POST /expired-orders/trigger` | `POST /cron/expired-orders/trigger` | Manual trigger |
| `POST /update-currencies` | `POST /cron/update-currencies` | Cron job |

### MINOR CHANGE: `/devices`

| Current | New | Notes |
|---------|-----|-------|
| `POST /devices/register` | `POST /devices` | Simplified |
| `DELETE /devices/unregister` | `DELETE /devices/:deviceId` | RESTful |

---

## Implementation Steps

### Phase 1: Create New Function Folders

1. **Create `profile/` function** (rename from `merchants/`)
   - Copy `merchants/index.ts` → `profile/index.ts`
   - Change basePath from `/merchants` to `/profile`
   - Remove wallet routes (moved to `/wallets`)
   - Remove chains route (moved to `/wallets/chains`)
   - Keep: profile CRUD, PIN operations, status

2. **Refactor `wallets/` function** (merge wallet management + add chains)
   - Current: Only has transfer routes
   - Add wallet CRUD routes from merchants
   - Add chains route
   - Rename transfer routes to new paths

3. **Create `transfers/` function** (new)
   - Move transfer logic from current `wallets/`
   - Routes: `/evm`, `/stellar`, `/stellar/trustline`
   - Keep PIN validation middleware

4. **Create `cron/` function** (consolidate cron jobs)
   - Merge `expired-orders/` and `update-currencies/`
   - Routes: `/expired-orders`, `/update-currencies`
   - Keep health and trigger endpoints

5. **Update `devices/` function**
   - Change `POST /register` → `POST /`
   - Change `DELETE /unregister` → `DELETE /:deviceId`

### Phase 2: Delete Old Function Folders

- Delete `merchants/` folder (replaced by `profile/`)
- Delete `expired-orders/` folder (merged into `cron/`)
- Delete `update-currencies/` folder (merged into `cron/`)

### Phase 3: Update Configuration

1. Update `supabase/config.toml` - function mappings
2. Update OpenAPI spec in `api-docs/openapi.ts`
3. Update documentation in `docs/`

---

## New Function Structure

```
supabase/functions/
├── profile/              # NEW (was merchants)
│   ├── index.ts          # Profile + PIN routes
│   └── deno.json
├── wallets/              # REFACTORED (wallet management + chains)
│   ├── index.ts          # Wallet CRUD + chains
│   └── deno.json
├── transfers/            # NEW (was wallets transfer routes)
│   ├── index.ts          # EVM + Stellar transfers
│   ├── transfer.ts       # EVM transfer logic
│   ├── trustline.ts      # Stellar trustline logic
│   └── deno.json
├── cron/                 # NEW (consolidated cron jobs)
│   ├── index.ts          # expired-orders + update-currencies
│   └── deno.json
├── devices/              # UPDATED (simplified routes)
│   ├── index.ts
│   └── deno.json
├── orders/               # UNCHANGED
├── deposits/             # UNCHANGED
├── withdrawals/          # UNCHANGED
├── reports/              # UNCHANGED
├── payment-callback/     # UNCHANGED
├── api-docs/             # UPDATED (new OpenAPI spec)
└── _shared/              # UNCHANGED
```

---

## Final API Structure

```
# Profile & Security
GET    /profile                      # Get merchant profile
POST   /profile                      # Create profile
PUT    /profile                      # Update profile
GET    /profile/status               # Get status & PIN state
POST   /profile/pin                  # Set PIN
PUT    /profile/pin                  # Update PIN
DELETE /profile/pin                  # Revoke PIN
POST   /profile/pin/validate         # Validate PIN

# Wallet Management
GET    /wallets                      # List wallets
GET    /wallets/:walletId            # Get wallet
POST   /wallets                      # Add wallet
PUT    /wallets/:walletId            # Update wallet
PUT    /wallets/:walletId/primary    # Set as primary
DELETE /wallets/:walletId            # Delete wallet
POST   /wallets/sync                 # Sync Privy wallet
GET    /wallets/chains               # List supported chains

# Transfers (requires PIN)
POST   /transfers/evm                # EVM transfer
POST   /transfers/stellar            # Stellar transfer
POST   /transfers/stellar/trustline  # Enable Stellar trustline

# Orders
GET    /orders                       # List orders
GET    /orders/:orderId              # Get order
POST   /orders                       # Create order
POST   /orders/:orderId/regenerate-payment

# Deposits
GET    /deposits                     # List deposits
GET    /deposits/:depositId          # Get deposit
POST   /deposits                     # Create deposit

# Withdrawals (requires PIN for POST)
GET    /withdrawals                  # List withdrawals
POST   /withdrawals                  # Create withdrawal

# Devices
POST   /devices                      # Register device
DELETE /devices/:deviceId            # Unregister device

# Reports
GET    /reports                      # Dashboard report
GET    /reports/quick-stats          # Quick stats

# System
POST   /payment-callback             # Daimo webhook
GET    /api-docs                     # OpenAPI docs

# Cron Jobs (internal)
POST   /cron/expired-orders          # Process expired orders
GET    /cron/expired-orders/health   # Health check
POST   /cron/expired-orders/trigger  # Manual trigger
POST   /cron/update-currencies       # Update exchange rates
```

---

## Files to Create/Modify

### New Files
- `supabase/functions/profile/index.ts`
- `supabase/functions/profile/deno.json`
- `supabase/functions/transfers/index.ts`
- `supabase/functions/transfers/transfer.ts`
- `supabase/functions/transfers/trustline.ts`
- `supabase/functions/transfers/deno.json`
- `supabase/functions/cron/index.ts`
- `supabase/functions/cron/deno.json`

### Modified Files
- `supabase/functions/wallets/index.ts` (add wallet CRUD + chains)
- `supabase/functions/devices/index.ts` (simplified routes)
- `supabase/functions/api-docs/openapi.ts` (new endpoint paths)
- `supabase/config.toml` (function mappings)
- `docs/SUMMARY.md`
- `docs/architecture.md`

### Deleted Folders
- `supabase/functions/merchants/` (replaced by profile)
- `supabase/functions/expired-orders/` (merged into cron)
- `supabase/functions/update-currencies/` (merged into cron)

---

## Risk Mitigation

1. **Frontend Coordination**: All endpoint changes require frontend updates
2. **Testing**: Test all endpoints after migration
3. **Rollback**: Keep git history for easy revert if needed
4. **Documentation**: Update OpenAPI spec and docs simultaneously
