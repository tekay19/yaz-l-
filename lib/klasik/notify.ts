import { and, eq, isNull, lt } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, users } from '@/db/schema';
import type { Mailer } from '@/lib/mail';
import { RESULT_TTL_DAYS } from '@/lib/retention';
import { RUBRIC_EXPIRE_DAYS } from './worker';

type Deps = { db: Db; mailer: Mailer };

export const REVIEW_REMIND_DAYS = 3;

const link = () => `${process.env.APP_URL}/hesap`;

// Claims a job with a conditional update before mailing, so two workers never
// send the same mail; a failed mail is not retried (the deadline still holds).
async function once(db: Db, mailer: Mailer, jobIds: { id: string; userId: string }[], claim: (id: string) => Promise<boolean>,
  mail: (email: string, id: string) => Promise<{ subject: string; text: string }>) {
  let sent = 0;
  for (const job of jobIds) {
    if (!(await claim(job.id))) continue;
    try {
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, job.userId));
      await mailer.send({ to: user.email, ...(await mail(user.email, job.id)) });
      sent++;
    } catch (e) {
      console.error('[klasik] notify_failed', job.id, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}

// The rubric is ready: nothing is graded until the teacher approves it.
export async function notifyRubric({ db, mailer }: Deps, now = new Date()): Promise<number> {
  const due = await db.select({ id: jobs.id, userId: jobs.userId, title: jobs.title, rubric: jobs.rubric }).from(jobs)
    .where(and(eq(jobs.status, 'rubric'), isNull(jobs.rubricNotifiedAt))).limit(10);
  const byId = new Map(due.map((j) => [j.id, j]));
  return once(db, mailer, due,
    async (id) => (await db.update(jobs).set({ rubricNotifiedAt: now })
      .where(and(eq(jobs.id, id), isNull(jobs.rubricNotifiedAt))).returning({ id: jobs.id })).length > 0,
    async (_email, id) => {
      const job = byId.get(id)!;
      const empty = !job.rubric?.questions.length;
      return {
        subject: `${job.title || 'Sınav'}: puanlama ölçütlerini onaylayın`,
        text: (empty
          ? 'Cevap anahtarınız okunamadı. Anahtarı yazarak girip taslağı yeniden oluşturabilir ya da ölçütleri kendiniz ekleyebilirsiniz.'
          : 'Cevap anahtarınızdan her soru için puanlama ölçütleri (rubrik) hazırlandı. Kâğıtlar, siz onayladıktan sonra bu ölçütlere göre puanlanacak; farklı ama doğru çözümler de tam puan alır.')
          + `\nKontrol edip onaylamak için: ${link()}`
          + `\n${RUBRIC_EXPIRE_DAYS} gün içinde onaylanmazsa sınav iptal edilir ve sayfa hakkınız iade edilir.`,
      };
    });
}

// A klasik job never goes out on its own; after a few quiet days the teacher
// gets one reminder.
export async function remindKlasikReview({ db, mailer }: Deps, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - REVIEW_REMIND_DAYS * 86_400_000);
  const due = await db.select({ id: jobs.id, userId: jobs.userId, title: jobs.title }).from(jobs)
    .where(and(eq(jobs.mode, 'klasik'), eq(jobs.status, 'review'), lt(jobs.reviewNotifiedAt, cutoff), isNull(jobs.reviewRemindedAt)))
    .limit(10);
  const byId = new Map(due.map((j) => [j.id, j]));
  return once(db, mailer, due,
    async (id) => (await db.update(jobs).set({ reviewRemindedAt: now })
      .where(and(eq(jobs.id, id), isNull(jobs.reviewRemindedAt))).returning({ id: jobs.id })).length > 0,
    async (_email, id) => ({
      subject: `${byId.get(id)!.title || 'Sınav'}: puan önerileri onayınızı bekliyor`,
      text: 'Hatırlatma: klasik sınavınızın puan önerileri hazır. Siz onaylamadan puanlar kesinleşmez ve rapor gönderilmez.'
        + `\nKontrol edip onaylamak için: ${link()}`
        + `\nOnaylanmayan sınav, gönderilmesinden ${RESULT_TTL_DAYS} gün sonra kapatılır ve silinir.`,
    }));
}
