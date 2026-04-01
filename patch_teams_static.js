import fs from 'fs';

let content = fs.readFileSync('src/pages/Teams.tsx', 'utf-8');

const staticImport = `import { STATIC_TEAMS } from '@/data/teams';\n`;
if (!content.includes('import { STATIC_TEAMS')) {
  content = content.replace("import { Link, useSearchParams } from 'react-router-dom';", "import { Link, useSearchParams } from 'react-router-dom';\n" + staticImport);
}

const mockMapping = `
    const mappedStatic = STATIC_TEAMS.map((st, index) => ({
      id: \`static-\${index}\`,
      name: st.name,
      league_code: st.leagueCode,
      league_name: st.leagueCode,
      season_name: st.season,
      division_name: null,
      roster_count: 0,
      players: [],
      coaches: [],
      stats: {
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        ptsFor: 0,
        ptsAgainst: 0,
        winPct: '.000',
        diff: 0
      }
    }));
    const apiTeams = (teamsQuery.data?.teams && teamsQuery.data.teams.length > 0) ? teamsQuery.data.teams : mappedStatic;
`;

content = content.replace(
  "const apiTeams = teamsQuery.data?.teams ?? [];",
  mockMapping.trim()
);

content = content.replace(/teamsQuery\.isLoading/g, "(teamsQuery.isLoading && !teamsQuery.data?.teams && filteredTeams.length === 0)");

fs.writeFileSync('src/pages/Teams.tsx', content);
