const fs = require('fs');

const file = 'vite.config.ts';
let code = fs.readFileSync(file, 'utf8');

const buildConfig = `
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-radix';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('react-router') || id.includes('react-dom') || id.includes('react')) {
                return 'vendor-react';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-framer';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-tanstack';
              }
              return 'vendor-core';
            }
          }
        }
      }
    },
    resolve: {`;

code = code.replace('    resolve: {', buildConfig);

fs.writeFileSync(file, code);
