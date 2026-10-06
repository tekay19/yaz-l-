import fs from 'node:fs/promises';
import path from 'node:path';
import type { Reader } from '@/lib/reader/types';
import { createReader } from '@/lib/reader';
import { spent, withBudget } from './budget';
import { GRADE_SYSTEM, RUBRIC_SYSTEM, gradeUser, rubricUser } from '@/lib/reader/klasik-prompts';
import { GradeOutputSchema, RubricDraftSchema, type GradeOutput, type RubricDraft } from '@/lib/reader/schemas';
import { normalizeDraft } from '@/lib/klasik/rubric';
import { toGrade, failedGrade } from '@/lib/klasik/grade';
import { INFO_FLAGS, scoreQuestion } from '@/lib/klasik/score';
import type { KlasikAnswer, RubricQuestion } from '@/lib/types';

// Klasik grading on public, human-graded foreign short-answer sets (both CC BY 4.0):
//   Mohler (Texas, CS answers, two graders 0-5)      huggingface.co/datasets/nkazi/MohlerASAG
//   SciEntsBank (SemEval-2013, school science, labels) huggingface.co/datasets/nkazi/SciEntsBank
// The product's own path: the reference answer is the teacher's key, a rubric
// is drafted from it (and approved as is), each answer is graded against it
// and the product's code computes the points. Human scores are only read by
// `score`, never written next to the prompts.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-external.ts fetch        sample the sets
//   ... rubric-prompts | grade-prompts                                     write the exact calls (replay mode)
//   ... live                                                               make the calls with the real API (costs money)
//   ... score                                                              compare with the human graders
//
// Replay mode: answers to the written prompts go to out/rubric.json and
// out/grade-<n>.json, keyed by id, in the reader's output schemas. Files live
// in eval/data/external (git-ignored).

const DIR = 'eval/data/external';
// another folder for the model's answers, e.g. EXT_OUT=out-b for a repeat run
const OUT = process.env.EXT_OUT || 'out';
const SEED = 20261005;
const MOHLER_QUESTIONS = 12, MOHLER_PER_Q = 8, SEB_QUESTIONS = 15, SEB_PER_Q = 4, BATCH = 40;
const MAX = 10;
const SEB_LABELS = ['correct', 'contradictory', 'partially_correct_incomplete', 'irrelevant', 'non_domain'] as const;

type Human = { score: number; g1?: number; g2?: number; label?: (typeof SEB_LABELS)[number] };
type Case = { id: string; set: 'mohler' | 'scientsbank'; qid: string; question: string; reference: string; answer: string; human: Human };

const rnd = (() => { let a = SEED; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clean = (s: string) => s.replace(/<STOP>/g, '\n').replace(/[ \t]+/g, ' ').trim();
const read = async <T,>(f: string): Promise<T> => JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));
const write = async (f: string, v: unknown) => {
  await fs.mkdir(path.dirname(path.join(DIR, f)), { recursive: true });
  await fs.writeFile(path.join(DIR, f), JSON.stringify(v, null, 2));
};

async function rows(dataset: string, config: string, split: string): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${dataset}&config=${config}&split=${split}&offset=${offset}&length=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const body = await res.json();
    out.push(...body.rows.map((r: any) => r.row));
    if (out.length >= body.num_rows_total) return out;
  }
}

