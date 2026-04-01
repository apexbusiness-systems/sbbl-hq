const fs = require('fs');
const file = 'src/components/layout/BagDrawer.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace mock import
code = code.replace(`import { products } from '@/data/mock';`, `import { useQuery } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';`);

// Insert query inside BagDrawer
code = code.replace(
  `export const BagDrawer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {`,
  `export const BagDrawer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {\n  const productsQuery = useQuery({\n    queryKey: ['public-products-bag'],\n    queryFn: () => apiFetch<{ ok: boolean; data: Array<{ id: string; name: string; price: number; metadata?: Record<string, unknown> }> }>('/api/public/products'),\n    staleTime: 60_000,\n  });\n  const products = productsQuery.data?.data ?? [];`
);

// Map images to metadata url
code = code.replace(/<img src=\{itemProduct\.image\} alt=\{itemProduct\.name\}/g, `<img src={(itemProduct.metadata as Record<string, unknown>)?.image_url as string | undefined} alt={itemProduct.name}`);

fs.writeFileSync(file, code);
