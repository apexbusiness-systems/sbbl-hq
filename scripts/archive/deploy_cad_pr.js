const fs = require('fs');

const TOKEN = process.env.GH_TOKEN;
// Canonical remote as of the 2026-08-09 migration. Override with GH_REPO when
// operating against a fork or the archived apexbusiness-systems/sbbl-hq repo.
// See docs/ops/REPO_MIGRATION_2026-08-09.md.
const REPO = process.env.GH_REPO || 'sbblhqapp/sbblhq';
const FILE_PATH = 'src/pages/Ops.tsx';
const BRANCH_NAME = 'codex/ops-console-cad-localization-v2';

async function fetchGitHub(endpoint, method = 'GET', body = null) {
  const url = `https://api.github.com/repos/${REPO}/${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'NodeJS/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = require('https').request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Fetching main branch reference...');
    const ref = await fetchGitHub('git/ref/heads/main');
    const mainSha = ref.object.sha;

    console.log('2. Creating new branch:', BRANCH_NAME);
    try {
      await fetchGitHub('git/refs', 'POST', {
        ref: `refs/heads/${BRANCH_NAME}`,
        sha: mainSha
      });
    } catch (e) {
      if (!e.message.includes('Reference already exists')) throw e;
      console.log('   Branch already exists, updating...');
    }

    console.log('3. Reading local file modifications...');
    const localContent = fs.readFileSync(FILE_PATH, 'utf8');

    console.log('4. Creating Blob with updated content...');
    const blob = await fetchGitHub('git/blobs', 'POST', {
      content: localContent,
      encoding: 'utf-8'
    });

    console.log('5. Creating Tree...');
    const baseCommit = await fetchGitHub(`git/commits/${mainSha}`);
    const baseTreeSha = baseCommit.tree.sha;
    
    const tree = await fetchGitHub('git/trees', 'POST', {
      base_tree: baseTreeSha,
      tree: [{
        path: FILE_PATH,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      }]
    });

    console.log('6. Creating Commit...');
    const newCommit = await fetchGitHub('git/commits', 'POST', {
      message: 'feat: standardize Ops Console store pricing to CAD',
      tree: tree.sha,
      parents: [mainSha]
    });

    console.log('7. Updating Branch Reference...');
    await fetchGitHub(`git/refs/heads/${BRANCH_NAME}`, 'PATCH', {
      sha: newCommit.sha,
      force: true
    });

    console.log('8. Creating Pull Request...');
    const pr = await fetchGitHub('pulls', 'POST', {
      title: 'feat: Ops Console CAD Localization',
      head: BRANCH_NAME,
      base: 'main',
      body: 'Standardizes the Ops Console store pricing tool to exclusively support Canadian Dollars (CAD) as requested.'
    });

    console.log('\n✅ SUCCESS!');
    console.log(`PR Link: ${pr.html_url}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

run();
