import { normalizeName } from '@/lib/grading/names';
import type { ReportRow } from './input';

// Shared by the optik and klasik report builders.

const REASONS: Record<string, string> = {
  unreadable: 'Fotoğraf okunamadı', refused: 'Fotoğraf işlenemedi', max_attempts: 'Okuma zaman aşımına uğradı',
};
// Why a page could not be read, for the teacher.
export const failReason = (error: string | null) => REASONS[error ?? ''] ?? REASONS.unreadable;

export const DUPLICATE_NAME = 'İsim başka bir kâğıtta da var';

// Two sheets under one name hide one student's result behind another's:
// usually the name was matched to the wrong roster entry.
export function flagDuplicateNames(rows: ReportRow[]) {
  const byName = new Map<string, ReportRow[]>();
  for (const r of rows) {
    if (r.student === `Kâğıt ${r.seq}`) continue;
    const k = normalizeName(r.student);
    if (k) byName.set(k, [...(byName.get(k) ?? []), r]);
  }
  for (const group of byName.values()) {
    if (group.length > 1) for (const r of group) r.flags.unshift(DUPLICATE_NAME);
  }
}

// a report file name from the exam title, safe in a mail attachment or a download
export const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'sinav';
