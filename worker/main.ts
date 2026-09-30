import { getDb } from '@/db/client';
import { getStorage } from '@/lib/storage';
import { createReader } from '@/lib/reader';
import { claimPages, sweepExhausted } from '@/lib/queue';
import { maybeCompleteJob } from '@/lib/jobs/progress';
import { getMailer } from '@/lib/mail';
import { autoDeliverStale, deliverPending, notifyReview } from '@/lib/jobs/deliver';
import { runRetention } from '@/lib/retention';
import { completeKlasikJobs, draftPendingRubrics, expireRubrics, gradePending } from '@/lib/klasik/worker';
import { notifyRubric, remindKlasikReview } from '@/lib/klasik/notify';
import { processPage, type WorkerDeps } from './process';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 4);
const IDLE_MS = 1000;

let stopping = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => { stopping = true; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const deps: WorkerDeps = { db: getDb(), storage: getStorage(), reader: createReader() };
const mailer = getMailer();
console.log('[worker] started', { concurrency: CONCURRENCY });

let lastRetention = 0;
while (!stopping) {
  try {
    if (Date.now() - lastRetention > 3_600_000) {
      lastRetention = Date.now();
      console.log('[worker] retention', await runRetention(deps.db, deps.storage));
    }
    for (const jobId of await sweepExhausted(deps.db)) await maybeCompleteJob(deps.db, jobId);
    await autoDeliverStale(deps.db);
    await notifyReview({ db: deps.db, storage: deps.storage, mailer });
    // klasik: rubric drafts, the teacher's deadline, grading against the approved rubric
    await draftPendingRubrics(deps);
    await notifyRubric({ db: deps.db, mailer });
    await expireRubrics(deps.db);
    await gradePending(deps, CONCURRENCY);
    await completeKlasikJobs(deps.db);
    await remindKlasikReview({ db: deps.db, mailer });
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
