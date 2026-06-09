#!/bin/bash
for file in .github/workflows/*.yml; do
  sed -i "s|VITE_SUPABASE_URL: \${{ secrets.VITE_SUPABASE_URL || '' }}|VITE_SUPABASE_URL: \${{ secrets.VITE_SUPABASE_URL \|\| 'https://test-project-ref.supabase.co' }}|g" "$file"
done
