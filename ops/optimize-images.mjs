import sharp from 'sharp';
import { readFile, writeFile, stat } from 'fs/promises';

const ROOT = '/home/user/sbbl-hq/public';

// Hero images are heavily overlaid (black/45 + linear + radial gradients) so
// quality can be dropped aggressively without visible artefacts. They are the
// LCP element — aim for the smallest possible payload.
const heroJobs = [
  {
    src: `${ROOT}/assets/hero-desktop.png`,
    base: `${ROOT}/assets/hero-desktop`,
    width: 1536,
    avifQuality: 40,
    webpQuality: 62,
  },
  {
    src: `${ROOT}/assets/hero-mobile.png`,
    base: `${ROOT}/assets/hero-mobile`,
    width: 768,
    avifQuality: 42,
    webpQuality: 65,
  },
];

async function optimiseHero(job) {
  const input = await readFile(job.src);
  const origSize = (await stat(job.src)).size;
  const base = sharp(input).resize({ width: job.width, withoutEnlargement: true });

  const avif = await base.clone().avif({ quality: job.avifQuality, effort: 9 }).toBuffer();
  const webp = await base.clone().webp({ quality: job.webpQuality, effort: 6, smartSubsample: true }).toBuffer();
  const png = await base.clone().png({ compressionLevel: 9, palette: true, colors: 128 }).toBuffer();

  await writeFile(`${job.base}.avif`, avif);
  await writeFile(`${job.base}.webp`, webp);
  await writeFile(`${job.base}.png`, png);

  console.log(
    `${job.src.replace(ROOT, '')}: orig ${origSize} → png ${png.length}, webp ${webp.length}, avif ${avif.length}`,
  );
}

async function run() {
  for (const job of heroJobs) {
    await optimiseHero(job);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
