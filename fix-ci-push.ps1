#!/usr/bin/env pwsh
# ============================================================================
# SBBL-HQ CI Remediation Push Script
# ============================================================================
# This script:
#   1. Fetches latest from origin
#   2. Creates a fix branch from origin/main
#   3. Applies the clean Teams.tsx + updated workflow YAMLs
#   4. Commits and pushes to origin
#   5. Creates a PR via GitHub CLI (if `gh` is installed)
# ============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO_ROOT = "c:\Users\sinyo\sbbl-hq\sbbl-hq"
$BRANCH_NAME = "fix/ci-remediation-lint-node22"

Write-Host "`n=== SBBL-HQ CI Remediation ===" -ForegroundColor Cyan

# Step 1: Save current branch name so we can return to it
Push-Location $REPO_ROOT
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch" -ForegroundColor DarkGray

# Step 2: Fetch latest
Write-Host "`n[1/6] Fetching latest from origin..." -ForegroundColor Yellow
git fetch origin main

# Step 3: Create fix branch from origin/main
Write-Host "`n[2/6] Creating branch '$BRANCH_NAME' from origin/main..." -ForegroundColor Yellow
git checkout -B $BRANCH_NAME origin/main

# Step 4: Copy the clean files from the working branch
Write-Host "`n[3/6] Applying clean files..." -ForegroundColor Yellow

# Copy the clean Teams.tsx from the codex branch
git checkout $currentBranch -- src/pages/Teams.tsx
Write-Host "  - src/pages/Teams.tsx (clean, no escaped quotes)" -ForegroundColor Green

# Copy the updated workflow files
git checkout $currentBranch -- .github/workflows/ci.yml
git checkout $currentBranch -- .github/workflows/playwright-e2e.yml
Write-Host "  - .github/workflows/ci.yml (Node 22 + FORCE_JAVASCRIPT_ACTIONS_TO_NODE24)" -ForegroundColor Green
Write-Host "  - .github/workflows/playwright-e2e.yml (Node 22)" -ForegroundColor Green

# Step 5: Stage and commit
Write-Host "`n[4/6] Staging and committing..." -ForegroundColor Yellow
git add src/pages/Teams.tsx .github/workflows/ci.yml .github/workflows/playwright-e2e.yml
git commit -m "fix: remediate CI failures - clean Teams.tsx + Node 22 workflows

- Fix ESLint parsing error in Teams.tsx (remove corrupted escaped quotes)
- Upgrade GitHub Actions Node.js from 20 to 22 (20 deprecated June 2026)
- Add FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 env var for forward compatibility
- Resolves CI runs #109-#117 all failing at lint step"

# Step 6: Push
Write-Host "`n[5/6] Pushing to origin/$BRANCH_NAME..." -ForegroundColor Yellow
git push -u origin $BRANCH_NAME

# Step 7: Create PR
Write-Host "`n[6/6] Creating Pull Request..." -ForegroundColor Yellow
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh pr create `
        --title "fix: remediate CI failures - clean Teams.tsx + Node 22 workflows" `
        --body @"
## Summary
Fixes **all** CI failures from runs #109 through #117.

### Root Causes Resolved
1. **ESLint Parsing Error** - ``Teams.tsx`` on main had corrupted escaped quotes (``\"`` instead of ``"``) from a botched find-and-replace. Replaced with the clean version.
2. **Node.js 20 Deprecation** - Upgraded both workflow files from Node.js 20 to 22. Added ``FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`` for forward compatibility (Node 20 removed Sept 2026).

### Files Changed
- ``src/pages/Teams.tsx`` - Restored clean JSX (no escaped quotes)
- ``.github/workflows/ci.yml`` - Node 22 + deprecation env var
- ``.github/workflows/playwright-e2e.yml`` - Node 22

### Verification
- CI should pass on this PR (Quality Gates: lint, typecheck, test, build)
- No functional changes to Teams page logic

### Related: API 500 Fix (Separate Action)
The live site 500 errors on ``/api/teams`` require setting the ``SUPABASE_SERVICE_ROLE_KEY`` Cloudflare Worker secret (separate from this PR).
"@ `
        --base main `
        --head $BRANCH_NAME
    Write-Host "`nPR created successfully!" -ForegroundColor Green
} else {
    Write-Host "`nGitHub CLI (gh) not found. Create PR manually:" -ForegroundColor Yellow
    Write-Host "  https://github.com/apexbusiness-systems/sbbl-hq/compare/main...$BRANCH_NAME" -ForegroundColor Cyan
}

# Return to original branch
Write-Host "`nReturning to branch: $currentBranch" -ForegroundColor DarkGray
git checkout $currentBranch
Pop-Location

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host @"

NEXT STEPS:
  1. Wait for CI to pass on the PR
  2. Merge the PR to main
  3. Fix the API 500s by setting the Cloudflare Worker secret:
     cd $REPO_ROOT
     npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
     (paste the value from Supabase Dashboard > Settings > API > service_role)
  4. Redeploy: npm run cf:deploy
"@