async function fetchSets() {
  const cases: Case[] = [];
  const mohler = await rows('nkazi/MohlerASAG', 'cleaned', 'open_ended');
  await write('raw/mohler.json', mohler);
  // most assignments are graded 0-5, a few 0-10: bring each to 10
  const top = new Map<string, number>();
  for (const r of mohler) { const a = r.id.split('.')[0]; top.set(a, Math.max(top.get(a) ?? 0, r.score_grader_1, r.score_grader_2)); }
  const to10 = (r: any, v: number) => (v * MAX) / (top.get(r.id.split('.')[0]) ?? 5);
  const byQ = new Map<string, any[]>();
  for (const r of mohler) { const q = r.id.split('.').slice(0, 2).join('.'); byQ.set(q, [...(byQ.get(q) ?? []), r]); }
  for (const q of shuffle([...byQ.keys()]).slice(0, MOHLER_QUESTIONS)) {
    // spread over the score range: the set leans heavily towards full marks
    const sorted = [...byQ.get(q)!].sort((a, b) => a.score_grader_1 + a.score_grader_2 - b.score_grader_1 - b.score_grader_2);
    const picks = new Set([0, 0.08, 0.18, 0.3, 0.45, 0.6, 0.8, 1].map((f) => Math.round(f * (sorted.length - 1))));
    for (const i of [...picks].slice(0, MOHLER_PER_Q)) {
      const r = sorted[i];
      cases.push({ id: `m-${r.id}`, set: 'mohler', qid: `m-${q}`, question: clean(r.question), reference: clean(r.instructor_answer), answer: clean(r.student_answer),
        // the set's own score_avg is already on 0-5 for the 0-10 assignments: average the graders here
        human: { score: (to10(r, r.score_grader_1) + to10(r, r.score_grader_2)) / 2, g1: to10(r, r.score_grader_1), g2: to10(r, r.score_grader_2) } });
    }
  }
  const seb = await rows('nkazi/SciEntsBank', 'default', 'test_ua');
  await write('raw/scientsbank-test_ua.json', seb);
  const sebQ = new Map<string, any[]>();
  for (const r of seb) sebQ.set(r.question, [...(sebQ.get(r.question) ?? []), r]);
  shuffle([...sebQ.keys()]).slice(0, SEB_QUESTIONS).forEach((question, n) => {
    const answers = shuffle(sebQ.get(question)!);
    // one answer of each label first, then the rest
    const firsts = SEB_LABELS.map((_, l) => answers.find((r) => r.label === l)).filter(Boolean);
    const picked = [...new Set([...firsts, ...answers])].slice(0, SEB_PER_Q);
    for (const r of picked) {
      const label = SEB_LABELS[r.label];
      cases.push({ id: `s-${r.id}`, set: 'scientsbank', qid: `s-q${n + 1}`, question: clean(question), reference: clean(r.reference_answer), answer: clean(r.student_answer),
        human: { score: label === 'correct' ? 10 : label === 'partially_correct_incomplete' ? 5 : 0, label } });
    }
  });
  await write('sample.json', cases);
  console.log(`${cases.length} cevap: ${cases.filter((c) => c.set === 'mohler').length} Mohler, ${cases.filter((c) => c.set === 'scientsbank').length} SciEntsBank`);
}

// The key a teacher would type: the question and its expected answer.
const keyText = (c: Pick<Case, 'question' | 'reference'>) => `1. soru:\nSoru: ${c.question}\nCevap: ${c.reference}`;
const answerOf = (c: Case): KlasikAnswer => ({
  q: 1, lines: c.answer.split('\n').map((t) => t.trim()).filter(Boolean).map((text) => ({ text, crossed: false })), unclear: false, hasFigure: false,
});
const questions = (cases: Case[]) => [...new Map(cases.map((c) => [c.qid, c])).values()];

function rubricOf(draft: RubricDraft): RubricQuestion {
  const r = normalizeDraft(draft, [MAX]);
  const q = r.questions.find((x) => x.q === 1) ?? r.questions[0];
  if (!q) throw new Error('rubric draft has no question');
  return { ...q, q: 1 };
}

// A reader that answers from files written for the exported prompts: the
// same calls, made by whoever wrote the files.
async function replayReader(cases: Case[]): Promise<Reader> {
  const drafts = await read<Record<string, RubricDraft>>(`${OUT}/rubric.json`);
  const byKey = new Map(questions(cases).map((c) => [keyText(c), c.qid]));
  const grades: Record<string, GradeOutput> = {};
  for (const f of await fs.readdir(path.join(DIR, OUT)).catch(() => [] as string[])) {
    if (/^grade-\d+\.json$/.test(f)) Object.assign(grades, await read(`${OUT}/${f}`));
  }
  const byUser = new Map<string, string>();
  for (const c of cases) {
    const d = drafts[c.qid];
    if (d) byUser.set(gradeUser([rubricOf(RubricDraftSchema.parse(d))], [answerOf(c)], false), c.id);
  }
  const unused = async () => { throw new Error('not used'); };
  return {
    readKey: unused, readStudent: unused, readKlasik: unused,
    draftRubric: async ({ keyText: k }) => {
      const qid = byKey.get(k);
      if (!qid || !drafts[qid]) throw new Error(`no rubric answer for ${qid}`);
      return { read: RubricDraftSchema.parse(drafts[qid]), usage: { inputTokens: 0, outputTokens: 0 } };
    },
    gradeKlasik: async ({ questions: qs, answers }) => {
      const id = byUser.get(gradeUser(qs, answers, false));
      if (!id || !grades[id]) throw new Error(`no grade answer for ${id}`);
      // answers cached before slipOnly existed read as false
      const out = { questions: (grades[id] as any).questions.map((q: any) => ({ ...q, criteria: q.criteria.map((c: any) => ({ slipOnly: false, ...c })) })) };
      return { read: GradeOutputSchema.parse(out), usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

type Result = { id: string; set: Case['set']; qid: string; human: Human; points: number; flags: string[]; flagged: boolean; note: string; verdicts: string; tokens: number };

// run fn over items, at most `n` at a time, keeping the input order
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }));
  return out;
}
const CONCURRENCY = Number(process.env.EXT_CONCURRENCY || 6);

