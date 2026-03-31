const fs = require('fs');
const path = require('path');

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

liveCode = liveCode.replace(
  /const carouselProduct = featuredProducts\[carouselIdx\];/,
  `const carouselProduct: any = featuredProducts[carouselIdx];`
);

fs.writeFileSync(livePath, liveCode);
