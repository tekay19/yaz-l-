import fs from 'node:fs/promises';
import { createReader } from '@/lib/reader';
import { toGrade } from '@/lib/klasik/grade';
import { scoreQuestion } from '@/lib/klasik/score';
import { asAnswer, klasikCriteria, klasikSummary, type KlasikResult, type KlasikSet } from '@/lib/eval/klasik-metrics';

// The klasik grading gate (eval/README.md): typed transcriptions graded
// against a fixed rubric, then scored by the product's own code and compared
// with the teacher's points. Reading handwriting is measured separately, with
// real photos. Real API, real cost: run it with the product owner's approval.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-klasik.ts [eval/klasik/cases.json]

const prices = {
  inPerM: Number(process.env.PRICE_IN_PER_M || 5), // USD per 1M input tokens (Claude Opus 5)
  outPerM: Number(process.env.PRICE_OUT_PER_M || 25),
};

// No top-level await: without "type": "module" tsx runs this file as CommonJS.
async function main() {
  const file = process.argv[2] || 'eval/klasik/cases.json';
  const set = JSON.parse(await fs.readFile(file, 'utf8')) as KlasikSet;
  const reader = createReader();
  const results: KlasikResult[] = [];

  for (const c of set.cases) {
    const rq = set.rubric.questions.find((q) => q.q === c.q);
    if (!rq) throw new Error(`${c.id}: rubric has no question ${c.q}`);
    const answer = asAnswer(c);
    const started = Date.now();
    const { read, usage } = await reader.gradeKlasik({ questions: [rq], answers: [answer], images: [] });
    const out = read.questions.find((x) => x.q === rq.q);
    const s = scoreQuestion(rq, answer, out ? toGrade(rq, out, false) : undefined);
    results.push({
      id: c.id, q: c.q, tags: c.tags, teacher: c.teacher, suggested: s.points, max: s.max, flags: s.flags,
      tokensIn: usage.inputTokens, tokensOut: usage.outputTokens, ms: Date.now() - started,
    });
    const same = Math.abs(s.points - c.teacher) <= 0.1 * s.max ? '=' : '≠';
    console.log(`${same} ${c.id}: öğretmen ${c.teacher}, öneri ${s.points}/${s.max}${s.flags.length ? ` [${s.flags.join(', ')}]` : ''}`);
  }

  const summary = klasikSummary(results);
  const usd = results.reduce((s, r) => s + r.tokensIn * prices.inPerM + r.tokensOut * prices.outPerM, 0) / 1e6;
  console.log({
    ...summary,
    usdPerAnswer: results.length ? (usd / results.length).toFixed(4) : 'n/a',
    secondsPerAnswer: results.length ? (results.reduce((s, r) => s + r.ms, 0) / 1000 / results.length).toFixed(1) : 'n/a',
  });
  for (const c of klasikCriteria(summary)) {
    console.log(`${c.pass === null ? '?' : c.pass ? 'GEÇTİ' : 'KALDI'}  ${c.label}: ${c.value ?? 'yok'} (${c.limit})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
