import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve(process.cwd(), '.github/workflows/stream-validation-prelive.yml');
let content = readFileSync(workflowPath, 'utf-8');

if (!content.includes('Post validation verdict comment')) {
  const insertion = `\n      - name: Post validation verdict comment\n        if: always() && github.event_name == 'pull_request'\n        uses: actions/github-script@v7\n        with:\n          script: |\n            const fs = require('fs');\n            let verdict = 'REJECTED';\n            let failingChecks = [];\n            try {\n              const report = JSON.parse(fs.readFileSync('validation-report.json', 'utf-8'));\n              verdict = report.final_verdict || 'REJECTED';\n              failingChecks = report.failing_checks || [];\n            } catch (_err) {\n              failingChecks = ['validation-report.json missing'];\n            }\n\n            const lines = [\n              'Stream Validation Verdict',\n              `- final_verdict: ${verdict}`,\n              `- command: node ops/validation/stream-validation.mjs prelive`,\n            ];\n\n            if (verdict !== 'VERIFIED') {\n              lines.push(`- failing_checks: ${failingChecks.join(', ') || 'unknown'}`);\n              lines.push('- remediation: resolve failing checks then rerun validate:prelive');\n            }\n\n            await github.rest.issues.createComment({\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              issue_number: context.issue.number,\n              body: lines.join('\\n'),\n            });\n`;

  content = content.replace(
    '\n      - name: Upload stream-validation artifacts',
    `${insertion}\n      - name: Upload stream-validation artifacts`,
  );

  writeFileSync(workflowPath, content);
}
