const fs = require('fs');
let content = fs.readFileSync('src/pages/Login.tsx', 'utf8');

// I replaced imports earlier but they didn't match the actual file header.
content = content.replace(
  "import { FormEvent, useEffect, useState } from 'react';",
  "import { FormEvent, useEffect, useState, useRef } from 'react';"
);

if (!content.includes('import { Turnstile')) {
  content = content.replace(
    "import { Shield, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';",
    "import { Shield, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';\nimport { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';"
  );
}

fs.writeFileSync('src/pages/Login.tsx', content);
