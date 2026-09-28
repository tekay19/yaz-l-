const MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function normalizeName(s: string): string {
  return s.toLocaleLowerCase('tr')
    .replace(/[çğıiöşüâîû]/g, (c) => MAP[c] ?? c)
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const THRESHOLD = 0.8;

// With no roster to check against, anything in the name field would go into
// the report as a student. Real names are one to four words of letters; a
// sentence, a number or a scribble is sent to the teacher instead.
export function looksLikeName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  return name.trim().length <= 40 && words.length <= 4 && words.every((w) => /^[\p{L}][\p{L}'.-]*$/u.test(w));
}

// Returns the roster entry the written name most likely is, or null when no
// entry is close enough — an unsure match must go to the teacher, not be guessed.
export function matchRoster(name: string | null, roster: string[]): string | null {
  if (!name) return null;
  const n = normalizeName(name);
  let best: { entry: string; sim: number } | null = null;
  for (const entry of roster) {
    const e = normalizeName(entry);
    const sim = 1 - distance(n, e) / Math.max(n.length, e.length, 1);
    if (!best || sim > best.sim) best = { entry, sim };
  }
  return best && best.sim >= THRESHOLD ? best.entry : null;
}
