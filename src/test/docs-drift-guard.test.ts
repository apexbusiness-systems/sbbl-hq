import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('Docs Drift Guard (CI Only)', () => {
  it('enforces changelog updates when critical configs change', () => {
    // Only run this check in CI or if explicitly triggered, to avoid blocking fast local dev iteration
    if (!process.env.CI && !process.env.STRICT_DRIFT) {
      console.log('Skipping docs drift guard outside of CI (set STRICT_DRIFT=1 to run)');
      return;
    }

    try {
      // Get files changed in the current commit or branch
      const diffOutput = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' });
      const changedFiles = diffOutput.split('\n').filter(Boolean);

      const criticalConfigs = ['wrangler.jsonc', 'vite.config.ts', '.github/workflows/deploy.yml', 'package.json'];
      const docsFiles = ['CHANGELOG.md', 'docs/CHANGELOG.md', 'docs/README.md'];

      const hasConfigChanges = changedFiles.some(file => criticalConfigs.includes(file));
      const hasDocsChanges = changedFiles.some(file => docsFiles.includes(file) || file.startsWith('omni-recall/wiki/corrections/'));

      if (hasConfigChanges && !hasDocsChanges) {
        throw new Error(
          `Drift detected: Critical configs were changed but no documentation/changelogs were updated.\n` +
          `Changed configs: ${changedFiles.filter(f => criticalConfigs.includes(f)).join(', ')}\n` +
          `Required action: Update CHANGELOG.md, docs/CHANGELOG.md, or add a correction log.`
        );
      }

      expect(true).toBe(true);
    } catch (e) {
      // If git fails (e.g., no HEAD~1), assume this is an initial commit or detached head and skip cleanly.
      if (e instanceof Error && e.message.includes('fatal:')) {
        console.warn('Could not read git history for drift guard; skipping.', e.message);
        return;
      }
      throw e;
    }
  });
});