// EXT_RETRY_FAILED=1: keep the last live run, re-grade only what failed
// (rate limits), with the rubrics that run drafted.
async function grade(reader: Reader, cases: Case[]): Promise<Result[]> {
  const retry = process.env.EXT_RETRY_FAILED === '1';
  const rubrics = new Map<string, RubricQuestion>();
  const drafts: Record<string, RubricDraft> = retry ? await read(`${OUT}/rubric-used.json`) : {};
  await pool(questions(cases), CONCURRENCY, async (c) => {
    if (!drafts[c.qid]) drafts[c.qid] = (await reader.draftRubric({ keyText: keyText(c), maxPoints: [MAX] })).read;
    rubrics.set(c.qid, rubricOf(drafts[c.qid]));
  });
  const previous = retry ? new Map((await read<Result[]>(`${OUT}/results-live.json`)).map((r) => [r.id, r])) : new Map<string, Result>();
  await write(`${OUT}/rubric-used.json`, drafts);
  await write(`${OUT}/rubrics-normalized.json`, Object.fromEntries(rubrics));
  let done = 0;
  return pool(cases, CONCURRENCY, async (c): Promise<Result> => {
    const kept = previous.get(c.id);
    if (kept && !kept.flags.includes('grading_failed')) return kept;
    const rq = rubrics.get(c.qid)!;
    const answer = answerOf(c);
    let g, tokens = 0;
    try {
      const out = await reader.gradeKlasik({ questions: [rq], answers: [answer], images: [] });
      tokens = out.usage.inputTokens + out.usage.outputTokens;
      const o = out.read.questions.find((x) => x.q === 1);
      g = o ? toGrade(rq, o, false) : failedGrade(rq);
    } catch (e) {
      console.error(c.id, e instanceof Error ? e.message : e);
      g = failedGrade(rq);
    }
    const s = scoreQuestion(rq, answer, g);
    if (++done % 20 === 0) console.error(`… ${done}/${cases.length}`);
    return {
      id: c.id, set: c.set, qid: c.qid, human: c.human, points: s.points, flags: s.flags,
      flagged: s.flags.some((f) => !INFO_FLAGS.has(f)), note: g.note,
      verdicts: s.criteria.map((x) => `${x.id}:${x.verdict ?? '-'}${x.counted ? '' : '*'}`).join(' '), tokens,
    };
  });
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
function pearson(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const va = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0)), vb = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0));
  return va && vb ? cov / (va * vb) : 0;
}
const cls = (p: number) => (p >= 8 ? 'doğru' : p <= 2 ? 'yanlış' : 'kısmi');
const sebCls = (l: Human['label']) => (l === 'correct' ? 'doğru' : l === 'partially_correct_incomplete' ? 'kısmi' : 'yanlış');

