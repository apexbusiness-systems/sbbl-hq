const fs = require('fs');

const file = 'src/pages/Home.tsx';
let code = fs.readFileSync(file, 'utf8');

// Remove mock import
code = code.replace(`import { playersOfTheGame } from '@/data/mock';`, '');

// Add imports
code = code.replace(
  `import { useEffect, useState } from 'react';`,
  `import { useEffect, useState } from 'react';\nimport { useQuery } from '@tanstack/react-query';\nimport { apiFetch } from '@/lib/api/client';\nimport type { PlayerOfTheGame } from '@/types';`
);

// Add POTG query inside the component
code = code.replace(
  `const [errorMsg, setErrorMsg] = useState<string | null>(null);`,
  `const [errorMsg, setErrorMsg] = useState<string | null>(null);\n\n  const potgQuery = useQuery({\n    queryKey: ['public-potg', resolvedLeague],\n    queryFn: () => apiFetch<{ ok: boolean; data: PlayerOfTheGame[] }>(\`/api/public/potg?league=\${resolvedLeague}&limit=6\`),\n    staleTime: 60_000,\n    retry: 1,\n  });\n  const livePotgList = potgQuery.data?.data ?? [];`
);

// Replace POTG section render
const oldPotgBlock = `        {/* Players of the Game */}\n        {(() => {\n          const potgList = playersOfTheGame.filter(p => p.leagueId === resolvedLeague);\n          if (potgList.length === 0) return null;\n          const leagueInfo = getLeagueConfig(resolvedLeague);\n\n          return (\n            <section>\n              <div className="flex items-center justify-between mb-6\">\n                <div>\n                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-1\">Game Night Recap</p>\n                  <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight flex items-center gap-2\">\n                    <Trophy className="w-5 h-5 text-primary" />\n                    {leagueInfo.shortName} · Players of the Game\n                  </h2>\n                </div>\n                <Link to={\`/leaderboards?league=\${resolvedLeague}\`} className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1\">\n                  Leaderboards <ChevronRight className="w-3.5 h-3.5" />\n                </Link>\n              </div>\n              <div className="flex gap-4 overflow-x-auto scrollbar-hidden pb-2\">\n                {potgList.map((potg, i) => (\n                  <PotgCard key={potg.id} potg={potg} featured={i === 0} />\n                ))}\n              </div>\n            </section>\n          );\n        })()}`;

const newPotgBlock = `        {/* Players of the Game — sourced from real POTG pipeline */}\n        {(() => {\n          const potgList = livePotgList.length > 0\n            ? livePotgList\n            : []; // zero mock fallback — empty list shows the prompt state below\n          const leagueInfo = getLeagueConfig(resolvedLeague);\n          return (\n            <section>\n              <div className="flex items-center justify-between mb-6\">\n                <div>\n                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-1\">Game Night Recap</p>\n                  <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight flex items-center gap-2\">\n                    <Trophy className="w-5 h-5 text-primary" />\n                    {leagueInfo.shortName} · Players of the Game\n                  </h2>\n                </div>\n                <Link to={\`/leaderboards?league=\${resolvedLeague}\`} className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1\">\n                  Leaderboards <ChevronRight className="w-3.5 h-3.5" />\n                </Link>\n              </div>\n              {potgList.length > 0 ? (\n                <div className="flex gap-4 overflow-x-auto scrollbar-hidden pb-2\">\n                  {potgList.map((potg, i) => (\n                    <PotgCard key={potg.id} potg={potg} featured={i === 0} />\n                  ))}\n                </div>\n              ) : (\n                <div className="panel p-8 text-center border-dashed\">\n                  <Trophy className="w-8 h-8 text-primary/30 mx-auto mb-3" />\n                  <p className="text-sm font-medium text-muted-foreground\">No POTG results yet for {leagueInfo.shortName}</p>\n                  <p className="text-xs text-muted-foreground/60 mt-1\">Upload game graphics via Ops → POTG Parser to populate this section.</p>\n                </div>\n              )}\n            </section>\n          );\n        })()}`;

code = code.replace(oldPotgBlock, newPotgBlock);

fs.writeFileSync(file, code);
