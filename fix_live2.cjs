const fs = require('fs');
const path = require('path');

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

liveCode = liveCode.replace(
  /const carouselProduct = featuredProducts\[carouselIdx\] \?\? products\[0\];/s,
  `const carouselProduct = featuredProducts[carouselIdx];`
);

liveCode = liveCode.replace(
  /<LiveStreamPlayer\s+game=\{liveGame\}\s+userId=\{user\?\.id \?\? null\}\s+roles=\{roles\}\s+token=\{token\}\s+hasPremiumPlayerAccess=\{hasPremiumPlayerAccess\}\s+\/>/s,
  `{liveGame ? (
              <LiveStreamPlayer
                game={liveGame}
                userId={user?.id ?? null}
                roles={roles}
                token={token}
                hasPremiumPlayerAccess={hasPremiumPlayerAccess}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-card">
                <p className="font-display font-bold text-xl mb-2">No Live Games</p>
                <p className="text-sm text-muted-foreground">Check the schedule for upcoming broadcasts.</p>
              </div>
            )}`
);

// Disable the share button context if no live game
liveCode = liveCode.replace(
  /const shareData = \{\n\s+title: `\$\{liveGame\.homeTeam\.name\} vs \$\{liveGame\.awayTeam\.name\} — Live on SBBL HQ`,\n\s+text: `Watch the game live: \$\{liveGame\.score\?\.home\}–\$\{liveGame\.score\?\.away\} in Q4`,\n\s+url: window\.location\.href,\n\s+\};/s,
  `if (!liveGame) return;
    const shareData = {
      title: \`\${liveGame.homeTeam.name} vs \${liveGame.awayTeam.name} — Live on SBBL HQ\`,
      text: \`Watch the game live: \${liveGame.score?.home}–\${liveGame.score?.away} in Q4\`,
      url: window.location.href,
    };`
);

fs.writeFileSync(livePath, liveCode);
