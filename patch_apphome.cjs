const fs = require('fs');
const file = 'src/pages/AppHome.tsx';
let code = fs.readFileSync(file, 'utf8');

// Remove mock imports
code = code.replace(`import { products, playersOfTheGame } from '@/data/mock';`, `import { useQuery } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';\nimport type { PlayerOfTheGame } from '@/types';`);

// Add queries inside component
code = code.replace(
  `const featuredProducts = products.filter(p => p.sale && p.price > 0).slice(0, 3);`,
  `const productsQuery = useQuery({\n    queryKey: ['public-products-home'],\n    queryFn: () => apiFetch<{ ok: boolean; data: Array<{ id: string; name: string; price: number; status: string; metadata?: Record<string, unknown> }> }>('/api/public/products'),\n    staleTime: 60_000,\n  });\n  const featuredProducts = (productsQuery.data?.data ?? []).slice(0, 3);\n\n  const potgQuery = useQuery({\n    queryKey: ['public-potg-home'],\n    queryFn: () => apiFetch<{ ok: boolean; data: PlayerOfTheGame[] }>('/api/public/potg?limit=4'),\n    staleTime: 60_000,\n  });\n  const recentPotg = potgQuery.data?.data ?? [];`
);

// Replace all playersOfTheGame references
code = code.replace(/playersOfTheGame/g, `recentPotg`);

// Replace product.image with metadata extraction
code = code.replace(/<img src=\{product\.image\} alt=\{product\.name\}/g, `<img src={(product.metadata as Record<string, unknown>)?.image_url as string | undefined} alt={product.name}`);

fs.writeFileSync(file, code);
