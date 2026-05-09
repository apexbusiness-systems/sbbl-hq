/**
 * Data-pipeline guardrail (see docs/protocols/no-mock-in-production.md).
 *
 * This test is the second line of defense behind the ESLint
 * `no-restricted-imports` rule in eslint.config.js. Even if someone disables
 * lint locally, or bypasses CI, this test will fail in vitest and block the
 * merge.
 *
 * WHAT IT ASSERTS
 *   - No file under src/pages/** imports from the test-only fixture files
 *     (@/data/mock, @/data/schedules, @/data/teams).
 *   - No file under src/components/** does the same.
 *   - No file under src/hooks/**, src/contexts/**, src/worker/**, or
 *     src/lib/** (excluding tests) does the same.
 *
 * WHY
 *   The three fixture files exist to support tests and Storybook. Production
 *   pages rendering from them mask broken data pipelines (empty DB, auth
 *   misconfig, worker outage) behind fake data. This has repeatedly shipped
 *   stale leaderboards and phantom scores to end users.
 *
 * HOW TO FIX A FAILURE
 *   Remove the fixture import. Fetch the real data from the worker
 *   (/api/public/* endpoints — see docs/protocols/no-mock-in-production.md).
 *   If you only need league identity metadata, use LEAGUE_REGISTRY from
 *   '@/lib/leagues' — the canonical branding source.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const SRC = join(REPO_ROOT, 'src');

// Directories that MUST NOT import the fixture files. Tests are exempt.
const PROD_DIRS = [
  'pages',
  'components',
  'hooks',
  'contexts',
  'worker',
  'lib',
];

// File suffixes that are allowed to import fixtures (tests + stories).
const TEST_SUFFIXES = /\.(test|spec|stories)\.(ts|tsx)$/;

// Directory exclusions (test-only roots inside production dirs).
const EXCLUDED_DIR_SEGMENTS = [
  join('src', 'test'),
  join('src', 'worker', 'tests'),
];

// Import patterns that point at fixture files. Kept in sync with the ESLint
// rule in eslint.config.js.
const FORBIDDEN_IMPORT_RE =
  /from\s+['"](?:@\/data\/(?:mock|mock\.[^'"]+|schedules|teams)|(?:\.\.?\/)+data\/(?:mock|mock\.[^'"]+|schedules|teams))['"]/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function collectProdFiles(): string[] {
  const files: string[] = [];
  for (const dirName of PROD_DIRS) {
    const dir = join(SRC, dirName);
    try {
      statSync(dir);
    } catch {
      continue;
    }
    files.push(...walk(dir));
  }
  return files.filter((f) => {
    if (TEST_SUFFIXES.test(f)) return false;
    const rel = relative(REPO_ROOT, f);
    return !EXCLUDED_DIR_SEGMENTS.some((seg) => rel.startsWith(seg));
  });
}

describe('no-mock-in-production guardrail', () => {
  const violations: Array<{ file: string; matches: string[] }> = [];

  for (const file of collectProdFiles()) {
    const src = readFileSync(file, 'utf8');
    const matches: string[] = [];
    for (const line of src.split('\n')) {
      if (FORBIDDEN_IMPORT_RE.test(line)) {
        matches.push(line.trim());
      }
    }
    if (matches.length > 0) {
      violations.push({ file: relative(REPO_ROOT, file), matches });
    }
  }

  it('no production file imports from @/data/{mock,schedules,teams}', () => {
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `  ✗ ${v.file}\n    ${v.matches.join('\n    ')}`)
        .join('\n');
      throw new Error(
        `Production code must not import from fixture files. ` +
          `Use /api/public/* worker endpoints instead. ` +
          `See docs/protocols/no-mock-in-production.md.\n\n` +
          `Offending files:\n${summary}`,
      );
    }
    expect(violations).toEqual([]);
  });

  // Second assertion: the raw fixture identifiers must not appear as
  // standalone references in production files (catches someone who copy/pastes
  // the fixture contents inline).
  it('no production file re-declares known fixture identifiers', () => {
    const FIXTURE_IDENTS = [
      'playersOfTheGame',
      'SCHEDULE_DATA',
      'STATIC_TEAMS',
    ];
    const redeclared: Array<{ file: string; ident: string }> = [];
    for (const file of collectProdFiles()) {
      const src = readFileSync(file, 'utf8');
      for (const ident of FIXTURE_IDENTS) {
        const re = new RegExp(
          `(?:const|let|var|export\\s+const)\\s+${ident}\\b`,
        );
        if (re.test(src)) {
          redeclared.push({ file: relative(REPO_ROOT, file), ident });
        }
      }
    }
    expect(redeclared).toEqual([]);
  });
});
