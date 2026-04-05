const fs = require('fs');
let content = fs.readFileSync('docs/runbooks/OPERATIONS_RUNBOOK_v1.0.0.md', 'utf8');

const botProtectionChecks = `
### Verification & Validation Post-Deployment
- [ ] Verify Turnstile site key is present in environment variables (\`VITE_TURNSTILE_SITE_KEY\`).
- [ ] Validate new accounts can be created (simulating legitimate user traffic).
- [ ] Monitor Supabase connection pool usage under heavy load.`;

content = content.replace("## 5) Escalation", botProtectionChecks + "\n\n## 5) Escalation");

fs.writeFileSync('docs/runbooks/OPERATIONS_RUNBOOK_v1.0.0.md', content);
