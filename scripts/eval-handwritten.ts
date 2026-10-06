import fs from 'node:fs/promises';
import path from 'node:path';
import { createReader, readerModel } from '@/lib/reader';
import { spent, withBudget } from './budget';
import type { Usage } from '@/lib/reader/types';
import { normalizeImage } from '@/lib/images';
import { mergeSheets, type SheetPage } from '@/lib/klasik/sheets';
import { normalizeDraft } from '@/lib/klasik/rubric';
import { failedGrade, toGrade } from '@/lib/klasik/grade';
import { gradeInChunks } from '@/lib/klasik/chunks';
import { INFO_FLAGS, scoreSheet } from '@/lib/klasik/score';
import type { GradingStyle, KlasikGrade, KlasikRead, Rubric } from '@/lib/types';

// Real handwritten exams end to end: photo → transcription → rubric → points,
// against a teacher's marks. Set: "A Dataset of Digitized Student Examination
// Papers, Answer Keys, and Manual Evaluations" (Dinesh K P, Anna University,
// Mendeley Data, doi:10.17632/sf3kvjwknt.1, CC BY 4.0): 50 students, 20 MCQs
// written as letters (exact ground truth for reading) and 15 short answers
// marked 0-2 by the teacher.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-handwritten.ts
//
// Expects eval/data/handwritten/raw (the set) and pages/sNN-pK.jpg (the PDF
// pages as images). Every model answer is cached under out/, so a run that
// stops on a rate limit continues where it stopped. Real API, real cost.

const DIR = 'eval/data/handwritten';
const OUT = path.join(DIR, process.env.HW_OUT || 'out');
const CONC = Number(process.env.HW_CONCURRENCY || 3);
const SHORT = Array.from({ length: 15 }, (_, i) => i + 21);
const MAX = 2;

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }));
  return out;
}
const exists = (p: string) => fs.access(p).then(() => true, () => false);
const readJson = async <T,>(p: string): Promise<T> => JSON.parse(await fs.readFile(p, 'utf8'));
const writeJson = async (p: string, v: unknown) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2));
};

// a small CSV reader: quoted fields may hold commas
function csv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let cur = '', quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

type Teacher = { mcq: Record<number, string>; marks: Record<number, number | null> };

async function loadSet() {
  const raw = path.join(DIR, 'raw');
  const questions = new Map<number, string>();
  for (const m of (await fs.readFile(path.join(raw, 'Question.txt'), 'utf8')).matchAll(/^(\d+)\.\s+(.+)$/gm)) questions.set(Number(m[1]), m[2].trim());
  const key = new Map<number, string>();
  for (const [q, , ans] of csv(await fs.readFile(path.join(raw, 'answerkey.txt'), 'utf8')).slice(1)) key.set(Number(q), ans);
  const rows = csv(await fs.readFile(path.join(raw, 'Teacher_manual_marks_Anonymized.csv'), 'utf8'));
  const head = rows[0];
  const teachers = new Map<number, Teacher>();
  for (const r of rows.slice(1)) {
    const sid = Number(r[0].replace('Student_', ''));
    const t: Teacher = { mcq: {}, marks: {} };
    for (let q = 1; q <= 35; q++) {
      const v = (r[head.indexOf(String(q))] ?? '').trim();
      if (q <= 20) t.mcq[q] = v.toUpperCase();
      // NC: not corrected (left blank); NM: answered, no mark given
      else t.marks[q] = v === '' || v === 'NC' ? null : v === 'NM' ? 0 : Number(v);
    }
    teachers.set(sid, t);
  }
  const pages = new Map<number, string[]>();
  for (const f of (await fs.readdir(path.join(DIR, 'pages'))).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
    const m = f.match(/^s(\d+)-p(\d+)\.jpg$/);
    if (m) pages.set(Number(m[1]), [...(pages.get(Number(m[1])) ?? []), f]);
  }
  return { questions, key, teachers, pages };
}

