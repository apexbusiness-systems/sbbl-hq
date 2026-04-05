const fs = require('fs');
const content = fs.readFileSync('src/worker/index.ts', 'utf-8');
const match = content.match(/async function handleScoresList[\s\S]*?\n\}/);
if (match) {
  console.log(match[0].substring(match[0].length - 200));
} else {
  console.log("no match");
}
