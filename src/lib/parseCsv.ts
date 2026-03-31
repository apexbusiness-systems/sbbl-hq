export function parseCsv(raw: string) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return headers.reduce<Record<string, string>>((acc, key, idx) => {
      acc[key] = values[idx] ?? '';
      return acc;
    }, {});
  });
}
