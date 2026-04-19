# FAN_TOKEN_SYSTEM v1.0.0

## Scope
- Wallet badge + purchase modal mounted on `/live`.
- Award panel + leaderboard mounted on `/live` sidebar.
- Stripe checkout bootstrap via `/api/tokens/purchase`.

## Flags
- Worker: `FEATURE_FAN_TOKEN_SYSTEM=true`
- Client: `VITE_FEATURE_FAN_TOKEN_SYSTEM=true`

## External config
1. Create four Stripe products/prices.
2. Update `fan_token_products.stripe_price_id` for each SKU.
3. Register Stripe webhook endpoint to `/api/tokens/webhook`.

## Rollback
- Set both flags to false.
- Keep webhook active until all pending checkout sessions resolve.
