import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workerSrc = readFileSync(resolve(__dirname, '../worker/index.ts'), 'utf-8');
const opsPageSrc = readFileSync(resolve(__dirname, '../pages/Ops.tsx'), 'utf-8');
const opsApiSrc = readFileSync(resolve(__dirname, '../lib/api/ops.ts'), 'utf-8');
const mediaPageSrc = readFileSync(resolve(__dirname, '../pages/Media.tsx'), 'utf-8');
const imageResizeSrc = readFileSync(resolve(__dirname, '../lib/imageResize.ts'), 'utf-8');

function routeRegistered(route: string): boolean {
  return workerSrc.includes(route) || opsApiSrc.includes(route);
}

describe('explicit ingress endpoint checklist', () => {
  const ingressRoutes = [
    '/ops/imports/teams',
    '/ops/imports/players',
    '/ops/imports/schedules',
    '/ops/imports/events',
    '/ops/potg/parse',
    '/ops/potg/submit',
    '/ops/store/media',
    '/ops/scores/import',
    '/ops/scores/parse-image',
    '/ops/ingest/presign',
    '/ops/ingest/submit',
    '/ops/products/batch',
  ];

  ingressRoutes.forEach((route) => {
    it(`wires ingress route: ${route}`, () => {
      expect(routeRegistered(route)).toBe(true);
    });
  });
});

describe('explicit parser checklist', () => {
  it('ops page uses POTG parser client call', () => {
    expect(opsPageSrc).toContain('parsePotgImage(imageBase64');
  });

  it('ops page uses scoreboard parser client call', () => {
    expect(opsPageSrc).toContain('parseScoreboardImage(imageBase64');
  });

  it('worker exposes POTG parse handler', () => {
    expect(workerSrc).toContain('async function handleParsePotgImage');
  });

  it('worker exposes scoreboard parse handler', () => {
    expect(workerSrc).toContain('async function handleScoreboardImageParse');
  });
});

describe('explicit render endpoint checklist', () => {
  const renderRoutes = [
    '/api/public/media',
    '/api/public/potg',
    '/api/public/schedule',
    '/api/scores',
  ];

  renderRoutes.forEach((route) => {
    it(`wires render route: ${route}`, () => {
      expect(workerSrc).toContain(route);
    });
  });

  it('media page renders real API data path (no mock fallback)', () => {
    expect(mediaPageSrc).toContain("queryFn: () => apiFetch<{ ok: boolean; data: MediaAsset[] }>('/api/public/media')");
    expect(mediaPageSrc).not.toContain('mockMedia');
  });
});

describe('automatic resize checklist', () => {
  it('store upload path resizes image to 800x800', () => {
    expect(opsPageSrc).toContain('resizeImageToFit(storeForm.imageFile, 800, 800)');
  });

  it('POTG upload path infers target dimensions before upload', () => {
    expect(opsPageSrc).toContain('inferTargetDimensions(potgImageFile)');
  });

  it('resize utility enforces portrait and landscape cover dimensions', () => {
    expect(imageResizeSrc).toContain("? { width: 747, height: 560, mode: 'cover' }");
    expect(imageResizeSrc).toContain(": { width: 560, height: 747, mode: 'cover' }");
  });

  it('media render containers are constrained to 3:4 card ratio', () => {
    expect(mediaPageSrc).toContain("style={{ aspectRatio: '3/4' }}");
  });

  it('event upload continuation stores ingest job after submit succeeds', () => {
    expect(opsPageSrc).toContain('onSuccess: async (data) => {');
    expect(opsPageSrc).toContain('setIngestJob(data);');
    expect(opsPageSrc).toContain("queryKey: ['ops-import-history']");
  });
});
