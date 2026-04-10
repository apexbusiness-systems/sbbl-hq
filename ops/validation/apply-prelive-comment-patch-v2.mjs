import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve(process.cwd(), '.github/workflows/stream-validation-prelive.yml');
let content = readFileSync(workflowPath, 'utf-8');

if (!content.includes('Post validation verdict comment')) {
  const insertion = [
    '',
    '      - name: Post validation verdict comment',
    "        if: always() && github.event_name == 'pull_request'",
    '        uses: actions/github-script@v7',
    '        with:',
    '          script: |',
    "            const fs = require('fs');",
    "            let verdict = 'REJECTED';",
    '            let failingChecks = [];',
    '            try {',
    "              const report = JSON.parse(fs.readFileSync('validation-report.json', 'utf-8'));",
    "              verdict = report.final_verdict || 'REJECTED';",
    '              failingChecks = report.failing_checks || [];',
    '            } catch (_err) {',
    "              failingChecks = ['validation-report.json missing'];",
    '            }',
    '',
    '            const lines = [',
    "              'Stream Validation Verdict',",
    "              '- final_verdict: ' + verdict,",
    "              '- command: node ops/validation/stream-validation.mjs prelive',",
    '            ];',
    '',
    "            if (verdict !== 'VERIFIED') {",
    "              lines.push('- failing_checks: ' + (failingChecks.join(', ') || 'unknown'));",
    "              lines.push('- remediation: resolve failing checks then rerun validate:prelive');",
    '            }',
    '',
    '            await github.rest.issues.createComment({',
    '              owner: context.repo.owner,',
    '              repo: context.repo.repo,',
    '              issue_number: context.issue.number,',
    "              body: lines.join('\\n'),",
    '            });',
  ].join('\n');

  content = content.replace(
    '\n      - name: Upload stream-validation artifacts',
    `${insertion}\n      - name: Upload stream-validation artifacts`,
  );

  writeFileSync(workflowPath, content);
}
