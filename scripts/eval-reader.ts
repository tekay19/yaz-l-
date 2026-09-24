import fs from 'node:fs/promises';
import path from 'node:path';
import { createClaudeReader } from '@/lib/reader/claude';
import { normalizeImage } from '@/lib/images';

// Measures what matters for grading: a WRONG read that is NOT flagged low
// confidence is the dangerous error. Flagged reads cost teacher time, not trust.
const dir = process.argv[2] || 'eval/data';
const PRICE_IN = Number(process.env.PRICE_IN_PER_M || 5);   // USD per 1M input tokens
const PRICE_OUT = Number(process.env.PRICE_OUT_PER_M || 25); // USD per 1M output tokens

// No top-level await: without "type": "module" tsx runs this file as CommonJS.
async function main() {
  const reader = createClaudeReader();
  let questions = 0, silentWrong = 0, flagged = 0, names = 0, nameOk = 0, pagesRead = 0;
  let tokensIn = 0, tokensOut = 0;
  const started = Date.now();

  for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const truth = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    const image = await normalizeImage(await fs.readFile(path.join(dir, file.replace(/\.json$/, '.jpg'))));
    if (truth.kind === 'key') {
      const { read, usage } = await reader.readKey(image);
      tokensIn += usage.inputTokens; tokensOut += usage.outputTokens; pagesRead++;
      for (const t of truth.answers) {
        questions++;
        const got = read.answers.find((a) => a.q === t.q)?.option ?? null;
        if (got !== t.option) { silentWrong++; console.log(`KEY ${file} q${t.q}: want ${t.option} got ${got}`); }
      }
      continue;
    }
    const { read, usage } = await reader.readStudent(image, truth.questionCount);
    tokensIn += usage.inputTokens; tokensOut += usage.outputTokens; pagesRead++;
    names++;
    if (read.studentName?.trim().toLocaleLowerCase('tr') === truth.studentName.toLocaleLowerCase('tr')) nameOk++;
    for (const t of truth.answers) {
      questions++;
      const got = read.answers.find((a) => a.q === t.q);
      const same = got && [...got.marked].sort().join() === [...t.marked].sort().join();
      if (got?.confidence === 'low') { flagged++; continue; }
      if (!same) { silentWrong++; console.log(`${file} q${t.q}: want [${t.marked}] got [${got?.marked ?? '-'}]`); }
    }
  }

  const usd = (tokensIn * PRICE_IN + tokensOut * PRICE_OUT) / 1e6;
  console.log({
    pagesRead, questions,
    silentWrongRate: (silentWrong / questions * 100).toFixed(2) + '%',
    flaggedRate: (flagged / questions * 100).toFixed(2) + '%',
    nameAccuracy: names ? (nameOk / names * 100).toFixed(1) + '%' : 'n/a',
    usdPerPage: (usd / pagesRead).toFixed(4),
    // pages are read one by one here; the worker runs WORKER_CONCURRENCY in parallel
    secondsPerPage: ((Date.now() - started) / 1000 / pagesRead).toFixed(1),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
