const fs = require('fs');
let content = fs.readFileSync('src/pages/Login.tsx', 'utf8');

// Imports
content = content.replace(
  "import { useAuth } from '@/contexts/AuthContext';",
  "import { useAuth } from '@/contexts/AuthContext';\nimport { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';"
);
content = content.replace(
  "import { useState, useEffect, type FormEvent } from 'react';",
  "import { useState, useEffect, type FormEvent, useRef } from 'react';"
);

// Get the key
content = content.replace(
  "const LoginPage = () => {",
  "const LoginPage = () => {\n  const turnstileKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';"
);

// State vars
content = content.replace(
  "  const [submitting, setSubmitting] = useState(false);",
  "  const [submitting, setSubmitting] = useState(false);\n  const [captchaToken, setCaptchaToken] = useState<string | null>(null);\n  const [captchaError, setCaptchaError] = useState<boolean>(false);\n  const turnstileRef = useRef<TurnstileInstance>(null);"
);

// Fallback timer
content = content.replace(
  "  const redirectTo = urlParams.get('redirect');",
  `  const redirectTo = urlParams.get('redirect');
  useEffect(() => {
    let timer: any;
    if (mode === 'signup' && turnstileKey) {
      setCaptchaError(false);
      timer = setTimeout(() => {
        if (!captchaToken) {
          setCaptchaError(true);
        }
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [mode, captchaToken, turnstileKey]);`
);

// onSubmit error logic & captcha param
content = content.replace(
  "        await signUpWithPassword(email, password);",
  `        if (turnstileKey && !captchaToken) {
          throw new Error('Security check failed. Please wait or refresh the page.');
        }
        await signUpWithPassword(email, password, captchaToken || undefined);`
);

// switchMode clearing
content = content.replace(
  "    setPassword('');",
  "    setPassword('');\n    setCaptchaToken(null);\n    setCaptchaError(false);\n    turnstileRef.current?.reset();"
);

// Render turnstile & error
content = content.replace(
  "              <button",
  `              {mode === 'signup' && turnstileKey && (
                <div className="hidden">
                  <Turnstile
                    siteKey={turnstileKey}
                    onSuccess={setCaptchaToken}
                    onError={() => setCaptchaError(true)}
                    options={{ theme: 'dark' }}
                    ref={turnstileRef}
                  />
                </div>
              )}
              {captchaError && mode === 'signup' && (
                <p className="text-sm text-destructive">Security check taking too long. Please disable ad-blockers or refresh the page.</p>
              )}
              <button`
);

fs.writeFileSync('src/pages/Login.tsx', content);
