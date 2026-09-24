import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { buildWorkbook } from '@/lib/report/excel';
import { buildSummaryPdf } from '@/lib/report/pdf';
import { scoreSheet } from '@/lib/grading/score';
import { classStats } from '@/lib/grading/stats';
import type { ReportInput } from '@/lib/report/input';

const key = { questionCount: 2, answers: [{ q: 1, option: 'A' as const }, { q: 2, option: 'B' as const }] };
const sheet = scoreSheet(key, [{ q: 1, marked: ['A'] }, { q: 2, marked: ['C'] }]);
const input: ReportInput = {
  title: '9-B Matematik', key,
  rows: [{ pageId: 'p1', seq: 1, student: 'Şule Çağlar', correct: 1, wrong: 1, blank: 0, score: 50, flags: ['2. soru net okunamadı'] }],
  failed: [], stats: classStats(key, [sheet]), needsReview: true,
};

describe('report files', () => {
  it('writes a workbook with scores, question analysis and review sheets', async () => {
    const wb = new ExcelJS.Workbook();
    // exceljs types its input as an ArrayBuffer, not a Node Buffer
    await wb.xlsx.load(new Uint8Array(await buildWorkbook(input)).buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Puanlar', 'Soru Analizi', 'Kontrol Edilecekler']);
    const row = wb.getWorksheet('Puanlar')!.getRow(2);
    expect(row.getCell(1).value).toBe('Şule Çağlar');
    expect(row.getCell(5).value).toBe(50);
  });
  it('writes a one-page PDF', async () => {
    const pdf = await PDFDocument.load(await buildSummaryPdf(input));
    expect(pdf.getPageCount()).toBe(1);
  });
});
