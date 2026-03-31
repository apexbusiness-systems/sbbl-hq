const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

// Instead of any, define a type or use Record<string, unknown> safely.
const interfaceStr = `
interface PotgJob {
  id: string;
  created_at: string;
  payload_summary: {
    playerId?: string;
    playerName?: string;
    team?: string;
    leagueId?: string;
    pts?: string | number;
    rebs?: string | number;
    assts?: string | number;
    gameResult?: string;
  };
}`;

if (!homeCode.includes('interface PotgJob')) {
  homeCode = homeCode.replace(
    /const HomePage = \(\) => \{/,
    `${interfaceStr}\n\nconst HomePage = () => {`
  );
}

homeCode = homeCode.replace(
  /apiFetch<\{ ok: boolean; data: any\[\] \}>\(/,
  `apiFetch<{ ok: boolean; data: PotgJob[] }>(`
);

homeCode = homeCode.replace(
  /const playersOfTheGame: any\[\] = potgQuery\.data\?\.data \|\| \[\];/,
  `const playersOfTheGame: PotgJob[] = potgQuery.data?.data || [];`
);

homeCode = homeCode.replace(
  /\/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\n  const potgList = \(playersOfTheGame \|\| \[\]\)\.map\(\(job: any\) => \(\{/,
  `const potgList = (playersOfTheGame || []).map((job: PotgJob) => ({`
);

fs.writeFileSync(homePath, homeCode);

const livePath = path.join(__dirname, 'src', 'pages', 'Live.tsx');
let liveCode = fs.readFileSync(livePath, 'utf8');

liveCode = liveCode.replace(
  /\/\/ eslint-disable-next-line @typescript-eslint\/no-explicit-any\n  const carouselProduct: any = featuredProducts\[carouselIdx\];/,
  `const carouselProduct: Record<string, unknown> = featuredProducts[carouselIdx] as Record<string, unknown>;`
);

fs.writeFileSync(livePath, liveCode);
