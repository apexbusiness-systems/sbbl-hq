const fs = require('fs');

const code = fs.readFileSync('src/worker/index.ts', 'utf-8');

const importJose = `import { createRemoteJWKSet, jwtVerify } from "jose";\n`;

const getSessionRegex = /async function getSession\(req: Request, env: Env\) \{[\s\S]*?return null;\n\}/;

const newGetSession = `let jwksClient: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getSession(req: Request, env: Env) {
  const token = getBearerToken(req);
  if (!token || !env.SUPABASE_URL) return null;

  try {
    if (!jwksClient) {
      const url = new URL("/auth/v1/jwks", env.SUPABASE_URL);
      jwksClient = createRemoteJWKSet(url);
    }

    const { payload } = await jwtVerify(token, jwksClient, {
      issuer: \`\${env.SUPABASE_URL}/auth/v1\`,
      audience: "authenticated",
    });

    if (payload && payload.sub) {
      return {
        userId: payload.sub,
        roles: (payload.user_role ? [payload.user_role] : ["fan"]) as string[],
      };
    }
  } catch (error) {
    console.error("JWT Verification failed:", error);
  }

  return null;
}`;

let newCode = importJose + code;
newCode = newCode.replace(getSessionRegex, newGetSession);

fs.writeFileSync('src/worker/index.ts', newCode);
console.log('Updated src/worker/index.ts');
