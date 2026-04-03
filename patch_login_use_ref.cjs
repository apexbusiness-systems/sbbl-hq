const fs = require('fs');
let content = fs.readFileSync('src/pages/Login.tsx', 'utf8');

// Ensure useRef is imported. It seems my patch failed to import it correctly or it got overwritten.
if (!content.includes('useRef')) {
  content = content.replace(
    "import { useState, useEffect, type FormEvent } from 'react';",
    "import { useState, useEffect, useRef, type FormEvent } from 'react';"
  );
  // Also handle if the import was already changed but missing useRef
  content = content.replace(
    "import { useState, useEffect, type FormEvent, useRef } from 'react';",
    "import { useState, useEffect, useRef, type FormEvent } from 'react';"
  );
}

fs.writeFileSync('src/pages/Login.tsx', content);
