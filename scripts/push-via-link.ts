import fs from 'node:fs';
import { execSync } from 'node:child_process';

async function main() {
  const envPath = 'C:\\Users\\sinyo\\Desktop\\ENV\\SBBL-HQ -ENV.md';
  const envContent = fs.readFileSync(envPath, 'utf8');

  const dbPassMatch = envContent.match(/database password\s*-\s*([^\r\n]+)/);
  const tokenMatch = envContent.match(/SUPABASE_TOKEN=([^\s]+)/);
  const urlMatch = envContent.match(/SUPABASE_URL=(https:\/\/[^\s]+)/);

  if (!urlMatch || !tokenMatch || !dbPassMatch) {
    console.error('Failed to parse credentials from ENV file.');
    process.exit(1);
  }

  const supabaseUrl = urlMatch[1].trim();
  const token = tokenMatch[1].trim();
  const dbPass = dbPassMatch[1].trim();
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  console.log(`Linking project ${projectRef}...`);
  try {
    const linkOutput = execSync(`npx supabase link --project-ref ${projectRef} --password "${dbPass}"`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('Link output:', linkOutput);
  } catch (err: any) {
    console.log('Link output / note:', err.stdout || err.message);
  }

  console.log('Pushing migrations via CLI...');
  try {
    const pushOutput = execSync(`npx supabase db push --password "${dbPass}"`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('Push output:', pushOutput);
  } catch (err: any) {
    console.log('Push output / note:', err.stdout || err.stderr || err.message);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
