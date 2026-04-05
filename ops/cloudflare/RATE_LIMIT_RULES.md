# Cloudflare Rate Limiting Rules — SBBL-HQ

These rules should be configured in Cloudflare Dashboard > Security > WAF > Rate Limiting Rules
for the `sbbl-hq.icu` zone.

---

## Rule 1: Auth Brute Force Protection

- **Name**: Auth brute force
- **Expression**: `(http.request.uri.path contains "/auth/" and http.request.method eq "POST")`
- **Threshold**: 10 requests per minute per IP
- **Action**: Managed Challenge
- **Exempt**: N/A
- **Rationale**: Prevents credential stuffing and brute force login attempts.

## Rule 2: Signup Abuse Prevention

- **Name**: Signup abuse
- **Expression**: `(http.request.uri.path contains "/auth/v1/signup")`
- **Threshold**: 3 requests per minute per IP
- **Action**: Block for 10 minutes
- **Exempt**: N/A
- **Rationale**: Signup is a heavy operation (creates DB rows, sends email). 3/min is generous for legitimate use.

## Rule 3: Checkout Rate Limit

- **Name**: Checkout rate limit
- **Expression**: `(http.request.uri.path contains "/checkout" or http.request.uri.path contains "/api/orders")`
- **Threshold**: 5 requests per minute per IP
- **Action**: Managed Challenge
- **Exempt**: N/A
- **Rationale**: Prevents checkout abuse and inventory manipulation. Legitimate users will not hit 5 checkouts/min.

## Rule 4: API Mutation Protection

- **Name**: API mutation protection
- **Expression**: `(http.request.uri.path matches "^/api/" and http.request.method ne "GET")`
- **Threshold**: 30 requests per minute per IP
- **Action**: Managed Challenge
- **Exempt**: Stripe webhook IPs (use IP list — see below)
- **Rationale**: Broad protection for all non-GET API calls. The 30/min threshold accommodates normal interactive use.

## Rule 5: Chat Rate Limit

- **Name**: Chat spam prevention
- **Expression**: `(http.request.uri.path contains "/comments" and http.request.method eq "POST")`
- **Threshold**: 10 requests per 10 seconds per IP
- **Action**: Block for 1 minute
- **Exempt**: N/A
- **Rationale**: Live chat during events can be high-volume but 10 messages in 10 seconds is spam.

## Rule 6: Webhook Exemption

- **Name**: Stripe webhook exemption
- **Expression**: `(http.request.uri.path eq "/webhooks/stripe")`
- **Threshold**: 120 requests per minute per IP (generous for Stripe retries)
- **Action**: Log only
- **Note**: Exempt from general rate limits. Worker-level HMAC signature verification handles abuse. The high threshold ensures Stripe retry storms are not blocked.

---

## Stripe Webhook IPs

Reference: https://stripe.com/docs/ips

Add Stripe's webhook IPs to a Cloudflare IP Access List named `stripe-webhooks` for use
in Rule 4 exemptions. Stripe publishes their IP ranges at the URL above; check periodically
for updates.

To create the IP list:
1. Cloudflare Dashboard > Manage Account > Configurations > Lists
2. Create list named `stripe-webhooks`, type: IP
3. Add Stripe webhook IPs from their documentation
4. Reference in rule expressions as `ip.src in $stripe-webhooks`

---

## Bot Fight Mode

- **Enable**: Yes, during live events
- **Challenge passage**: 30 minutes
- **Action**: Managed Challenge for likely bots
- **Configure**: Cloudflare Dashboard > Security > Bots > Bot Fight Mode

**When to enable**: At least 1 hour before event start.
**When to disable**: After event concludes and traffic normalizes.

---

## Under Attack Mode

- **When to enable**: If legitimate traffic appears impacted by bot floods, or if abnormal traffic patterns are observed (e.g., spike to 10x normal with high error rates).
- **Duration**: Enable only during active attack. Disable within 1 hour of attack subsiding.
- **Configure**: Cloudflare Dashboard > Overview > Under Attack Mode toggle.
- **Impact**: All visitors see a 5-second interstitial challenge page. This will affect legitimate users, so use sparingly.

---

## Rule Deployment Checklist

- [ ] Rule 1 (Auth brute force) created and enabled
- [ ] Rule 2 (Signup abuse) created and enabled
- [ ] Rule 3 (Checkout rate limit) created and enabled
- [ ] Rule 4 (API mutation protection) created and enabled
- [ ] Rule 5 (Chat rate limit) created and enabled
- [ ] Rule 6 (Webhook exemption) created and enabled
- [ ] Stripe webhook IP list created and populated
- [ ] Bot Fight Mode enabled
- [ ] Under Attack Mode ready (not enabled until needed)
- [ ] All rules tested with `curl` to verify they fire correctly
