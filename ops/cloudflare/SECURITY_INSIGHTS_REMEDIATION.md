# Cloudflare Security Insights Remediation

This runbook maps the May 2026 Cloudflare Security Insights findings for `sbbl-hq.icu` to repo-owned controls and the API automation in `ops/cloudflare/apply-security-insights.mjs`.

## Findings covered

| Cloudflare finding | Remediation |
| --- | --- |
| Domains without Always Use HTTPS | `cf:security:apply` enables the zone `always_use_https` setting. |
| Domains without HSTS | The Worker already emits `Strict-Transport-Security`; `cf:security:apply` also enables Cloudflare's zone `security_header` HSTS setting with `include_subdomains` and `preload`. |
| Domains missing TLS Encryption | `cf:security:apply` sets SSL mode to `strict`, enables TLS 1.3, and enforces minimum TLS 1.2. |
| Review unwanted AI crawlers with AI Labyrinth | `cf:security:apply` enables Bot Management `crawler_protection` and blocks AI bots. |
| DMARC Record Error detected | `cf:security:apply` idempotently manages `_dmarc.sbbl-hq.icu` and `_dmarc.send.sbbl-hq.icu` TXT records. |
| Security.txt not configured | `public/.well-known/security.txt` and `public/security.txt` are shipped as static assets. |

## Required Cloudflare API permissions

Create a scoped API token for the `sbbl-hq.icu` zone with:

- `Zone Settings:Edit`
- `DNS:Edit`
- `Bot Management:Edit`

Do not commit the token. Export it only in the deployment shell or CI secret store.

## Dry-run

```bash
CF_ZONE_ID='<zone-id>' \
CF_API_TOKEN='<api-token>' \
npm run cf:security:plan
```

## Apply

```bash
CF_ZONE_ID='<zone-id>' \
CF_API_TOKEN='<api-token>' \
DMARC_RUA='mailto:<cloudflare-dmarc-rua>@dmarc-reports.cloudflare.net' \
npm run cf:security:apply
```

`DMARC_RUA` is optional, but recommended if Cloudflare DMARC Management is enabled. If Cloudflare has issued exact DMARC record values, pass them as `ROOT_DMARC_RECORD` and `SEND_DMARC_RECORD` to preserve the Cloudflare-managed report mailbox.

## Underscore hostnames

`_dmarc.sbbl-hq.icu` and `_domainconnect.sbbl-hq.icu` are non-web DNS labels. They should not have proxied `A`, `AAAA`, or `CNAME` records. The script prints a manual-action warning for any such records because deleting DNS records without operator review can break third-party domain verification.

## Post-apply verification

```bash
curl -I https://sbbl-hq.icu/.well-known/security.txt
curl -I https://sbbl-hq.icu/ | rg -i 'strict-transport-security|content-security-policy|x-content-type-options'
dig +short TXT _dmarc.sbbl-hq.icu
dig +short TXT _dmarc.send.sbbl-hq.icu
```

Then run Cloudflare Security Center > Security Insights > Scan now for `sbbl-hq.icu`.
