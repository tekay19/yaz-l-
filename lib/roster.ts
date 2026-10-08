import { looksLikeName, normalizeName } from '@/lib/grading/names';
import { normalizeImage } from '@/lib/images';
import type { Reader } from '@/lib/reader/types';

export const MAX_ROSTER = 200;
// words of a list's headings and columns, never part of a student's name
const HEADING = new Set(['ogrenci', 'no', 'numara', 'numarasi', 'sinif', 'sinifi', 'liste', 'listesi', 'adi', 'soyadi', 'okul', 'okulu', 'sube', 'subesi', 'tarih', 'imza', 'ogretmen', 'sira']);

// The names the reader copied from a class list, cleaned of the row and
// school numbers a list puts before them ("12  1234 Elif Yılmaz"), each name
// once, and without anything that does not look like a name (a heading, a date).
export function cleanRosterNames(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const name = r.replace(/^[\s\d.)\-–:|]+/, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const key = name.toLocaleLowerCase('tr');
    const heading = normalizeName(name).split(' ').some((w) => HEADING.has(w));
    if (!name || heading || seen.has(key) || !looksLikeName(name.replace(/\[\?\w*\]/g, 'X'))) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, MAX_ROSTER);
}

// A photo of a class list → its students' names, for the teacher to check.
export async function readRosterPhoto(reader: Reader, photo: Buffer): Promise<string[]> {
  if (!reader.readRoster) throw new Error('roster_reader_missing');
  const { read } = await reader.readRoster(await normalizeImage(photo));
  return cleanRosterNames(read.names);
}
