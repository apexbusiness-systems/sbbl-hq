const fs = require('fs');
const path = require('path');

const testPath = path.join(__dirname, 'src', 'test', 'home-hero-fallback.test.tsx');
let testCode = fs.readFileSync(testPath, 'utf8');

if (!testCode.includes('QueryClientProvider')) {
  testCode = testCode.replace(
    /import \{ AppProvider \} from '@\/contexts\/AppContext';/,
    `import { AppProvider } from '@/contexts/AppContext';\nimport { QueryClient, QueryClientProvider } from '@tanstack/react-query';`
  );

  testCode = testCode.replace(
    /describe\('home hero fallback', \(\) => \{/,
    `const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });\n\ndescribe('home hero fallback', () => {`
  );

  testCode = testCode.replace(
    /<BrowserRouter>/g,
    `<QueryClientProvider client={queryClient}>\n        <BrowserRouter>`
  );

  testCode = testCode.replace(
    /<\/BrowserRouter>/g,
    `</BrowserRouter>\n      </QueryClientProvider>`
  );

  fs.writeFileSync(testPath, testCode);
}
