const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

homeCode = homeCode.replace(
  /pts: parseInt\(job\.payload_summary\.pts \|\| '0'\),/g,
  `pts: parseInt(String(job.payload_summary.pts || '0')),`
);

homeCode = homeCode.replace(
  /rebs: parseInt\(job\.payload_summary\.rebs \|\| '0'\),/g,
  `rebs: parseInt(String(job.payload_summary.rebs || '0')),`
);

homeCode = homeCode.replace(
  /assts: parseInt\(job\.payload_summary\.assts \|\| '0'\),/g,
  `assts: parseInt(String(job.payload_summary.assts || '0')),`
);

homeCode = homeCode.replace(
  /leagueId: job\.payload_summary\.leagueId \|\| resolvedLeague,/g,
  `leagueId: (job.payload_summary.leagueId as LeagueId) || resolvedLeague,`
);

fs.writeFileSync(homePath, homeCode);

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

// The best way to resolve Live.tsx carouselProduct is to actually use the interface that matches products
liveCode = liveCode.replace(
  /const carouselProduct: Record<string, unknown> = featuredProducts\[carouselIdx\] as Record<string, unknown>;/,
  `const carouselProduct: Product = featuredProducts[carouselIdx] as Product;`
);

// We need to import Product or just define it if it's missing, but it is likely already imported or inferred.
// Oh, the file might not have Product imported.
if (!liveCode.includes('type Product =') && !liveCode.includes('interface Product')) {
    const pType = `type Product = { id: string; name: string; image: string; price: number; colors?: string[]; };\n`;
    liveCode = liveCode.replace(
        /const LivePage = \(\) => \{/,
        `${pType}const LivePage = () => {`
    );
}

fs.writeFileSync(livePath, liveCode);
