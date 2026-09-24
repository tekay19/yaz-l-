import { getDb } from '@/db/client';
import { getStorage } from '@/lib/storage';
import { createClaudeReader } from '@/lib/reader/claude';
import { claimPages, sweepExhausted } from '@/lib/queue';
import { maybeCompleteJob } from '@/lib/jobs/progress';
import { getMailer } from '@/lib/mail';
import { deliverPending } from '@/lib/jobs/deliver';
import { processPage, type WorkerDeps } from './process';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 4);
const IDLE_MS = 1000;

let stopping = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => { stopping = true; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const deps: WorkerDeps = { db: getDb(), storage: getStorage(), reader: createClaudeReader() };
const mailer = getMailer();
console.log('[worker] started', { concurrency: CONCURRENCY });

while (!stopping) {
  try {
    for (const jobId of await sweepExhausted(deps.db)) await maybeCompleteJob(deps.db, jobId);
    await deliverPending({ db: deps.db, storage: deps.storage, mailer });
    const batch = await claimPages(deps.db, CONCURRENCY);
    if (batch.length) await Promise.all(batch.map((p) => processPage(deps, p)));
    else await sleep(IDLE_MS);
  } catch (e) {
    console.error('[worker] loop_error', e);
    await sleep(5000);
  }
}
console.log('[worker] stopped');
process.exit(0);
