import fs from 'node:fs/promises';
import path from 'node:path';
import { createReader, readerModel } from '@/lib/reader';
import { normalizeImage } from '@/lib/images';
import { spent, withBudget } from './budget';

// How exactly the klasik reader copies real student handwriting, against the
// RMIT Student Messy Handwritten Dataset (SMHD, CC BY-NC 4.0: student exam
// answers with a line-by-line transcription; "#" marks struck-out words).
// Each page goes through the product's own reader; every line it returns,
// crossed-out ones excluded, is compared with the transcription.
//
//   OCR_LONG_EDGE=1568 npx tsx --tsconfig tsconfig.json scripts/eval-ocr.ts
//
// Reads are cached per model and image size under eval/data/handwritten/smhd/out-*.

const DIR = 'eval/data/handwritten/smhd';
const EDGE = Number(process.env.OCR_LONG_EDGE || 1568);

export const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/#/g, ' ')
  .replace(/[“”"'`’]/g, '').replace(/\s*([.,;:!?()\-=+*/])\s*/g, '$1').replace(/\s+/g, ' ').trim();

function edits(a: string[] | string, b: string[] | string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

async function main() {
  const pick = (await fs.readFile(path.join(DIR, 'pick.txt'), 'utf8')).split(/\r?\n/).filter(Boolean);
  const reader = withBudget(createReader());
  const out = path.join(DIR, `out-${readerModel()}-${EDGE}`);
  await fs.mkdir(out, { recursive: true });
  let ce = 0, cn = 0, we = 0, wn = 0;
  const rows: string[] = [];
  const queue = [...pick];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const cache = path.join(out, `${id}.json`);
      let read;
      try { read = JSON.parse(await fs.readFile(cache, 'utf8')); } catch {
        try {
          read = (await reader.readKlasik(await normalizeImage(await fs.readFile(path.join(DIR, 'scans', `${id}.jpg`)), EDGE))).read;
          await fs.writeFile(cache, JSON.stringify(read, null, 2));
        } catch (e) { console.error(id, e instanceof Error ? e.message.slice(0, 150) : e); continue; }
      }
      const got = norm(read.answers.flatMap((a: any) => a.lines.filter((l: any) => !l.crossed).map((l: any) => l.text.replace(/\[\?([^\]]*)\]/g, '$1'))).join(' '));
      const truth = norm(await fs.readFile(path.join(DIR, 'transcriptions', `${id}.txt`), 'utf8'));
      const c = edits(got, truth), w = edits(got.split(' '), truth.split(' '));
      ce += c; cn += truth.length; we += w; wn += truth.split(' ').length;
      rows.push(`| ${id} | ${truth.split(' ').length} | %${((c / truth.length) * 100).toFixed(1)} | %${((w / truth.split(' ').length) * 100).toFixed(1)} |`);
    }
  }));
  const md = [`# El yazısı okuma — ${readerModel()} · uzun kenar ${EDGE}px`, '',
    `Sayfa: ${rows.length} · karakter hata oranı **%${((ce / cn) * 100).toFixed(2)}** · kelime hata oranı **%${((we / wn) * 100).toFixed(2)}**`, '',
    '| Sayfa | Kelime | KHO | WER |', '|---|---|---|---|', ...rows.sort()].join('\n');
  await fs.writeFile(path.join(out, 'report.md'), md);
  console.log(md.split('\n').slice(0, 3).join('\n'));
}

process.on('exit', () => { const l = spent(); if (l.calls) console.log(`Harcama (toplam): $${l.usd.toFixed(3)} · ${l.calls} çağrı`); });
main().catch((e) => { console.error(e); process.exit(1); });
