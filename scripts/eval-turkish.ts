import fs from 'node:fs/promises';
import path from 'node:path';
import { createReader, readerModel } from '@/lib/reader';
import { spent, withBudget } from './budget';
import type { Usage } from '@/lib/reader/types';
import { normalizeImage } from '@/lib/images';
import { DEMO_RUBRIC } from '@/lib/demo/exam';
import { gradeDemoSheets, type DemoSheet } from '@/lib/demo/grade';
import type { KlasikRead } from '@/lib/types';
import set from '@/eval/klasik/goruntu-seti/cases.json';

// The Turkish exam set (eval/klasik/goruntu-seti) end to end, as the product
// runs it: each page photo is read, front and back are joined by the
// product's own merge (using the reader's back-side guess), every answer is
// graded against the approved rubric and scored by the product's code.
// Measured: reading (character error rate against the known answers),
// names, and the points against the planned teacher points.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-turkish.ts
//
// Photos: eval/data/klasik-goruntu/sNN-name/{on,arka}.png. Model answers
// are cached under eval/data/klasik-goruntu/out-<model>/. Real API, real cost.

const DIR = 'eval/data/klasik-goruntu';
const STUDENTS = [
  'Elif Yıldız', 'Mert Kaya', 'Zeynep Arslan', 'Emre Demir', 'Ayşe Çelik', 'Burak Şahin', 'Selin Öztürk', 'Can Aydın',
  'Deniz Koç', 'Ece Kurt', 'Ali Polat', 'İrem Güneş', 'Oğuz Tekin', 'Melis Acar', 'Kaan Yurt',
];

const exists = (p: string) => fs.access(p).then(() => true, () => false);
const writeJson = async (p: string, v: unknown) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2));
};

