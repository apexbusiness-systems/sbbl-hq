#!/usr/bin/env node
/**
 * Remediates Cloudflare Security Insights for sbbl-hq.icu.
 *
 * Required env:
 *   CF_API_TOKEN  Cloudflare API token with Zone Settings:Edit, DNS:Edit,
 *                 and Bot Management:Edit on the target zone.
 *   CF_ZONE_ID    Cloudflare zone id for sbbl-hq.icu.
 *
 * Optional env:
 *   CF_ZONE_NAME          Defaults to sbbl-hq.icu.
 *   DMARC_RUA            Aggregate-report mailto URI, for example
 *                        mailto:<uuid>@dmarc-reports.cloudflare.net.
 *   ROOT_DMARC_RECORD    Full _dmarc.<zone> TXT value override.
 *   SEND_DMARC_RECORD    Full _dmarc.send.<zone> TXT value override.
 */

const API_BASE = 'https://api.cloudflare.com/client/v4';
const APPLY = process.argv.includes('--apply');
const zoneId = process.env.CF_ZONE_ID;
const token = process.env.CF_API_TOKEN;
const zoneName = process.env.CF_ZONE_NAME ?? 'sbbl-hq.icu';

const rootDmarc =
  process.env.ROOT_DMARC_RECORD ??
  `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; pct=100${process.env.DMARC_RUA ? `; rua=${process.env.DMARC_RUA}` : ''}`;
const sendDmarc =
  process.env.SEND_DMARC_RECORD ??
  `v=DMARC1; p=reject; adkim=s; aspf=s; pct=100${process.env.DMARC_RUA ? `; rua=${process.env.DMARC_RUA}` : ''}`;

function assertEnv() {
  const missing = [];
  if (!zoneId) missing.push('CF_ZONE_ID');
  if (!token) missing.push('CF_API_TOKEN');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}

async function cf(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ success: false, errors: [{ message: 'non_json_response' }] }));
  if (!res.ok || json.success === false) {
    const details = (json.errors ?? []).map((error) => error.message).join('; ') || res.statusText;
    throw new Error(`${method} ${path} failed: ${details}`);
  }
  return json.result;
}

async function mutate(label, method, path, body) {
  if (!APPLY) {
    console.log(`[dry-run] ${label}: ${method} ${path}`);
    if (body !== undefined) console.log(JSON.stringify(body, null, 2));
    return undefined;
  }
  const result = await cf(method, path, body);
  console.log(`[applied] ${label}`);
  return result;
}

async function setZoneSetting(id, value) {
  await mutate(`zone setting ${id}`, 'PATCH', `/zones/${zoneId}/settings/${id}`, { value });
}

async function upsertTxtRecord(name, content, comment) {
  const query = new URLSearchParams({ type: 'TXT', name }).toString();
  const existing = await cf('GET', `/zones/${zoneId}/dns_records?${query}`);
  const desired = { type: 'TXT', name, content, ttl: 3600, comment };

  if (existing.length === 0) {
    await mutate(`create TXT ${name}`, 'POST', `/zones/${zoneId}/dns_records`, desired);
    return;
  }

  const [primary, ...duplicates] = existing;
  await mutate(`update TXT ${name}`, 'PUT', `/zones/${zoneId}/dns_records/${primary.id}`, desired);

  for (const duplicate of duplicates) {
    await mutate(`delete duplicate TXT ${name} (${duplicate.id})`, 'DELETE', `/zones/${zoneId}/dns_records/${duplicate.id}`);
  }
}

async function flagWebRecordsForUnderscoreHost(name) {
  const recordTypes = ['A', 'AAAA', 'CNAME'];
  for (const type of recordTypes) {
    const query = new URLSearchParams({ type, name }).toString();
    const records = await cf('GET', `/zones/${zoneId}/dns_records?${query}`);
    for (const record of records) {
      console.warn(
        `[manual-action] ${name} has ${type} record ${record.id}; remove or unproxy it if Cloudflare still reports TLS/HTTPS/HSTS findings for this non-web hostname.`,
      );
    }
  }
}

async function enableBotProtections() {
  const current = await cf('GET', `/zones/${zoneId}/bot_management`);
  const writableKeys = [
    'ai_bots_protection',
    'auto_update_model',
    'bm_cookie_enabled',
    'cf_robots_variant',
    'content_bots_protection',
    'crawler_protection',
    'enable_js',
    'fight_mode',
    'is_robots_txt_managed',
    'optimize_wordpress',
    'sbfm_definitely_automated',
    'sbfm_likely_automated',
    'sbfm_static_resource_protection',
    'sbfm_verified_bots',
  ];
  const desired = Object.fromEntries(
    writableKeys
      .filter((key) => current[key] !== undefined)
      .map((key) => [key, current[key]]),
  );

  // Preserve existing bot controls while enabling Cloudflare's AI-crawler protections.
  desired.ai_bots_protection = 'block';
  desired.crawler_protection = 'enabled';

  await mutate('AI crawler protection + AI Labyrinth', 'PUT', `/zones/${zoneId}/bot_management`, desired);
}

async function main() {
  assertEnv();
  console.log(`${APPLY ? 'Applying' : 'Planning'} Cloudflare Security Insights remediation for ${zoneName}`);

  await setZoneSetting('ssl', 'strict');
  await setZoneSetting('always_use_https', 'on');
  await setZoneSetting('automatic_https_rewrites', 'on');
  await setZoneSetting('min_tls_version', '1.2');
  await setZoneSetting('tls_1_3', 'on');
  await setZoneSetting('security_header', {
    strict_transport_security: {
      enabled: true,
      max_age: 63072000,
      include_subdomains: true,
      preload: true,
      nosniff: true,
    },
  });

  await enableBotProtections();

  await upsertTxtRecord(
    `_dmarc.${zoneName}`,
    rootDmarc,
    'Managed by ops/cloudflare/apply-security-insights.mjs',
  );
  await upsertTxtRecord(
    `_dmarc.send.${zoneName}`,
    sendDmarc,
    'Managed by ops/cloudflare/apply-security-insights.mjs',
  );

  await flagWebRecordsForUnderscoreHost(`_dmarc.${zoneName}`);
  await flagWebRecordsForUnderscoreHost(`_domainconnect.${zoneName}`);

  console.log(APPLY ? 'Cloudflare remediation complete.' : 'Dry-run complete. Re-run with --apply to mutate Cloudflare.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
