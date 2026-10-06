import fs from 'node:fs/promises';
import path from 'node:path';
import { createReader, graderModelName } from '@/lib/reader';
import { gradeDemoSheets, type DemoSheet } from '@/lib/demo/grade';
import { FLAG_TEXT, attentionFlags, scoreSheet } from '@/lib/klasik/score';
import type { KlasikLine, KlasikRead, Rubric } from '@/lib/types';
import { spent, withBudget } from './budget';

// Whole answer sheets through the product's grading path (chunked grading,
// the code's scoring), against the points each answer should get. Built for
// the MEB sets in eval/klasik/meb: a rubric file and student files with
// {students:[{id, name, answers:[{q, lines}], expected:[{q, points, tags, why}]}]}.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-sheets.ts eval/klasik/meb/mat9-rubric.json eval/klasik/meb/mat9-students-*.json
//
// Model answers are cached per grader model next to the student files.

type Line = string | KlasikLine;
type Student = {
  id: string; name: string; persona?: string;
  answers: { q: number; lines: Line[] }[];
  expected: { q: number; points: number; tags: string[]; why: string }[];
};

const asRead = (s: Student): KlasikRead => ({
  isBackSide: false, studentName: s.name, nameConfidence: 'high', unreadable: false,
  answers: s.answers.map((a) => ({
    q: a.q, lines: a.lines.map((l) => (typeof l === 'string' ? { text: l, crossed: false } : l)), unclear: false, hasFigure: false,
  })),
});

// A cached sheet keeps the model's verdicts; the points are scored again with
// the current code, so a scoring change is measured without new model calls.
function rescore(rubric: Rubric, s: Student, sheet: DemoSheet): DemoSheet {
  const grade = { questions: sheet.questions.flatMap((q) => (q.grade ? [q.grade] : [])) };
  const score = scoreSheet(rubric, { read: asRead(s), override: {}, grade });
  return {
    ...sheet, total: score.total,
    questions: sheet.questions.map((q) => {
      const n = score.questions.find((x) => x.q === q.q)!;
      return { ...q, ...n, attention: attentionFlags(n).map((f) => FLAG_TEXT[f]) };
    }),
  };
}

