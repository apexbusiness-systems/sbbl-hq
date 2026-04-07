import { describe, it, expect } from 'vitest';
import { parseCsv } from './parseCsv';

describe('parseCsv', () => {
  // ── Edge / empty inputs ──────────────────────────────────────────────────
  it('returns empty for empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns empty for whitespace-only string', () => {
    expect(parseCsv('   \n  ')).toEqual([]);
  });

  it('returns empty for header-only CSV', () => {
    expect(parseCsv('name,id')).toEqual([]);
  });

  // ── Basic correctness ────────────────────────────────────────────────────
  it('parses basic CSV correctly', () => {
    const result = parseCsv('name,score\nAlice,10\nBob,20');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', score: '10' });
    expect(result[1]).toEqual({ name: 'Bob', score: '20' });
  });

  // ── Line endings ─────────────────────────────────────────────────────────
  it('handles Windows CRLF line endings', () => {
    const result = parseCsv('name,val\r\nFoo,1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Foo', val: '1' });
  });

  it('handles single CR line endings', () => {
    const result = parseCsv('name,val\rFoo,1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Foo', val: '1' });
  });

  // ── Whitespace handling ──────────────────────────────────────────────────
  it('trims whitespace from headers and values', () => {
    const result = parseCsv(' name , score \n Alice , 10 ');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', score: '10' });
  });

  // ── Column count mismatches ──────────────────────────────────────────────
  it('handles rows with missing columns by filling with empty strings', () => {
    const result = parseCsv('name,age,city\nAlice,30');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', age: '30', city: '' });
  });

  it('handles rows with extra columns by ignoring them', () => {
    const result = parseCsv('name,age\nAlice,30,extra');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', age: '30' });
  });

  // ── Empty rows ───────────────────────────────────────────────────────────
  it('skips empty lines and whitespace-only lines', () => {
    const csvData = 'name,id\n\nAlice,1\n   \nBob,2\n\n';
    const result = parseCsv(csvData);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', id: '1' });
    expect(result[1]).toEqual({ name: 'Bob', id: '2' });
  });

  // ── RFC 4180: Quoted field handling ──────────────────────────────────────
  it('parses quoted fields with embedded commas', () => {
    const result = parseCsv('name,address\nAlice,"123 Main St, Suite 5"');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', address: '123 Main St, Suite 5' });
  });

  it('parses quoted fields with embedded newlines', () => {
    const result = parseCsv('name,note\nAlice,"line1\nline2"');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Alice');
    expect(result[0]?.note).toBe('line1\nline2');
  });

  it('handles RFC 4180 escaped double-quotes ("")', () => {
    const result = parseCsv('name,quote\nAlice,"She said ""hello"""');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', quote: 'She said "hello"' });
  });

  it('parses empty quoted fields', () => {
    const result = parseCsv('name,city\nAlice,""');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', city: '' });
  });

  it('parses multiple quoted fields in same row', () => {
    const result = parseCsv('a,b,c\n"x,1","y,2","z,3"');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ a: 'x,1', b: 'y,2', c: 'z,3' });
  });

  // ── UTF-8 BOM ─────────────────────────────────────────────────────────────
  it('strips UTF-8 BOM from the beginning of the file', () => {
    const bom = '\uFEFF';
    const result = parseCsv(`${bom}league_id,name\nL1,Thunderbolts`);
    expect(result).toHaveLength(1);
    // BOM must NOT appear in the first header key
    expect(result[0]).toEqual({ league_id: 'L1', name: 'Thunderbolts' });
    expect(Object.keys(result[0])[0]).toBe('league_id');
  });

  // ── Security: prototype pollution ─────────────────────────────────────────
  it('ignores __proto__ header keys to prevent prototype pollution', () => {
    const csv = '__proto__,name\nmalicious,Alice';
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('__proto__');
    expect(result[0]).toEqual({ name: 'Alice' });
  });

  it('ignores constructor and prototype header keys', () => {
    const csv = 'constructor,prototype,name\nx,y,Alice';
    const result = parseCsv(csv);
    expect(result[0]).not.toHaveProperty('constructor');
    expect(result[0]).not.toHaveProperty('prototype');
    expect(result[0]).toEqual({ name: 'Alice' });
  });

  // ── Real-world SBBL upload shapes ─────────────────────────────────────────
  it('parses a teams import shape correctly', () => {
    const csv = 'league_id,season_id,name,wins,losses\nL1,S1,Thunderbolts,5,2\nL1,S1,Vipers,3,4';
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ league_id: 'L1', season_id: 'S1', name: 'Thunderbolts', wins: '5', losses: '2' });
  });

  it('parses a schedules import shape with quoted venue names', () => {
    const csv = 'league_id,season_id,venue_id,starts_at\nL1,S1,"Main Court, East",2025-01-10T14:00:00Z';
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ league_id: 'L1', season_id: 'S1', venue_id: 'Main Court, East', starts_at: '2025-01-10T14:00:00Z' });
  });
});
