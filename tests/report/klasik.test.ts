import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { buildReportInput } from '@/lib/report/input';
import { buildWorkbook } from '@/lib/report/excel';
import { buildSummaryPdf } from '@/lib/report/pdf';
import type { KlasikRead, QuestionGrade, Rubric } from '@/lib/types';

export const rubric: Rubric = {
  questions: [
    { q: 1, rev: 1, type: 'islem', prompt: '2x + 3 = 11', answer: 'x = 4', accepted: [],
      criteria: [{ id: 'c1', text: 'Kurulum', points: 4, role: 'other', required: false }, { id: 'c2', text: 'Sonuç', points: 6, role: 'result', required: false }],
      policy: { workRequired: true, carryForward: true, wrongInfoPenalty: false } },
    { q: 2, rev: 1, type: 'yorum', prompt: 'Lirik şiir', answer: 'Duygu', accepted: [],
      criteria: [{ id: 'c1', text: 'Duyguyu açıklar', points: 5, role: 'other', required: false }],
      policy: { workRequired: false, carryForward: true, wrongInfoPenalty: false } },
  ],
};
const read = (over: Partial<KlasikRead>): KlasikRead => ({ isBackSide: false, studentName: null, nameConfidence: 'high', unreadable: false, answers: [], ...over });
const ln = (...t: string[]) => t.map((text) => ({ text, crossed: false }));
const g = (q: number, over: Partial<QuestionGrade>): QuestionGrade => ({
  q, rev: 1, criteria: [], resultCorrect: null, resultPath: null, firstError: null, errorKind: null, flags: [], confidence: 'high', note: '', failed: false, textOnly: false, ...over,
});

async function klasikJob() {
  const db = await testDb();
  const u = await makeUser(db);
  const [job] = await db.insert(jobs).values({ userId: u.id, title: '10-A Karma', mode: 'klasik', status: 'review', rubric, rubricRev: 1, roster: ['Elif Yılmaz', 'Mert Kaya'] }).returning();
  await db.insert(pages).values([
    { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: { type: 'klasik-key', read: read({}) } },
    { jobId: job.id, kind: 'student', seq: 1, status: 'read', gradedRev: 1,
      result: { type: 'klasik-student', read: read({ studentName: 'Elif Yilmaz', answers: [{ q: 1, lines: ln('2x = 8', 'x = 4'), unclear: false, hasFigure: false }] }) },
      grade: { questions: [
        g(1, { criteria: [{ id: 'c1', verdict: 'met', evidence: '2x = 8' }, { id: 'c2', verdict: 'met', evidence: 'x = 4' }], resultCorrect: true, resultPath: 'valid' }),
        g(2, { criteria: [{ id: 'c1', verdict: 'partial', evidence: 'duygularını anlatır' }] }),
      ] } },
    // the back side carries question 2
    { jobId: job.id, kind: 'student', seq: 2, status: 'read', gradedRev: 1,
      result: { type: 'klasik-student', read: read({ isBackSide: true, answers: [{ q: 2, lines: ln('Şair duygularını anlatır.'), unclear: false, hasFigure: false }] }) } },
    { jobId: job.id, kind: 'student', seq: 3, status: 'read', gradedRev: 1, override: { points: [{ q: 2, points: 5 }] },
      result: { type: 'klasik-student', read: read({ studentName: 'Mert Kaya', answers: [{ q: 1, lines: ln('x = 4'), unclear: false, hasFigure: false }, { q: 2, lines: ln('Duygu'), unclear: false, hasFigure: false }] }) },
      grade: { questions: [g(1, { criteria: [{ id: 'c2', verdict: 'met', evidence: 'x = 4' }], resultCorrect: true, resultPath: 'none' }), g(2, { criteria: [] })] } },
    { jobId: job.id, kind: 'student', seq: 4, status: 'failed', error: 'unreadable' },
  ]);
  return { db, job };
}

describe('klasik report', () => {
  it('scores merged sheets, names them from the roster and explains every flag', async () => {
    const { db, job } = await klasikJob();
    const r = await buildReportInput(db, job.id);
    expect(r.mode).toBe('klasik');
    expect(r.rows.map((x) => [x.student, x.total, x.max, x.score])).toEqual([['Elif Yılmaz', 12.5, 15, 83], ['Mert Kaya', 5, 15, 33]]);
    expect(r.rows[0].points).toEqual([{ q: 1, points: 10, max: 10 }, { q: 2, points: 2.5, max: 5 }]);
    // a bare result where the work was asked for: 0 and the reason, spelled out
    expect(r.rows[1].flags).toEqual(['1. soru: Sonuç doğru ama yazılı işlemlerden çıkmıyor']);
    expect(r.failed).toEqual([{ seq: 4, reason: 'Fotoğraf okunamadı' }]);
    expect(r.klasik?.questions).toEqual([{ q: 1, max: 10, average: 5, fullCount: 1 }, { q: 2, max: 5, average: 3.8, fullCount: 1 }]);
    expect(r.stats).toMatchObject({ count: 2, average: 58, max: 83, min: 33 });
    expect(r.stats.questions).toEqual([{ q: 1, correctRate: 50, commonWrong: null }, { q: 2, correctRate: 76, commonWrong: null }]);
    expect(r.needsReview).toBe(true);
  });

  it('writes a workbook with a column per question and a one-page PDF', async () => {
    const { db, job } = await klasikJob();
    const input = await buildReportInput(db, job.id);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(await buildWorkbook(input)).buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Puanlar', 'Soru Analizi', 'Kontrol Edilecekler']);
    const sheet = wb.getWorksheet('Puanlar')!;
    expect(sheet.getRow(1).values).toEqual([undefined, 'Öğrenci', 'S1 (10)', 'S2 (5)', 'Toplam', 'Yüzde', 'Not']);
    expect(sheet.getRow(2).values).toEqual([undefined, 'Elif Yılmaz', 10, 2.5, 12.5, 83, '']);
    expect(sheet.getRow(4).getCell(1).value).toBe('Kâğıt 4');
    expect(wb.getWorksheet('Soru Analizi')!.getRow(2).values).toEqual([undefined, 1, 10, 5, 50, 1]);
    const pdf = await PDFDocument.load(await buildSummaryPdf(input));
    expect(pdf.getPageCount()).toBe(1);
  });
});
