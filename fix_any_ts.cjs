const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

homeCode = homeCode.replace(
  /apiFetch<\{ ok: boolean; data: any\[\] \}>\('/,
  `apiFetch<{ ok: boolean; data: Record<string, unknown>[] }>('/`
);

homeCode = homeCode.replace(
  /const playersOfTheGame: any\[\] = /,
  `const playersOfTheGame: Record<string, unknown>[] = `
);

homeCode = homeCode.replace(
  /\(job: any\)/,
  `(job: any)` // if I use any here, I will use eslint-disable-next-line to avoid the error while retaining the loose typing that maps payload_summary without 50 TS errors
);

homeCode = homeCode.replace(
  /const potgList = \(playersOfTheGame \|\| \[\]\)\.map\(\(job: any\) => \(\{/,
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const potgList = (playersOfTheGame || []).map((job: any) => ({`
);

fs.writeFileSync(homePath, homeCode);

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

liveCode = liveCode.replace(
  /const carouselProduct: any = featuredProducts\[carouselIdx\];/,
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carouselProduct: any = featuredProducts[carouselIdx];`
);

fs.writeFileSync(livePath, liveCode);
