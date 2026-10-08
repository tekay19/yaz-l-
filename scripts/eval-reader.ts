import fs from 'node:fs/promises';
import path from 'node:path';
import { createReader } from '@/lib/reader';
import { ImageError, checkPhoto, normalizeImage } from '@/lib/images';
import { addSheet, checkKey, checkStudent, emptyTotals, summarize, type Truth } from '@/lib/eval/metrics';

// Runs the accuracy gate (eval/README.md) over a folder of <name>.jpg +
// <name>.json pairs.
const dir = process.argv[2] || 'eval/data';
const prices = {
  inPerM: Number(process.env.PRICE_IN_PER_M || 0.1),  // USD per 1M input tokens (Claude Haiku 5.5, the default)
  outPerM: Number(process.env.PRICE_OUT_PER_M || 0.5), // USD per 1M output tokens
};

// No top-level await: without "type": "module" tsx runs this file as CommonJS.
async function main() {
  const reader = createReader();
  let totals = emptyTotals();
  const refused: string[] = [];

  for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const truth = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')) as Truth;
    const started = Date.now();
    const image = await normalizeImage(await fs.readFile(path.join(dir, file.replace(/\.json$/, '.jpg'))));
    // the upload screen refuses these, so they are never read in production
    try { await checkPhoto(image); } catch (e) {
      if (!(e instanceof ImageError)) throw e;
      console.log(`REFUSED ${file}: ${e.message}`);
      refused.push(file);
      continue;
    }
    const { result, usage } = truth.kind === 'key'
      ? await reader.readKey(image).then(({ read, usage }) => ({ result: checkKey(truth, read), usage }))
      : await reader.readStudent(image, truth.questionCount).then(({ read, usage }) => ({ result: checkStudent(truth, read), usage }));
    for (const m of result.mistakes) console.log(`${truth.kind === 'key' ? 'KEY ' : ''}${file} q${m.q}: want ${m.want} got ${m.got}`);
    totals = addSheet(totals, result, usage, Date.now() - started);
  }

  const s = summarize(totals, prices);
  const fixed = (v: number | null, digits: number, unit = '') => (v === null ? 'n/a' : v.toFixed(digits) + unit);
  console.log({
    pagesRead: totals.pages,
    refusedAtUpload: refused.length,
    questions: totals.questions,
    silentWrongRate: fixed(s.silentWrongRate, 2, '%'),
    flaggedRate: fixed(s.flaggedRate, 2, '%'),
    nameAccuracy: fixed(s.nameAccuracy, 1, '%'),
    usdPerPage: fixed(s.usdPerPage, 4),
    // pages are read one by one here; the worker runs WORKER_CONCURRENCY in parallel
    secondsPerPage: fixed(s.secondsPerPage, 1),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