async function main() {
  const [rubricFile, ...studentFiles] = process.argv.slice(2);
  const rubric = JSON.parse(await fs.readFile(rubricFile, 'utf8')).rubric as Rubric;
  const students: Student[] = [];
  for (const f of studentFiles) students.push(...JSON.parse(await fs.readFile(f, 'utf8')).students);
  const reader = withBudget(createReader());
  const cacheDir = path.join(path.dirname(rubricFile), `out-${path.basename(rubricFile, '.json').replace('-rubric', '')}-${graderModelName()}`);
  await fs.mkdir(cacheDir, { recursive: true });
  console.log(`${students.length} öğrenci · ${rubric.questions.length} soru · puanlayan ${graderModelName()}`);

  const graded = new Map<string, DemoSheet>();
  const queue = [...students];
  await Promise.all(Array.from({ length: Number(process.env.SHEETS_CONCURRENCY || 3) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const file = path.join(cacheDir, `${s.id}.json`);
      try {
        graded.set(s.id, rescore(rubric, s, JSON.parse(await fs.readFile(file, 'utf8'))));
      } catch {
        try {
          const [sheet] = await gradeDemoSheets(reader, rubric, [asRead(s)]);
          await fs.writeFile(file, JSON.stringify(sheet, null, 2));
          graded.set(s.id, sheet);
        } catch (e) {
          console.error(s.id, e instanceof Error ? e.message.slice(0, 160) : e);
        }
      }
    }
  }));

  type Row = { id: string; q: number; expected: number; got: number; max: number; flagged: boolean; tags: string[]; why: string; note: string };
  const rows: Row[] = [];
  for (const s of students) {
    const sheet = graded.get(s.id);
    if (!sheet) continue;
    for (const e of s.expected) {
      const q = sheet.questions.find((x) => x.q === e.q)!;
      rows.push({ id: s.id, q: e.q, expected: e.points, got: q.points, max: q.max, flagged: q.attention.length > 0, tags: e.tags, why: e.why, note: q.grade?.note ?? '' });
    }
  }
  const tol = (r: Row) => Math.abs(r.got - r.expected) <= 0.1 * r.max;
  const over = rows.filter((r) => !r.flagged && r.got - r.expected > 0.1 * r.max);
  const under = rows.filter((r) => !r.flagged && r.expected - r.got > 0.1 * r.max);
  const totals = students.filter((s) => graded.has(s.id)).map((s) => ({
    id: s.id, expected: s.expected.reduce((a, e) => a + e.points, 0), got: graded.get(s.id)!.total,
  }));
  const pct = (n: number, d: number) => `%${((n / Math.max(1, d)) * 100).toFixed(0)}`;
  const lines = [
    `# ${path.basename(rubricFile)} — ${graderModelName()}`, '',
    `Öğrenci ${totals.length}/${students.length} · cevap ${rows.length}`, '',
    '| Ölçü | Değer |', '|---|---|',
    `| Birebir aynı puan | ${pct(rows.filter((r) => r.got === r.expected).length, rows.length)} |`,
    `| Beklenen puanla aynı (±%10) | ${rows.filter(tol).length}/${rows.length} (${pct(rows.filter(tol).length, rows.length)}) |`,
    `| Öğretmene işaretlenen | ${pct(rows.filter((r) => r.flagged).length, rows.length)} |`,
    `| Uyarısız fazla puan | ${over.length} |`,
    `| Uyarısız eksik puan | ${under.length} |`,
    `| Öğrenci toplamı ort. fark (100 üzerinden) | ${(totals.reduce((a, t) => a + Math.abs(t.got - t.expected), 0) / Math.max(1, totals.length)).toFixed(1)} |`,
    `| Öğrenci toplamı 5 puan içinde | ${pct(totals.filter((t) => Math.abs(t.got - t.expected) <= 5).length, totals.length)} |`, '',
    '## Soru bazında', '', '| Soru | doğru (±%10) | uyarısız fazla | uyarısız eksik |', '|---|---|---|---|',
    ...rubric.questions.map((rq) => {
      const rs = rows.filter((r) => r.q === rq.q);
      return `| ${rq.q} | ${rs.filter(tol).length}/${rs.length} | ${over.filter((r) => r.q === rq.q).length} | ${under.filter((r) => r.q === rq.q).length} |`;
    }),
    '', '## Senaryoya göre', '', '| Senaryo | n | doğru (±%10) |', '|---|---|---|',
    ...[...new Set(rows.flatMap((r) => r.tags))].sort().map((t) => {
      const rs = rows.filter((r) => r.tags.includes(t));
      return `| ${t} | ${rs.length} | ${rs.filter(tol).length} (${pct(rs.filter(tol).length, rs.length)}) |`;
    }),
    '', '## Ayrışan cevaplar', '', '| Cevap | Beklenen | Sistem | İşaret | Neden (beklenen) | Sistemin notu |', '|---|---|---|---|---|---|',
    ...rows.filter((r) => !tol(r)).map((r) => `| ${r.id}-q${r.q} | ${r.expected} | ${r.got} | ${r.flagged ? 'var' : '**yok**'} | ${r.why.replace(/\|/g, '/')} | ${r.note.replace(/\|/g, '/').slice(0, 160)} |`),
  ];
  const md = lines.join('\n');
  await fs.writeFile(path.join(cacheDir, 'report.md'), md);
  console.log(md.split('## Senaryoya göre')[0]);
}

process.on('exit', () => { const l = spent(); if (l.calls) console.log(`Harcama (toplam): $${l.usd.toFixed(3)} · ${l.calls} çağrı`); });
main().catch((e) => { console.error(e); process.exit(1); });
