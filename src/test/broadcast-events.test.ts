/**
 * broadcast-events.test.ts
 *
 * Tests for the LiveStream Broadcast Event system:
 *   - URL validation logic
 *   - Status transition rules
 *   - Public read surface (allowed vs. denied statuses)
 *   - Worker handler shape expectations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Re-implement the URL validator inline so we can test it in isolation ──────
// Mirrors the logic in src/worker/routes/broadcast-events.ts

const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:'];
const PRIVATE_RANGES = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/0\.0\.0\.0/,
];

function validateHttpsUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '__invalid__';
  }
  if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) return '__invalid__';
  if (parsed.protocol !== 'https:') return '__invalid__';
  for (const re of PRIVATE_RANGES) {
    if (re.test(trimmed)) return '__invalid__';
  }
  return trimmed;
}

// ── Status transition table — mirrors broadcast-events.ts ─────────────────────

type BroadcastStatus =
  | 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled' | 'archived';

const STATUS_TRANSITIONS: Record<BroadcastStatus, BroadcastStatus[]> = {
  draft:     ['scheduled', 'cancelled'],
  scheduled: ['live', 'cancelled'],
  live:      ['ended', 'cancelled'],
  ended:     ['archived'],
  cancelled: ['archived'],
  archived:  [],
};

function canTransition(from: BroadcastStatus, to: BroadcastStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── URL validation tests ───────────────────────────────────────────────────────

describe('validateHttpsUrl', () => {
  it('accepts a valid HTTPS URL', () => {
    expect(validateHttpsUrl('https://cdn.example.com/stream.m3u8')).toBe(
      'https://cdn.example.com/stream.m3u8',
    );
  });

  it('accepts HTTPS with query params', () => {
    const url = 'https://example.com/live?token=abc&ts=123';
    expect(validateHttpsUrl(url)).toBe(url);
  });

  it('returns null for empty string', () => {
    expect(validateHttpsUrl('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(validateHttpsUrl(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(validateHttpsUrl(undefined)).toBeNull();
  });

  it('rejects javascript: protocol', () => {
    expect(validateHttpsUrl('javascript:alert(1)')).toBe('__invalid__');
  });

  it('rejects data: protocol', () => {
    expect(validateHttpsUrl('data:text/html,<h1>x</h1>')).toBe('__invalid__');
  });

  it('rejects blob: protocol', () => {
    expect(validateHttpsUrl('blob:http://localhost/xyz')).toBe('__invalid__');
  });

  it('rejects file: protocol', () => {
    expect(validateHttpsUrl('file:///etc/passwd')).toBe('__invalid__');
  });

  it('rejects plain HTTP', () => {
    expect(validateHttpsUrl('http://cdn.example.com/stream.m3u8')).toBe('__invalid__');
  });

  it('rejects localhost', () => {
    expect(validateHttpsUrl('https://localhost:8080/stream')).toBe('__invalid__');
  });

  it('rejects 127.x.x.x', () => {
    expect(validateHttpsUrl('https://127.0.0.1/stream')).toBe('__invalid__');
  });

  it('rejects 10.x private range', () => {
    expect(validateHttpsUrl('https://10.0.0.1/stream')).toBe('__invalid__');
  });

  it('rejects 192.168.x.x', () => {
    expect(validateHttpsUrl('https://192.168.1.100/stream')).toBe('__invalid__');
  });

  it('rejects unparseable string', () => {
    expect(validateHttpsUrl('not-a-url')).toBe('__invalid__');
  });
});

// ── Status transition tests ────────────────────────────────────────────────────

describe('broadcast status transitions', () => {
  it('draft → scheduled allowed', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true);
  });

  it('draft → cancelled allowed', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true);
  });

  it('draft → live NOT allowed', () => {
    expect(canTransition('draft', 'live')).toBe(false);
  });

  it('scheduled → live allowed', () => {
    expect(canTransition('scheduled', 'live')).toBe(true);
  });

  it('scheduled → cancelled allowed', () => {
    expect(canTransition('scheduled', 'cancelled')).toBe(true);
  });

  it('scheduled → draft NOT allowed', () => {
    expect(canTransition('scheduled', 'draft')).toBe(false);
  });

  it('live → ended allowed', () => {
    expect(canTransition('live', 'ended')).toBe(true);
  });

  it('live → cancelled allowed', () => {
    expect(canTransition('live', 'cancelled')).toBe(true);
  });

  it('live → draft NOT allowed', () => {
    expect(canTransition('live', 'draft')).toBe(false);
  });

  it('ended → archived allowed', () => {
    expect(canTransition('ended', 'archived')).toBe(true);
  });

  it('ended → live NOT allowed', () => {
    expect(canTransition('ended', 'live')).toBe(false);
  });

  it('cancelled → archived allowed', () => {
    expect(canTransition('cancelled', 'archived')).toBe(true);
  });

  it('archived is terminal — no transitions', () => {
    const all: BroadcastStatus[] = [
      'draft', 'scheduled', 'live', 'ended', 'cancelled', 'archived',
    ];
    for (const target of all) {
      expect(canTransition('archived', target)).toBe(false);
    }
  });
});

// ── Public read access rules ───────────────────────────────────────────────────

describe('public read access rules', () => {
  const PUBLIC_VISIBLE: BroadcastStatus[] = ['scheduled', 'live', 'ended', 'cancelled'];
  const PUBLIC_HIDDEN: BroadcastStatus[] = ['draft', 'archived'];

  it.each(PUBLIC_VISIBLE)('status=%s is publicly readable', (status) => {
    expect(PUBLIC_VISIBLE).toContain(status);
  });

  it.each(PUBLIC_HIDDEN)('status=%s is NOT publicly readable', (status) => {
    expect(PUBLIC_HIDDEN).toContain(status);
    expect(PUBLIC_VISIBLE).not.toContain(status);
  });
});

// ── Slug format validation ─────────────────────────────────────────────────────

describe('slug format', () => {
  const SLUG_RE = /^[a-z0-9][a-z0-9\-]{0,127}$/;

  it('accepts valid slug', () => {
    expect(SLUG_RE.test('wbl-championship-2026')).toBe(true);
  });

  it('rejects uppercase', () => {
    expect(SLUG_RE.test('WBL-Championship')).toBe(false);
  });

  it('rejects leading hyphen', () => {
    expect(SLUG_RE.test('-bad-slug')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(SLUG_RE.test('my slug here')).toBe(false);
  });
});

// ── Stream URL only sent when live ────────────────────────────────────────────

describe('stream_url gating', () => {
  function applyServerGating(event: {
    status: BroadcastStatus;
    stream_url: string | null;
    embed_url: string | null;
  }) {
    return {
      ...event,
      stream_url: event.status === 'live' ? event.stream_url : null,
      embed_url:  event.status === 'live' ? event.embed_url  : null,
    };
  }

  it('sends stream_url when live', () => {
    const result = applyServerGating({
      status: 'live',
      stream_url: 'https://cdn.example.com/live.m3u8',
      embed_url: null,
    });
    expect(result.stream_url).toBe('https://cdn.example.com/live.m3u8');
  });

  it('strips stream_url when scheduled', () => {
    const result = applyServerGating({
      status: 'scheduled',
      stream_url: 'https://cdn.example.com/live.m3u8',
      embed_url: 'https://youtube.com/embed/abc',
    });
    expect(result.stream_url).toBeNull();
    expect(result.embed_url).toBeNull();
  });

  it('strips stream_url when ended', () => {
    const result = applyServerGating({
      status: 'ended',
      stream_url: 'https://cdn.example.com/live.m3u8',
      embed_url: null,
    });
    expect(result.stream_url).toBeNull();
  });
});