// Levenshtein distance, for the character error rate
function edits(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// spacing and how a line was broken do not count as reading errors; the
// letters (ç ğ ı İ ö ş ü included) and the numbers do
const flat = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').replace(/\s*([=+\-*/^(),.:])\s*/g, '$1').trim();

async function main() {
  const reader = withBudget(createReader());
  const model = readerModel();
  const out = path.join(DIR, `out-${model}`);
  const folders = (await fs.readdir(DIR)).filter((f) => /^s\d\d-/.test(f)).sort();
  console.log(`model ${model} · ${folders.length} öğrenci`);

  type Row = { sid: string; name: string; reads: KlasikRead[]; usage: Usage[]; sheets: DemoSheet[] };
  const rows: Row[] = [];
  // a few students at a time, so the API's rate limit is not hit
  const queue = [...folders];
  await Promise.all(Array.from({ length: Number(process.env.TR_CONCURRENCY || 3) }, async () => {
    for (let folder = queue.shift(); folder; folder = queue.shift()) await student(folder);
  }));
  async function student(folder: string) {
    const sid = folder.slice(0, 3);
    const reads: KlasikRead[] = [];
    const usage: Usage[] = [];
    for (const side of ['on', 'arka']) {
      const img = path.join(DIR, folder, `${side}.png`);
      if (!(await exists(img))) continue;
      const cache = path.join(out, 'reads', `${sid}-${side}.json`);
      if (!(await exists(cache))) {
        const r = await reader.readKlasik(await normalizeImage(await fs.readFile(img)));
        await writeJson(cache, r);
      }
      const r = JSON.parse(await fs.readFile(cache, 'utf8'));
      reads.push(r.read);
      usage.push(r.usage);
    }
    const gradeCache = path.join(out, 'grades', `${sid}.json`);
    let sheets: DemoSheet[];
    if (await exists(gradeCache)) sheets = JSON.parse(await fs.readFile(gradeCache, 'utf8'));
    else {
      sheets = await gradeDemoSheets(reader, DEMO_RUBRIC, reads);
      await writeJson(gradeCache, sheets);
    }
    rows.push({ sid, name: STUDENTS[Number(sid.slice(1)) - 1], reads, usage, sheets });
  }
  rows.sort((a, b) => a.sid.localeCompare(b.sid));

  const lines: string[] = [`# Türkçe kâğıt testi — ${model}`, ''];
  // joining: each student must become exactly one paper of two pages
  const joined = rows.filter((r) => r.sheets.length === 1 && r.sheets[0].pages === r.reads.length).length;
  const names = rows.filter((r) => r.sheets[0]?.student?.normalize('NFC') === r.name.normalize('NFC')).length;
  // reading
  let charErr = 0, charTotal = 0, exact = 0, answers = 0;
  const misreads: string[] = [];
  let crossedOk = 0, crossedTotal = 0;
  for (const r of rows) {
    const merged = r.sheets.flatMap((s) => s.questions);
    for (const c of set.cases.filter((x) => x.id.startsWith(`${r.sid}-`))) {
      const expected = c.lines.filter((l) => typeof l === 'string' || !l.crossed).map((l) => (typeof l === 'string' ? l : l.text)).join(' ');
      const got = merged.find((q) => q.q === c.q)?.lines.filter((l) => !l.crossed).map((l) => l.text).join(' ') ?? '';
      if (c.lines.some((l) => typeof l !== 'string' && l.crossed)) {
        crossedTotal++;
        if (merged.find((q) => q.q === c.q)?.lines.some((l) => l.crossed)) crossedOk++;
      }
      const e = edits(flat(got), flat(expected));
      answers++;
      charErr += e;
      charTotal += Math.max(1, flat(expected).length);
      if (e === 0) exact++;
      else misreads.push(`${c.id}: "${got}" ← beklenen "${expected}"`);
    }
  }
  lines.push('## Okuma', '', '| Ölçü | Değer |', '|---|---|',
    `| Birebir doğru okunan cevap | ${exact}/${answers} (%${((exact / answers) * 100).toFixed(0)}) |`,
    `| Karakter hata oranı | %${((charErr / charTotal) * 100).toFixed(2)} |`,
    `| İsim doğru | ${names}/${rows.length} |`,
    `| Ön + arka tek kâğıtta birleşti | ${joined}/${rows.length} |`,
    `| Üstü çizili satır tanındı | ${crossedOk}/${crossedTotal} |`, '');
  // grading
  type Pair = { id: string; teacher: number; system: number; max: number; flagged: boolean; tags: string[] };
  const pairs: Pair[] = [];
  for (const r of rows) {
    const merged = r.sheets.flatMap((s) => s.questions);
    for (const c of set.cases.filter((x) => x.id.startsWith(`${r.sid}-`))) {
      const q = merged.find((x) => x.q === c.q);
      if (!q) continue;
      pairs.push({ id: c.id, teacher: c.teacher, system: q.points, max: q.max, flagged: q.attention.length > 0, tags: c.tags });
    }
  }
  const tol = (p: Pair) => Math.abs(p.system - p.teacher) <= 0.1 * p.max;
  const over = pairs.filter((p) => !p.flagged && p.system - p.teacher > 0.1 * p.max);
  const under = pairs.filter((p) => !p.flagged && p.teacher - p.system > 0.1 * p.max);
  const totals = rows.map((r) => ({
    sid: r.sid,
    teacher: set.cases.filter((x) => x.id.startsWith(`${r.sid}-`)).reduce((a, c) => a + c.teacher, 0),
    system: r.sheets.reduce((a, s) => a + s.total, 0),
  }));
  lines.push('## Puanlama', '', '| Ölçü | Değer |', '|---|---|',
    `| Doğru puanla aynı (±%10) | ${pairs.filter(tol).length}/${pairs.length} (%${((pairs.filter(tol).length / pairs.length) * 100).toFixed(0)}) |`,
    `| Öğretmene işaretlenen | %${((pairs.filter((p) => p.flagged).length / pairs.length) * 100).toFixed(0)} |`,
    `| Uyarısız fazla puan | ${over.length} ${over.map((p) => p.id).join(', ')} |`,
    `| Uyarısız eksik puan | ${under.length} ${under.map((p) => p.id).join(', ')} |`,
    `| Öğrenci toplamı ort. fark (100 üzerinden) | ${(totals.reduce((a, t) => a + Math.abs(t.system - t.teacher), 0) / totals.length).toFixed(1)} |`, '');
  lines.push('| Kâğıt | Beklenen | Sistem |', '|---|---|---|', ...totals.map((t) => `| ${t.sid} | ${t.teacher} | ${t.system} |`), '');
  lines.push('## Cevap türüne göre', '', '| Tür | n | doğru puan (±%10) | işaretli |', '|---|---|---|---|');
  for (const tag of [...new Set(pairs.flatMap((p) => p.tags))].sort()) {
    const ps = pairs.filter((p) => p.tags.includes(tag));
    lines.push(`| ${tag} | ${ps.length} | ${ps.filter(tol).length} | ${ps.filter((p) => p.flagged).length} |`);
  }
  lines.push('', '## Farklı okunan cevaplar', '', ...misreads.map((m) => `- ${m}`));
  const md = lines.join('\n');
  await fs.writeFile(path.join(out, 'report.md'), md);
  console.log(md);
}

process.on('exit', () => { const l = spent(); if (l.calls) console.log(`Harcama (toplam): $${l.usd.toFixed(3)} · ${l.calls} çağrı`); });

main().catch((e) => { console.error(e); process.exit(1); });
