const fs = require('fs');
let content = fs.readFileSync('src/pages/Login.tsx', 'utf8');

// Use typical optional chaining or check typeof process !== 'undefined'
content = content.replace(
  "const turnstileKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';",
  "const turnstileKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) || '';"
);

fs.writeFileSync('src/pages/Login.tsx', content);
