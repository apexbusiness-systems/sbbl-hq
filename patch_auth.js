const fs = require('fs');
const content = fs.readFileSync('src/lib/api/auth.ts', 'utf8');

const updated = content.replace(
  /export async function signUpWithPassword\(email: string, password: string\) \{([\s\S]*?)const \{ error \} = await supabase\.auth\.signUp\(\{([\s\S]*?)password,([\s\S]*?)\}\);/g,
  `export async function signUpWithPassword(email: string, password: string, captchaToken?: string) {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });`
);

fs.writeFileSync('src/lib/api/auth.ts', updated);
