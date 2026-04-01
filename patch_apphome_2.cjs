const fs = require('fs');
const file = 'src/pages/AppHome.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<img src=\{p\.image\} alt=\{p\.name\}/g,
  `<img src={(p.metadata as Record<string, unknown>)?.image_url as string | undefined} alt={p.name}`
);

code = code.replace(
  /\{p\.colors && <p className="text-\[10px\] text-muted-foreground mt-0\.5\">\{p\.colors\[0\]\}<\/p>\}/g,
  `{(p.metadata as Record<string, unknown>)?.colors && <p className="text-[10px] text-muted-foreground mt-0.5">{((p.metadata as Record<string, unknown>)?.colors as string[])?.[0]}</p>}`
);

fs.writeFileSync(file, code);
