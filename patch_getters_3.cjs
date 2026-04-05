const fs = require('fs');
let code = fs.readFileSync('src/worker/index.ts', 'utf-8');

// Replace return json(...) with return json(..., 200, { "Cache-Control": "public, s-maxage=60, max-age=30" })
const REPLACEMENTS = [
  {
    regex: /(async function handleScoresList[\s\S]*?return json\(\{ ok: true, games: filtered, nextCursor \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=60, max-age=30" }$3`
  }
];

REPLACEMENTS.forEach(r => {
  if (r.regex.test(code)) {
    code = code.replace(r.regex, r.replacement);
    console.log("Replaced for " + r.regex.toString().substring(0, 50));
  } else {
    console.log("COULD NOT FIND " + r.regex.toString().substring(0, 50));
  }
});

fs.writeFileSync('src/worker/index.ts', code);
