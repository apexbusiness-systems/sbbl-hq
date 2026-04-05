const fs = require('fs');
let code = fs.readFileSync('src/worker/index.ts', 'utf-8');

// Replace return json(...) with return json(..., 200, { "Cache-Control": "public, s-maxage=60, max-age=30" })
const REPLACEMENTS = [
  {
    regex: /(async function handleTeamsList[\s\S]*?return json\(\{ ok: true, data: filteredTeamsData \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=60, max-age=30" }$3`
  },
  {
    regex: /(async function handleScoresList[\s\S]*?return json\(\{ ok: true, data: result \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=60, max-age=30" }$3`
  },
  {
    regex: /(async function handleLeaderboards[\s\S]*?return json\(\{ ok: true, userId, data \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=60, max-age=30" }$3`
  },
  {
    regex: /(async function handleStats[\s\S]*?return json\(\{ ok: true, userId, data \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=60, max-age=30" }$3`
  },
  {
    regex: /(async function handlePublicProducts[\s\S]*?return json\(\{ ok: true, data: data \?\? \[\] \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=300, max-age=120" }$3`
  },
  {
    regex: /(async function handlePublicMedia[\s\S]*?return json\(\{ ok: true, data: mapped \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=300, max-age=120" }$3`
  },
  {
    regex: /(async function handlePublicConfig[\s\S]*?return json\(\{ ok: true, data: config \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=3600, max-age=300" }$3`
  },
  {
    regex: /(async function handlePublicHome[\s\S]*?return json\(\{ ok: true, data: homeData \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=300, max-age=120" }$3`
  },
  {
    regex: /(async function handlePublicSchedule[\s\S]*?return json\(\{ ok: true, data: scheduleData \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=60, max-age=30" }$3`
  },
  {
    regex: /(async function handlePublicPotg[\s\S]*?return json\(\{ ok: true, data: potgData \})([^\)]*)(\);)/,
    replacement: `$1$2, 200, { "Cache-Control": "public, s-maxage=300, max-age=120" }$3`
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
