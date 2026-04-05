const fs = require('fs');
let code = fs.readFileSync('src/worker/index.ts', 'utf-8');

code = code.replace(
  /function json\(data: unknown, status = 200\) \{[\s\S]*?\n\}/,
  `function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}`
);

fs.writeFileSync('src/worker/index.ts', code);
