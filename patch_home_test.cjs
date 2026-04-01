const fs = require('fs');
const file = 'src/test/home-hero-fallback.test.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `import { AppProvider } from '@/contexts/AppContext';`,
  `import { AppProvider } from '@/contexts/AppContext';\nimport { QueryClient, QueryClientProvider } from '@tanstack/react-query';`
);

code = code.replace(
  `describe('home hero fallback', () => {`,
  `describe('home hero fallback', () => {\n  const queryClient = new QueryClient();`
);

code = code.replace(
  /<BrowserRouter>/g,
  `<QueryClientProvider client={queryClient}>\n        <BrowserRouter>`
);

code = code.replace(
  /<\/BrowserRouter>/g,
  `</BrowserRouter>\n      </QueryClientProvider>`
);

fs.writeFileSync(file, code);