function report(results: Result[], cases: Case[]) {
  const lines: string[] = ['# Yabancı veri setlerinde klasik puanlama ölçümü', ''];
  const m = results.filter((r) => r.set === 'mohler');
  if (m.length) {
    const dev = m.map((r) => Math.abs(r.points - r.human.score));
    const hh = m.map((r) => Math.abs(r.human.g1! - r.human.g2!));
    const silentOver = m.filter((r) => !r.flagged && r.points - r.human.score > 2);
    const silentUnder = m.filter((r) => !r.flagged && r.human.score - r.points > 2);
    lines.push('## Mohler (üniversite, bilgisayar bilimi; 10 üzerinden)', '',
      '| Ölçü | Sistem ↔ öğretmen ort. | Öğretmen 1 ↔ öğretmen 2 |', '|---|---|---|',
      `| Ortalama fark (puan) | ${round(mean(dev))} | ${round(mean(hh))} |`,
      `| 1 puan içinde | %${round((dev.filter((d) => d <= 1).length / m.length) * 100, 0)} | %${round((hh.filter((d) => d <= 1).length / m.length) * 100, 0)} |`,
      `| 2 puan içinde | %${round((dev.filter((d) => d <= 2).length / m.length) * 100, 0)} | %${round((hh.filter((d) => d <= 2).length / m.length) * 100, 0)} |`,
      `| Korelasyon | ${round(pearson(m.map((r) => r.points), m.map((r) => r.human.score)), 2)} | ${round(pearson(m.map((r) => r.human.g1!), m.map((r) => r.human.g2!)), 2)} |`,
      '', `Cevap: ${m.length} · işaretlenen: %${round((m.filter((r) => r.flagged).length / m.length) * 100, 0)} · `
        + `sessiz fazla (>2 puan, işaretsiz): ${silentOver.length} · sessiz eksik: ${silentUnder.length}`, '');
  }
  const s = results.filter((r) => r.set === 'scientsbank');
  if (s.length) {
    const ok = s.filter((r) => cls(r.points) === sebCls(r.human.label));
    const classes = ['doğru', 'kısmi', 'yanlış'];
    lines.push('## SciEntsBank (ortaokul fen; etiketli)', '',
      `3 sınıf uyumu (doğru ≥ 8, yanlış ≤ 2, arası kısmi): **%${round((ok.length / s.length) * 100, 0)}** (${ok.length}/${s.length})`, '',
      '| İnsan ↓ / Sistem → | doğru | kısmi | yanlış |', '|---|---|---|---|',
      ...classes.map((h) => `| ${h} | ${classes.map((c) => s.filter((r) => sebCls(r.human.label) === h && cls(r.points) === c).length).join(' | ')} |`),
      '', `Sessiz hata — insan "yanlış" derken sistem ≥ 5 ve işaretsiz: ${s.filter((r) => sebCls(r.human.label) === 'yanlış' && r.points >= 5 && !r.flagged).length}; `
        + `insan "doğru" derken sistem < 5 ve işaretsiz: ${s.filter((r) => r.human.label === 'correct' && r.points < 5 && !r.flagged).length}`, '');
  }
  const byId = new Map(cases.map((c) => [c.id, c]));
  const far = results.filter((r) => Math.abs(r.points - r.human.score) > 2).sort((a, b) => Math.abs(b.points - b.human.score) - Math.abs(a.points - a.human.score));
  lines.push('## 2 puandan fazla ayrışan cevaplar', '', '| id | İnsan | Sistem | İşaret | Soru / Anahtar / Cevap | Not |', '|---|---|---|---|---|---|');
  for (const r of far) {
    const c = byId.get(r.id)!;
    const human = r.set === 'mohler' ? `${r.human.score} (${r.human.g1}/${r.human.g2})` : r.human.label;
    const cell = (t: string) => t.replace(/\|/g, '/').replace(/\n/g, ' ⏎ ');
    lines.push(`| ${r.id} | ${human} | ${r.points} | ${r.flagged ? r.flags.join(', ') : '—'} | **S:** ${cell(c.question)}<br>**A:** ${cell(c.reference)}<br>**C:** ${cell(c.answer)} | ${cell(r.note)} |`);
  }
  return lines.join('\n');
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'fetch') return fetchSets();
  const cases = await read<Case[]>('sample.json');
  if (cmd === 'rubric-prompts') {
    await write('prompts/rubric.json', { system: RUBRIC_SYSTEM, schema: 'RubricDraftSchema (lib/reader/schemas.ts)',
      items: questions(cases).map((c) => ({ id: c.qid, user: rubricUser(keyText(c), [MAX]) })) });
    return console.log(`${questions(cases).length} rubrik istemi → ${DIR}/prompts/rubric.json`);
  }
  if (cmd === 'grade-prompts') {
    const drafts = await read<Record<string, RubricDraft>>(`${OUT}/rubric.json`);
    const items = cases.map((c) => ({ id: c.id, user: gradeUser([rubricOf(RubricDraftSchema.parse(drafts[c.qid]))], [answerOf(c)], false) }));
    for (let i = 0; i * BATCH < items.length; i++) {
      await write(`prompts/grade-${i + 1}.json`, { system: GRADE_SYSTEM, schema: 'GradeOutputSchema (lib/reader/schemas.ts)', items: shuffle(items.slice(i * BATCH, (i + 1) * BATCH)) });
    }
    return console.log(`${items.length} puanlama istemi, ${Math.ceil(items.length / BATCH)} dosya → ${DIR}/prompts/`);
  }
  if (cmd === 'score' || cmd === 'live') {
    const reader = cmd === 'live' ? withBudget(createReader()) : await replayReader(cases);
    const results = await grade(reader, cases);
    await write(`${OUT}/results-${cmd}.json`, results);
    const md = report(results, cases);
    await fs.writeFile(path.join(DIR, OUT, `report-${cmd}.md`), md);
    console.log(md.split('## 2 puandan')[0]);
    console.log(`Tokens: ${results.reduce((s, r) => s + r.tokens, 0)} · ayrıntılı rapor: ${DIR}/${OUT}/report-${cmd}.md`);
    return;
  }
  console.log('kullanım: fetch | rubric-prompts | grade-prompts | live | score');
}

process.on('exit', () => { const l = spent(); if (l.calls) console.log(`Harcama (toplam): $${l.usd.toFixed(3)} · ${l.calls} çağrı`); });

main().catch((e) => { console.error(e); process.exit(1); });
