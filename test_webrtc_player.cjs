const fs = require('fs');

const code = fs.readFileSync('src/components/LiveStreamPlayer.tsx', 'utf-8');

const webrtcImport = `import { WhepPlayer } from '@/components/WhepPlayer';\n`;
let newCode = webrtcImport + code;

// find customStreamUrl in interface
const featureFlagRegex = /customStreamUrl\?: string;/;
newCode = newCode.replace(featureFlagRegex, `customStreamUrl?: string;\n  isCloudflareStream?: boolean;`);

const playerRegex = /<ReactPlayer[\s\S]*?parent: \['sbbl-hq\.icu', 'www\.sbbl-hq\.icu', 'localhost'\]\n\s*\}\n\s*\}\n\s*\}\n\s*\}\n\s*style=\{\{ position: 'absolute', top: 0, left: 0 \}\}\n\s*\/>/;

const replacement = `{isCloudflareStream && customStreamUrl ? (
              <WhepPlayer url={customStreamUrl} />
            ) : (
              <ReactPlayer
                url={customStreamUrl}
                playing={true}
                controls={true}
                width="100%"
                height="100%"
                config={{
                  twitch: {
                    options: {
                      parent: ['sbbl-hq.icu', 'www.sbbl-hq.icu', 'localhost']
                    }
                  }
                }}
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
            )}`;

newCode = newCode.replace(playerRegex, replacement);

fs.writeFileSync('src/components/LiveStreamPlayer.tsx', newCode);
console.log('Updated src/components/LiveStreamPlayer.tsx');
