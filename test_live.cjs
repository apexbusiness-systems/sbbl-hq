const fs = require('fs');

const code = fs.readFileSync('src/pages/Live.tsx', 'utf-8');

// modify AdminStreamControls interface
const isLiveRegex = /isLive: boolean;\n\s*setIsLive: \(v: boolean\) => void;\n\s*streamTitle: string;\n\s*setStreamTitle: \(v: string\) => void;\n\s*viewerCount: number;\n\s*streamSource: 'custom';\n\s*setStreamSource: \(v: 'custom'\) => void;\n\s*customStreamUrl: string;\n\s*setCustomStreamUrl: \(v: string\) => void;/;

const newInterface = `isLive: boolean;
  setIsLive: (v: boolean) => void;
  streamTitle: string;
  setStreamTitle: (v: string) => void;
  viewerCount: number;
  streamSource: 'custom' | 'cloudflare';
  setStreamSource: (v: 'custom' | 'cloudflare') => void;
  customStreamUrl: string;
  setCustomStreamUrl: (v: string) => void;`;

let newCode = code.replace(isLiveRegex, newInterface);

const componentRegex = /streamSource: 'custom',\n  setStreamSource,\n  customStreamUrl,/;
newCode = newCode.replace(componentRegex, `streamSource,\n  setStreamSource,\n  customStreamUrl,`);

const dropdownRegex = /<select\s*value=\{streamSource\}\s*onChange=\{e => setStreamSource\(e\.target\.value as 'custom'\)\}\s*className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary\/50"\s*>\s*<option value="custom">Custom URL \(ReactPlayer\)<\/option>\s*<\/select>/;

const newDropdown = `<select
                value={streamSource}
                onChange={e => setStreamSource(e.target.value as 'custom' | 'cloudflare')}
                className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="custom">Custom URL (ReactPlayer)</option>
                <option value="cloudflare">Cloudflare Stream (WebRTC)</option>
              </select>`;

newCode = newCode.replace(dropdownRegex, newDropdown);

const stateRegex = /const \[streamSource, setStreamSource\] = useState<'custom'>\('custom'\);/;
newCode = newCode.replace(stateRegex, `const [streamSource, setStreamSource] = useState<'custom' | 'cloudflare'>('custom');`);

const renderRegex = /customStreamUrl=\{customStreamUrl\}/;
newCode = newCode.replace(renderRegex, `customStreamUrl={customStreamUrl}\n                isCloudflareStream={streamSource === 'cloudflare'}`);

fs.writeFileSync('src/pages/Live.tsx', newCode);
console.log('Updated src/pages/Live.tsx');
