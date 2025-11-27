# Rozo Backend - Project Summary

A high-performance payment processing platform built with Supabase Edge Functions, supporting Privy authentication and multi-chain crypto transactions.

## Quick Reference

| Component         | Technology                     |
| ----------------- | ------------------------------ |
| **Runtime**       | Deno (Supabase Edge Functions) |
| **Framework**     | Hono                           |
| **Database**      | PostgreSQL 17 (Supabase)       |
| **Auth**          | Privy (JWT)                    |
| **Payments**      | Daimo Pay                      |
| **Blockchain**    | EVM (Base) + Stellar           |
| **Notifications** | Pusher + FCM                   |
| **Validation**    | Zod                            |

---

## Project Structure

```
supabase/
├── _shared/              # Shared utilities (~6,400 LOC)
│   ├── config/           # Constants, CORS
│   ├── middleware/       # Auth, error handling, PIN
│   ├── services/         # Business logic
│   ├── utils/            # Helpers
│   ├── types/            # TypeScript interfaces
│   ├── schemas/          # Zod validation
│   └── factories/        # Transaction factory
│
├── functions/            # 12 Edge Functions
└── migrations/           # 13 SQL migrations
```

---

## Edge Functions

| Function            | Purpose                    | Auth           |
| ------------------- | -------------------------- | -------------- |
| `merchants`         | Profile & PIN management   | JWT            |
| `orders`            | Order CRUD & payment links | JWT            |
| `deposits`          | Deposit management         | JWT            |
| `withdrawals`       | Withdrawal processing      | JWT + PIN      |
| `wallets`           | EVM/Stellar transfers      | JWT + PIN      |
| `payment-callback`  | Daimo webhook              | Webhook secret |
| `devices`           | FCM token registration     | JWT            |
| `reports`           | Dashboard analytics        | JWT            |
| `expired-orders`    | Order expiration cron      | Internal       |
| `update-currencies` | Exchange rate cron         | Internal       |
| `api-docs`          | OpenAPI documentation      | Public         |

---

## Core Concepts

### Authentication (Privy)

- **Privy**: Primary authentication with embedded wallet management
- JWT tokens verified via Privy SDK
- Each merchant identified by unique `privy_id`

### Merchant Status

- `ACTIVE` - Normal operation
- `INACTIVE` - Account disabled
- `PIN_BLOCKED` - Blocked after 3 failed PIN attempts

### Order Lifecycle

```
PENDING → PROCESSING → COMPLETED
    ↓         ↓
 EXPIRED    FAILED / DISCREPANCY
```

- **Expiration**: 10 minutes from creation
- **Cron**: Processes expired orders every 5 minutes

### PIN Security

- 6-digit numeric PIN
- Bcrypt hashed (12 rounds)
- 3 max attempts before account lockout
- Required for wallet transfers & withdrawals

---

## Key Endpoints

### Merchants

```
GET    /merchants/           # Get profile
POST   /merchants/           # Create/update profile
POST   /merchants/pin        # Set PIN
PUT    /merchants/pin        # Update PIN
DELETE /merchants/pin        # Revoke PIN
```

### Orders

```
GET    /orders/              # List orders (paginated)
GET    /orders/:id           # Get single order
POST   /orders/              # Create order
POST   /orders/:id/regenerate-payment  # Regenerate payment link
```

### Wallets

```
POST   /wallets/:id          # EVM transfer
POST   /wallets/:id/enable-usdc       # Stellar trustline
POST   /wallets/:id/stellar-transfer  # Stellar transfer
```

### Reports

```
GET    /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&group_by=day
```

---

## Environment Variables

```bash
# Supabase
ROZO_SUPABASE_URL
ROZO_SUPABASE_SERVICE_ROLE_KEY

# Auth (Privy)
PRIVY_APP_ID
PRIVY_APP_SECRET

# Payments
DAIMO_API_KEY
ROZO_PAY_URL

# Notifications
PUSHER_APP_ID
PUSHER_KEY
PUSHER_SECRET
PUSHER_CLUSTER

# Wallet (Privy)
PRIVY_POLICY_ID
PRIVY_AUTHORIZATION_PRIVATE_KEY
```

---

## Development

```bash
# Start local Supabase
npx supabase start

# Serve functions
npx supabase functions serve --env-file .env.local

# Format & lint
deno fmt && deno lint
```

## Deployment

```bash
# Link project
npx supabase link --project-ref <ref>

# Push database
npx supabase db push --include-seed

# Deploy functions
npx supabase functions deploy
```

---

## Performance

- **Currency Cache**: 5-min TTL, LRU eviction at 100 entries
- **Transaction Cache**: 5-min deduplication for wallet transfers
- **Rate Limiting**: Per-merchant limits on sensitive operations
- **Target Metrics**:
  - Order creation: <200ms
  - Cache hit rate: >80%
  - Error rate: <1%

---

## Documentation Index

| Document                                 | Description                 |
| ---------------------------------------- | --------------------------- |
| [architecture.md](architecture.md)       | System design & tech stack  |
| [development.md](development.md)         | Coding standards & patterns |
| [deployment.md](deployment.md)           | Setup & deployment guide    |
| [merchant-status.md](merchant-status.md) | Auth & PIN system           |
| [order-system.md](order-system.md)       | Order lifecycle & payments  |
| [performance.md](performance.md)         | Caching & optimization      |
| [reports.md](reports.md)                 | Analytics API               |
