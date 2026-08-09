/**
 * Shared credential loader for the one-off operator scripts in `scripts/`.
 *
 * Resolution order (first hit wins, per key):
 *   - When `SBBL_ENV_FILE` is set, that file wins over `process.env`. An
 *     explicitly-named credential file is a deliberate operator choice and must
 *     beat whatever happens to be exported in the shell. This is not academic:
 *     a workstation with an unrelated `SUPABASE_URL` exported silently
 *     retargeted these scripts at the wrong project.
 *   - Otherwise `process.env` wins — the path used in CI / GitHub Actions.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * The operator ENV file is authored as **Markdown**, so underscores arrive
 * backslash-escaped:
 *
 *     SUPABASE\_ACCESS\_TOKEN=sbp\_badb23978d0657255b0a7dbdf5c235a3aa45769c
 *
 * Every previous script matched on `/SUPABASE_URL=.../` against that raw text,
 * which never matches — so they all exited with "Failed to parse credentials"
 * before touching the database. `stripMarkdownEscapes` removes the escapes from
 * both the key and the value before parsing, which is what makes these scripts
 * actually run. Do not "simplify" it away.
 */

import fs from 'node:fs';

/** Default workstation location. Overridable via `SBBL_ENV_FILE`. */
const DEFAULT_ENV_FILE = 'C:\\Users\\sinyo\\Desktop\\ENV\\SBBL-HQ -ENV.md';

export interface SbblCredentials {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string | null;
  accessToken: string | null;
  dbPassword: string | null;
  /** Derived from the Supabase URL host, e.g. `ezanilxygnpucwkwpsoc`. */
  projectRef: string;
}

/**
 * Remove Markdown backslash-escaping (`\_` → `_`, `\*` → `*`, …) so keys and
 * values parse identically whether the source is a .env file or a .md file.
 */
export function stripMarkdownEscapes(text: string): string {
  return text.replace(/\\([_*`[\]()#+\-.!])/g, '$1');
}

/** Parse `KEY=value` pairs out of an ENV-ish document. */
function parseEnvDocument(raw: string): Record<string, string> {
  const text = stripMarkdownEscapes(raw);
  const out: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (match) out[match[1]] = match[2].trim();
  }

  // The DB password is written prose-style in the operator file, e.g.
  // `database password - <value>` rather than as a KEY=value pair.
  const dbPass = text.match(/database password\s*-\s*([^\r\n]+)/i);
  if (dbPass && !out.SUPABASE_DB_PASSWORD) {
    out.SUPABASE_DB_PASSWORD = dbPass[1].trim();
  }

  return out;
}

/** Read the optional operator ENV file. Returns `{}` when absent. */
function readEnvFile(): Record<string, string> {
  const envPath = process.env.SBBL_ENV_FILE || DEFAULT_ENV_FILE;
  if (!fs.existsSync(envPath)) return {};
  return parseEnvDocument(fs.readFileSync(envPath, 'utf8'));
}

/**
 * Load Supabase credentials. Throws with an actionable message when a required
 * value is missing — never returns a half-populated object.
 */
export function loadSbblCredentials(): SbblCredentials {
  const file = readEnvFile();
  // An explicitly-named ENV file outranks ambient shell exports; see header.
  const fileWins = Boolean(process.env.SBBL_ENV_FILE);

  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = fileWins
        ? (file[key] ?? process.env[key])
        : (process.env[key] ?? file[key]);
      if (value) return value.trim();
    }
    return null;
  };

  const supabaseUrl = pick('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = pick('SUPABASE_SERVICE_ROLE_KEY');

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required credential(s): ${missing.join(', ')}.\n` +
        `Set them in the environment, or point SBBL_ENV_FILE at your operator ENV file.`
    );
  }

  return {
    supabaseUrl: supabaseUrl as string,
    serviceRoleKey: serviceRoleKey as string,
    anonKey: pick('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    accessToken: pick('SUPABASE_ACCESS_TOKEN', 'SUPABASE_TOKEN'),
    dbPassword: pick('SUPABASE_DB_PASSWORD'),
    projectRef: new URL(supabaseUrl as string).hostname.split('.')[0]
  };
}

/**
 * Resolve the admin email a script should act on.
 * Order: CLI arg → `ADMIN_EMAIL` → the supplied default.
 */
export function resolveTargetEmail(fallback: string): string {
  const raw = process.argv[2] || process.env.ADMIN_EMAIL || fallback;
  return raw.trim().toLowerCase();
}