type CachedRead = { read: KlasikRead; usage: Usage; ms: number };

async function main() {
  const { questions, key, teachers, pages } = await loadSet();
  // HW_ONLY=1,2,3 limits the run to these students
  const only = (process.env.HW_ONLY || '').split(',').filter(Boolean).map(Number);
  if (only.length) for (const sid of [...pages.keys()]) if (!only.includes(sid)) pages.delete(sid);
  const reader = withBudget(createReader());
  console.log(`model ${readerModel()} · ${pages.size} öğrenci · ${[...pages.values()].flat().length} sayfa`);

  // 1. read every page (cached)
  let readFails = 0;
  await pool([...pages.values()].flat(), CONC, async (f) => {
    const out = path.join(OUT, 'reads', f.replace('.jpg', '.json'));
    if (await exists(out)) return;
    const started = Date.now();
    try {
      const image = await normalizeImage(await fs.readFile(path.join(DIR, 'pages', f)));
      const { read, usage } = await reader.readKlasik(image);
      await writeJson(out, { read, usage, ms: Date.now() - started } satisfies CachedRead);
    } catch (e) {
      readFails++;
      console.error('read', f, e instanceof Error ? e.message.slice(0, 160) : e);
    }
  });

  // 2. the rubric, drafted from the teacher's key as the product does (cached)
  const rubricFile = path.join(OUT, 'rubric.json');
  if (!(await exists(rubricFile))) {
    const keyText = SHORT.map((q) => `${q}. soru:\nSoru: ${questions.get(q)}\nCevap: ${key.get(q)}`).join('\n\n');
    const maxPoints = Array.from({ length: 35 }, (_, i) => (i + 1 >= 21 ? MAX : 1));
    const { read: draft } = await reader.draftRubric({ keyText, maxPoints });
    await writeJson(rubricFile, { draft, rubric: normalizeDraft(draft, maxPoints) });
  }
  const { rubric: full } = await readJson<{ rubric: Rubric }>(rubricFile);
  // HW_STYLE=strict|balanced|lenient grades with that style (its own cache)
  const style = (process.env.HW_STYLE || 'balanced') as GradingStyle;
  const rubric: Rubric = {
    questions: full.questions.filter((q) => SHORT.includes(q.q)).map((q) => ({ ...q, policy: { ...q.policy, style } })),
  };
  const gradesDir = style === 'balanced' ? 'grades' : `grades-${style}`;

  // 3. grade each student's paper (cached)
  const students = [...pages.keys()].sort((a, b) => a - b);
  let gradeFails = 0;
  const sheets = await pool(students, CONC, async (sid) => {
    const reads: KlasikRead[] = [];
    for (const f of pages.get(sid)!) {
      const p = path.join(OUT, 'reads', f.replace('.jpg', '.json'));
      if (await exists(p)) reads.push((await readJson<CachedRead>(p)).read);
    }
    if (reads.length !== pages.get(sid)!.length) return null; // a page is still unread
    // one PDF is one student: the pages after the first are joined to it
    // whatever the reader thought (the reader's guess is scored separately)
    const rows: SheetPage[] = reads.map((read, i) => ({
      id: `p${i + 1}`, seq: i + 1, status: 'read', error: null, filePath: null,
      result: { type: 'klasik-student', read: { ...read, isBackSide: i > 0 } }, override: null, grade: null, gradedRev: 0, gradeAttempts: 0,
    }));
    const sheet = mergeSheets(rows).sheets[0];
    const gradeFile = path.join(OUT, gradesDir, `s${String(sid).padStart(2, '0')}.json`);
    let grade: KlasikGrade;
    if (await exists(gradeFile)) grade = await readJson(gradeFile);
    else {
      const todo = rubric.questions.filter((rq) => sheet.read.answers.some((a) => a.q === rq.q && a.lines.some((l) => !l.crossed && l.text.trim())));
      try {
        const answers = todo.map((rq) => sheet.read.answers.find((a) => a.q === rq.q)!);
        const res = todo.length ? await gradeInChunks(reader, { questions: todo, answers, images: [] }) : null;
        grade = { questions: todo.map((rq) => {
          const o = res?.read.questions.find((x) => x.q === rq.q);
          return o ? toGrade(rq, o, false) : failedGrade(rq);
        }) };
        await writeJson(gradeFile, grade);
      } catch (e) {
        gradeFails++;
        console.error('grade', sid, e instanceof Error ? e.message.slice(0, 160) : e);
        return null;
      }
    }
    return { sid, reads, read: sheet.read, score: scoreSheet(rubric, { read: sheet.read, override: {}, grade }) };
  });

  // 4. compare
  const done = sheets.filter((s): s is NonNullable<typeof s> => Boolean(s));
  const lines: string[] = [`# El yazısı sınav testi — ${readerModel()} · puanlama tarzı: ${style}`, '',
    `Öğrenci: ${done.length}/${students.length} · okunamayan sayfa: ${readFails} · puanlanamayan kâğıt: ${gradeFails}`, ''];

  // reading: the MCQ letters have an exact ground truth
  let mcqTotal = 0, mcqRight = 0, mcqMissing = 0;
  const mcqWrong: string[] = [];
  for (const s of done) {
    const t = teachers.get(s.sid)!;
    for (let q = 1; q <= 20; q++) {
      const truth = t.mcq[q];
      if (!/^[A-E]$/.test(truth)) continue;
      mcqTotal++;
      const text = s.read.answers.find((a) => a.q === q)?.lines.filter((l) => !l.crossed).map((l) => l.text).join(' ') ?? '';
      const got = text.toUpperCase().match(/\b[A-E]\b/)?.[0] ?? text.trim().toUpperCase().match(/^[A-E]/)?.[0];
      if (!got) { mcqMissing++; mcqWrong.push(`s${s.sid} S${q}: boş okundu (doğrusu ${truth})`); } else if (got === truth) mcqRight++;
      else mcqWrong.push(`s${s.sid} S${q}: "${text}" okundu (doğrusu ${truth})`);
    }
  }
  const backs = done.flatMap((s) => s.reads.slice(1).map((r) => r.isBackSide));
  lines.push('## Okuma (çoktan seçmeli harfler, kesin doğru cevap var)', '',
    `Doğru okunan harf: **${mcqRight}/${mcqTotal} (%${((mcqRight / mcqTotal) * 100).toFixed(1)})** · okunamayan/boş: ${mcqMissing} · yanlış okunan: ${mcqTotal - mcqRight - mcqMissing}`,
    `Devam sayfalarını "arka yüz" olarak tanıma: ${backs.filter(Boolean).length}/${backs.length}`, '');

  // grading: points per short answer against the teacher
  type Pair = { sid: number; q: number; teacher: number; system: number; flagged: boolean; text: string; note: string };
  const pairs: Pair[] = [];
  let bothBlank = 0;
  for (const s of done) {
    const t = teachers.get(s.sid)!;
    for (const qs of s.score.questions) {
      const teacher = t.marks[qs.q];
      if (teacher === null && (qs.status === 'blank' || qs.status === 'missing')) { bothBlank++; continue; }
      pairs.push({
        sid: s.sid, q: qs.q, teacher: teacher ?? 0, system: qs.points,
        flagged: qs.flags.some((f) => !INFO_FLAGS.has(f) && f !== 'missing'),
        text: s.read.answers.find((a) => a.q === qs.q)?.lines.filter((l) => !l.crossed).map((l) => l.text).join(' / ') ?? '',
        note: qs.grade?.note ?? '',
      });
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const corr = (a: number[], b: number[]) => {
    const ma = mean(a), mb = mean(b);
    const c = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
    const d = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0));
    return d ? c / d : 0;
  };
  const diff = pairs.map((p) => Math.abs(p.system - p.teacher));
  const over = pairs.filter((p) => !p.flagged && p.system - p.teacher >= 1);
  const under = pairs.filter((p) => !p.flagged && p.teacher - p.system >= 1);
  const totals = done.map((s) => ({
    sid: s.sid,
    teacher: SHORT.reduce((a, q) => a + (teachers.get(s.sid)!.marks[q] ?? 0), 0),
    system: s.score.total,
  }));
  lines.push('## Puanlama (15 kısa cevap, soru başı 0–2)', '',
    '| Ölçü | Değer |', '|---|---|',
    `| Karşılaştırılan cevap | ${pairs.length} (ikisinin de boş saydığı ${bothBlank} hariç) |`,
    `| Birebir aynı puan | %${((diff.filter((d) => d === 0).length / pairs.length) * 100).toFixed(0)} |`,
    `| 0,5 puan içinde | %${((diff.filter((d) => d <= 0.5).length / pairs.length) * 100).toFixed(0)} |`,
    `| Ortalama fark (soru başı, 2 üzerinden) | ${mean(diff).toFixed(2)} |`,
    `| Ortalama puan: öğretmen / sistem | ${mean(pairs.map((p) => p.teacher)).toFixed(2)} / ${mean(pairs.map((p) => p.system)).toFixed(2)} |`,
    `| Soru bazında korelasyon | ${corr(pairs.map((p) => p.system), pairs.map((p) => p.teacher)).toFixed(2)} |`,
    `| Öğrenci toplamı (30 üzerinden) ort. fark | ${mean(totals.map((t) => Math.abs(t.system - t.teacher))).toFixed(1)} |`,
    `| Öğrenci toplamı korelasyon | ${corr(totals.map((t) => t.system), totals.map((t) => t.teacher)).toFixed(2)} |`,
    `| Öğretmene işaretlenen | %${((pairs.filter((p) => p.flagged).length / pairs.length) * 100).toFixed(0)} |`,
    `| Uyarısız ≥1 puan fazla | ${over.length} |`,
    `| Uyarısız ≥1 puan eksik | ${under.length} |`, '');
  lines.push('## Soru bazında', '', '| Soru | n | Öğretmen ort. | Sistem ort. | Ort. fark |', '|---|---|---|---|---|');
  for (const q of SHORT) {
    const ps = pairs.filter((p) => p.q === q);
    if (ps.length) lines.push(`| ${q} | ${ps.length} | ${mean(ps.map((p) => p.teacher)).toFixed(2)} | ${mean(ps.map((p) => p.system)).toFixed(2)} | ${mean(ps.map((p) => Math.abs(p.system - p.teacher))).toFixed(2)} |`);
  }
  const cell = (t: string) => t.replace(/\|/g, '/').slice(0, 220);
  lines.push('', '## Uyarısız ayrışanlar (≥1 puan)', '', '| Öğrenci | Soru | Öğretmen | Sistem | Okunan cevap | Not |', '|---|---|---|---|---|---|',
    ...[...over, ...under].map((p) => `| s${p.sid} | ${p.q} | ${p.teacher} | ${p.system} | ${cell(p.text)} | ${cell(p.note)} |`));
  lines.push('', '## Yanlış okunan harfler', '', ...mcqWrong.map((w) => `- ${w}`));
  const tokens = [...pages.values()].flat().length;
  lines.push('', `Sayfa: ${tokens}`);
  const md = lines.join('\n');
  await fs.writeFile(path.join(OUT, style === 'balanced' ? 'report.md' : `report-${style}.md`), md);
  console.log(md.split('## Uyarısız ayrışanlar')[0]);
}

process.on('exit', () => { const l = spent(); if (l.calls) console.log(`Harcama (toplam): $${l.usd.toFixed(3)} · ${l.calls} çağrı`); });

main().catch((e) => { console.error(e); process.exit(1); });
