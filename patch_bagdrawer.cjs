const fs = require('fs');
const file = 'src/components/layout/BagDrawer.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { useState } from 'react';",
  "import { useState, useMemo } from 'react';"
);

content = content.replace(
  "  if (!bagOpen) return null;",
  `  if (!bagOpen) return null;

  const productMap = useMemo(() => {
    return products.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, typeof products[0]>);
  }, []);`
);

content = content.replace(
  /  const subtotal = bagItems\.reduce\(\(sum, id\) => \{\n    const product = products\.find\(p => p\.id === id\);\n    return sum \+ \(product\?\.price \?\? 0\);\n  \}, 0\);/,
  `  const subtotal = bagItems.reduce((sum, id) => {
    const product = productMap[id];
    return sum + (product?.price ?? 0);
  }, 0);`
);

content = content.replace(
  /      const product = products\.find\(p => p\.id === id\);/g,
  `      const product = productMap[id];`
);

fs.writeFileSync(file, content);
