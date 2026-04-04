const fs = require('fs');
let code = fs.readFileSync('src/pages/Live.tsx', 'utf-8');
code = code.replace(/customStreamUrl=\{customStreamUrl\}\n                isCloudflareStream=\{streamSource === 'cloudflare'\}/g, 'customStreamUrl={customStreamUrl}');
code = code.replace(/isStreamLive=\{isStreamLive\}\n                customStreamUrl=\{customStreamUrl\}/g, 'isStreamLive={isStreamLive}\n                customStreamUrl={customStreamUrl}\n                isCloudflareStream={streamSource === "cloudflare"}');

fs.writeFileSync('src/pages/Live.tsx', code);
console.log('Fixed src/pages/Live.tsx');
