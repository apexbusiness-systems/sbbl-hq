#!/bin/bash
# Universal validation — checks skill file integrity (no Python/LLM required)
SKILL_DIR="$(dirname "$0")/.."
PASS=0; FAIL=0

check() { 
  if grep -q "$2" "$SKILL_DIR/$1" 2>/dev/null; then 
    echo "✅ $3"; PASS=$((PASS+1))
  else 
    echo "❌ $3"; FAIL=$((FAIL+1))
  fi
}

check "SKILL.md" "sbbl-hq-worker"      "Worker name frozen present"
check "SKILL.md" "Cloudflare Workers"   "Correct hosting (not Vercel)"
check "SKILL.md" "Vite + React"         "Correct frontend (not Next.js)"
check "SKILL.md" "Space Grotesk"        "Correct brand font"
check "SKILL.md" "get_active_broadcast" "Broadcast oracle referenced"
check "SKILL.md" "OmniBridge"           "OmniBridge section present"
check "SKILL.md" "NO MOCK IN PROD"      "Iron Law 1 present"
check "SKILL.md" "STREAM"               "Stream independence law present"
check "references/hard-rules.md" "M-01" "M-01 incident fix documented"
check "references/omnibridge-deep.md" "disable_stream" "9-action allowlist present"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] && echo "✅ SKILL INTEGRITY VERIFIED" || echo "❌ FIX FAILURES BEFORE USE"
