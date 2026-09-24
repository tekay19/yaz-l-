import ExcelJS from 'exceljs';
import type { ReportInput } from './input';

export async function buildWorkbook(input: ReportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SınavOku';

  const scores = wb.addWorksheet('Puanlar');
  scores.columns = [
    { header: 'Öğrenci', key: 'student', width: 28 },
    { header: 'Doğru', key: 'correct', width: 9 },
    { header: 'Yanlış', key: 'wrong', width: 9 },
    { header: 'Boş', key: 'blank', width: 9 },
    { header: 'Puan', key: 'score', width: 9 },
    { header: 'Not', key: 'note', width: 48 },
  ];
  scores.getRow(1).font = { bold: true };
  for (const r of input.rows) scores.addRow({ ...r, note: r.flags.join('; ') });
  for (const f of input.failed) scores.addRow({ student: `Kâğıt ${f.seq}`, note: f.reason });

  const qs = wb.addWorksheet('Soru Analizi');
  qs.columns = [
    { header: 'Soru', key: 'q', width: 8 },
    { header: 'Doğru cevap', key: 'answer', width: 13 },
    { header: 'Doğru yapan (%)', key: 'rate', width: 16 },
    { header: 'En çok seçilen yanlış', key: 'wrong', width: 22 },
  ];
  qs.getRow(1).font = { bold: true };
  for (const q of input.stats.questions) {
    qs.addRow({
      q: q.q,
      answer: input.key.answers.find((a) => a.q === q.q)?.option ?? '',
      rate: q.correctRate,
      wrong: q.commonWrong ?? '',
    });
  }

  const review = wb.addWorksheet('Kontrol Edilecekler');
  review.columns = [
    { header: 'Kâğıt', key: 'seq', width: 8 },
    { header: 'Öğrenci', key: 'student', width: 28 },
    { header: 'Kontrol edin', key: 'flag', width: 60 },
  ];
  review.getRow(1).font = { bold: true };
  for (const r of input.rows) for (const flag of r.flags) review.addRow({ seq: r.seq, student: r.student, flag });
  for (const f of input.failed) review.addRow({ seq: f.seq, student: '', flag: `${f.reason} — yeniden çekip yükleyin (sayfa hakkı iade edildi)` });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
