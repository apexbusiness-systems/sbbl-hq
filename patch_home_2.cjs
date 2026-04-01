const fs = require('fs');
const file = 'src/pages/Home.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\{\/\* Players of the Game \*\/\}\s*\{\(\(\) => \{\s*const potgList = playersOfTheGame\.filter\(p => p\.leagueId === resolvedLeague\);\s*if \(potgList\.length === 0\) return null;\s*const leagueInfo = getLeagueConfig\(resolvedLeague\);\s*return \(\s*<section>[\s\S]*?<\/section>\s*\);\s*\}\)\(\)\}/g;

const newPotgBlock = `{/* Players of the Game — sourced from real POTG pipeline */}
        {(() => {
          const potgList = livePotgList.length > 0
            ? livePotgList
            : []; // zero mock fallback — empty list shows the prompt state below
          const leagueInfo = getLeagueConfig(resolvedLeague);
          return (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-1">Game Night Recap</p>
                  <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    {leagueInfo.shortName} · Players of the Game
                  </h2>
                </div>
                <Link to={\`/leaderboards?league=\${resolvedLeague}\`} className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                  Leaderboards <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {potgList.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto scrollbar-hidden pb-2">
                  {potgList.map((potg, i) => (
                    <PotgCard key={potg.id} potg={potg} featured={i === 0} />
                  ))}
                </div>
              ) : (
                <div className="panel p-8 text-center border-dashed">
                  <Trophy className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No POTG results yet for {leagueInfo.shortName}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Upload game graphics via Ops → POTG Parser to populate this section.</p>
                </div>
              )}
            </section>
          );
        })()}`;

code = code.replace(regex, newPotgBlock);
fs.writeFileSync(file, code);
