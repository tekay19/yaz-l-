import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from './helpers/db';
import { jobs, pages } from '@/db/schema';
import { cleanRosterNames, readRosterPhoto } from '@/lib/roster';
import { regradeRegrouped } from '@/lib/klasik/jobs';
import type { Reader } from '@/lib/reader/types';

describe('cleanRosterNames', () => {
  it('keeps the names of a list, without its numbers, headings or repeats', () => {
    expect(cleanRosterNames([
      '9-B SINIF LİSTESİ 2025-2026', '1  1234 Elif Yılmaz', '2. Mert Kaya', '3) Deniz Koç', 'Deniz Koç',
      'Öğrenci No', 'Ayşe [?]ahin', '',
      'Adı Soyadı', 'Sınıf Öğretmeni',
    ])).toEqual(['Elif Yılmaz', 'Mert Kaya', 'Deniz Koç', 'Ayşe [?]ahin']);
  });
});

describe('readRosterPhoto', () => {
  it('reads the names from a photo of the list', async () => {
    const photo = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    const reader = { readRoster: async () => ({ read: { names: ['1 Elif Yılmaz', '2 Mert Kaya'] }, usage: { inputTokens: 1, outputTokens: 1 } }) } as unknown as Reader;
    expect(await readRosterPhoto(reader, photo)).toEqual(['Elif Yılmaz', 'Mert Kaya']);
  });
});

describe('regradeRegrouped', () => {
  const read = (studentName: string, q: number) => ({
    type: 'klasik-student' as const,
    read: { isBackSide: false, studentName, nameConfidence: 'high' as const, unreadable: false,
      answers: [{ q, lines: [{ text: `${q}. cevap`, crossed: false }], unclear: false, hasFigure: false }] },
  });
  it('sends back for grading only the sheets a new class list joins or splits', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [job] = await db.insert(jobs).values({ userId: u.id, mode: 'klasik', status: 'review', rubricRev: 1 }).returning();
    const rows = await db.insert(pages).values([
      { jobId: job.id, kind: 'student', seq: 1, status: 'read', result: read('Elif Yılmaz', 1), gradedRev: 1 },
      { jobId: job.id, kind: 'student', seq: 2, status: 'read', result: read('Deniz Köş', 1), gradedRev: 1 },
      { jobId: job.id, kind: 'student', seq: 3, status: 'read', result: read('Deniz Koç', 2), gradedRev: 1 },
    ]).returning();
    // without a list "Deniz Köş" and "Deniz Koç" are two sheets; the list makes them one
    expect(await regradeRegrouped(db, job.id, [], ['Elif Yılmaz', 'Deniz Koç'])).toBe(1);
    const after = await db.select().from(pages).where(eq(pages.jobId, job.id));
    const rev = (seq: number) => after.find((p) => p.seq === seq)!.gradedRev;
    expect([rev(1), rev(2), rev(3)]).toEqual([1, 0, 0]);
    expect(rows).toHaveLength(3);
  });
});
