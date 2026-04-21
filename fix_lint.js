import fs from 'fs';

const path = 'src/pages/Live.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/streamUrl\?/g, 'stream_url?');
content = content.replace(/streamUrl/g, 'stream_url');

fs.writeFileSync(path, content, 'utf8');
