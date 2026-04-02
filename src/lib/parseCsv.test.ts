import { describe, it, expect } from 'vitest';
import { parseCsv } from './parseCsv';

describe('parseCsv', () => {
  it('returns empty for empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns empty for header-only CSV', () => {
    expect(parseCsv('name,id')).toEqual([]);
  });

  it('parses basic CSV correctly', () => {
    const result = parseCsv('name,score\nAlice,10\nBob,20');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', score: '10' });
    expect(result[1]).toEqual({ name: 'Bob', score: '20' });
  });

  it('handles Windows line endings', () => {
    const result = parseCsv('name,val\r\nFoo,1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Foo', val: '1' });
  });

  it('trims whitespace from headers and values', () => {
    const result = parseCsv(' name , score \n Alice , 10 ');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Alice', score: '10' });
  });

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

  it('skips empty lines and whitespace-only lines', () => {
    const csvData = 'name,id\n\nAlice,1\n   \nBob,2\n\n';
    const result = parseCsv(csvData);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Alice', id: '1' });
    expect(result[1]).toEqual({ name: 'Bob', id: '2' });
  });
});
