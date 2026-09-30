import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ReportInput } from './input';

const FONT_DIR = process.env.FONT_DIR || path.join(process.cwd(), 'assets/fonts');
const GREEN = rgb(0.078, 0.318, 0.235);
const INK = rgb(0.09, 0.125, 0.11);

export async function buildSummaryPdf(input: ReportInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(await fs.readFile(path.join(FONT_DIR, 'NotoSans-Regular.ttf')), { subset: true });
  const bold = await doc.embedFont(await fs.readFile(path.join(FONT_DIR, 'NotoSans-Bold.ttf')), { subset: true });
  const page = doc.addPage([595.28, 841.89]); // A4
  let y = 790;
  const line = (text: string, size = 11, font = regular, color = INK) => {
    page.drawText(text, { x: 50, y, size, font, color });
    y -= size + 8;
  };

  line(input.title, 20, bold, GREEN);
  line('Sınıf özeti', 12, regular, rgb(0.36, 0.4, 0.37));
  y -= 10;
  const s = input.stats;
  const klasik = input.mode === 'klasik';
  const pct = klasik ? '%' : ''; // klasik statistics are percentages of the total points
  line(`Öğrenci sayısı: ${s.count}`);
  line(`${klasik ? 'Ortalama başarı' : 'Ortalama'}: ${pct}${s.average.toLocaleString('tr-TR')}`);
  line(`En yüksek: ${pct}${s.max}   En düşük: ${pct}${s.min}`);
  y -= 10;

  line('Puan dağılımı', 13, bold, GREEN);
  const maxCount = Math.max(1, ...s.buckets.map((b) => b.count));
  for (const b of s.buckets) {
    page.drawText(b.label, { x: 50, y, size: 11, font: regular, color: INK });
    page.drawRectangle({ x: 120, y: y - 2, width: (b.count / maxCount) * 320, height: 12, color: GREEN });
    page.drawText(String(b.count), { x: 450, y, size: 11, font: regular, color: INK });
    y -= 22;
  }

  if (s.questions.length) {
    y -= 10;
    line('En zor sorular', 13, bold, GREEN);
    for (const q of [...s.questions].sort((a, b) => a.correctRate - b.correctRate).slice(0, 5)) {
      line(klasik
        ? `${q.q}. soru — sınıf ortalaması, sorunun puanının %${q.correctRate}'i`
        : `${q.q}. soru — sınıfın %${q.correctRate}'i doğru yaptı${q.commonWrong ? `, en çok ${q.commonWrong} seçildi` : ''}`);
    }
  }
  const unsure = input.rows.filter((r) => r.flags.length).length + input.failed.length;
  if (unsure) {
    y -= 10;
    line(`Kontrol edilecek kâğıt: ${unsure} (Excel dosyasındaki "Kontrol Edilecekler" sayfasına bakın)`, 10);
  }
  return Buffer.from(await doc.save());
}
