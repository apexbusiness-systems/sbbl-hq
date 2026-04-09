sed -i 's/{team\.stats\.wins}/{team.stats?.wins ?? 0}/g' src/pages/Teams.tsx
sed -i 's/{team\.stats\.losses}/{team.stats?.losses ?? 0}/g' src/pages/Teams.tsx
sed -i 's/{team\.stats\.winPct}/{team.stats?.winPct ?? ".000"}/g' src/pages/Teams.tsx
sed -i 's/{team\.stats\.ptsFor}/{team.stats?.ptsFor ?? 0}/g' src/pages/Teams.tsx
sed -i 's/{team\.stats\.ptsAgainst}/{team.stats?.ptsAgainst ?? 0}/g' src/pages/Teams.tsx
sed -i 's/{team\.stats\.diff}/{team.stats?.diff ?? 0}/g' src/pages/Teams.tsx
sed -i 's/team\.stats\.diff > 0/(team.stats?.diff ?? 0) > 0/g' src/pages/Teams.tsx
sed -i 's/team\.stats\.diff < 0/(team.stats?.diff ?? 0) < 0/g' src/pages/Teams.tsx
