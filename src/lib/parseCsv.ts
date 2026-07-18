/**
 * RFC 4180-compliant CSV parser.
 * Handles: quoted fields, escaped quotes (""), CRLF/LF line endings, UTF-8 BOM.
 */

export type ParseResult<T> =
  | { ok: true; data: T[]; warnings: string[] }
  | { ok: false; errors: { row?: number; field?: string; code: string; message: string }[] };

type ParseState = {
  rows: string[][];
  currentRow: string[];
  currentField: string;
  inQuotes: boolean;
};

function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
}

function commitRow(state: ParseState): void {
  state.currentRow.push(state.currentField);
  state.rows.push(state.currentRow);
  state.currentRow = [];
  state.currentField = '';
}

function processQuotedChar(state: ParseState, content: string, i: number): number {
  const next = content[i + 1];
  if (next === '"') {
    state.currentField += '"';
    return i + 1; // advance past escaped quote
  }
  state.inQuotes = false;
  return i;
}

function processUnquotedChar(state: ParseState, content: string, i: number): number {
  const char = content[i];
  if (char === '"') {
    state.inQuotes = true;
  } else if (char === ',') {
    state.currentRow.push(state.currentField);
    state.currentField = '';
  } else if (char === '\n' || char === '\r') {
    commitRow(state);
    if (char === '\r' && content[i + 1] === '\n') {
      return i + 1; // skip \n of CRLF
    }
  } else {
    state.currentField += char;
  }
  return i;
}

function tokenize(content: string): string[][] {
  const state: ParseState = { rows: [], currentRow: [], currentField: '', inQuotes: false };

  for (let i = 0; i < content.length; i++) {
    if (state.inQuotes) {
      if (content[i] === '"') {
        i = processQuotedChar(state, content, i);
      } else {
        state.currentField += content[i];
      }
    } else {
      i = processUnquotedChar(state, content, i);
    }
  }

  // Flush trailing field/row
  if (state.currentField !== '' || state.currentRow.length > 0) {
    state.currentRow.push(state.currentField);
    state.rows.push(state.currentRow);
  }

  return state.rows;
}

function cleanRows(rows: string[][]): string[][] {
  return rows
    .map(row => row.map(cell => cell.trim()))
    .filter(row => row.some(cell => cell !== ''));
}

function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  return headers.reduce<Record<string, string>>((acc, key, idx) => {
    if (!BLOCKED_KEYS.has(key)) {
      acc[key] = row[idx] ?? '';
    }
    return acc;
  }, Object.create(null));
}

export function parseCsv(raw: string): Record<string, string>[] {
  if (!raw?.trim()) return [];

  const content = stripBom(raw);
  const rows = cleanRows(tokenize(content));

  if (rows.length < 2) return [];

  const [headers, ...dataRows] = rows;
  return dataRows.map(row => rowToRecord(headers, row));
}
