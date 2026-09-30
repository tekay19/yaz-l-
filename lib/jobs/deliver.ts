import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages, users } from '@/db/schema';
import type { Storage } from '@/lib/storage';
import type { Mailer } from '@/lib/mail';
import { refundPages } from '@/lib/credits';
import { buildReportInput } from '@/lib/report/input';
import { buildWorkbook } from '@/lib/report/excel';
import { buildSummaryPdf } from '@/lib/report/pdf';
import { RUBRIC_EXPIRE_DAYS } from '@/lib/klasik/worker';

type Deps = { db: Db; storage: Storage; mailer: Mailer };
const RETRY_MS = 5 * 60 * 1000;
// A job left in review is sent as read after this long: the teacher gets the
// report (with the unsure places listed) instead of nothing, and the photos
// are deleted days before the retention backstop.
export const REVIEW_AUTO_DELIVER_DAYS = 3;
const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'sinav';

async function deletePhotos({ db, storage }: Deps, jobId: string) {
  const rows = await db.select({ id: pages.id, filePath: pages.filePath }).from(pages)
    .where(and(eq(pages.jobId, jobId), isNotNull(pages.filePath)));
  for (const r of rows) await storage.remove(r.filePath!);
  await db.update(pages).set({ filePath: null }).where(eq(pages.jobId, jobId));
}

export async function deliverPending(deps: Deps, now = new Date()): Promise<number> {
  const { db, mailer } = deps;
  const ready = (id?: string) => and(
    ...(id ? [eq(jobs.id, id)] : []),
    inArray(jobs.status, ['delivering', 'failed']),
    isNull(jobs.notifiedAt),
    or(isNull(jobs.deliveryAttemptAt), lt(jobs.deliveryAttemptAt, new Date(now.getTime() - RETRY_MS))),
  );
  const due = await db.select({
    id: jobs.id, userId: jobs.userId, status: jobs.status, title: jobs.title,
    reservedPages: jobs.reservedPages, roster: jobs.roster, autoDeliveredAt: jobs.autoDeliveredAt, failReason: jobs.failReason,
  }).from(jobs).where(ready()).limit(5);

  let handled = 0;
  for (const job of due) {
    // claim: if another worker stamped it first, the condition no longer matches
    const claimed = await db.update(jobs).set({ deliveryAttemptAt: now })
      .where(ready(job.id)).returning({ id: jobs.id });
    if (!claimed.length) continue;
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, job.userId));
    const name = safeName(job.title);
    try {
      if (job.status === 'failed') {
        const expired = job.failReason === 'rubric_expired';
        await mailer.send({
          to: user.email,
          subject: `${job.title || 'Sınav'}: ${expired ? 'sınav iptal edildi' : 'cevap anahtarı okunamadı'}`,
          text: expired
            ? `Puanlama ölçütleri ${RUBRIC_EXPIRE_DAYS} gün içinde onaylanmadığı için sınav iptal edildi. `
              + `Kullanılan ${job.reservedPages} sayfa hakkı hesabınıza iade edildi. Fotoğraflarınız silindi.`
            : 'Cevap anahtarınızın fotoğrafı okunamadığı için kâğıtlar puanlanamadı. '
              + `Kullanılan ${job.reservedPages} sayfa hakkı hesabınıza iade edildi. Anahtarı daha net çekip sınavı yeniden oluşturabilirsiniz.`,
        });
        await refundPages(db, job.userId, job.reservedPages, job.id);
      } else {
        const input = await buildReportInput(db, job.id);
        const [xlsx, pdf] = await Promise.all([buildWorkbook(input), buildSummaryPdf(input)]);
        const refund = input.failed.length;
        const klasik = input.mode === 'klasik';
        await mailer.send({
          to: user.email,
          subject: `${job.title || 'Sınav'} sonuçları`,
          text: `${input.rows.length} kâğıt puanlandı. Sınıf ortalaması: ${klasik ? '%' : ''}${input.stats.average.toLocaleString('tr-TR')}.`
            + (klasik ? '\nPuanlar, kontrol ekranında onayladığınız hâliyle rapordadır.' : '')
            + (!klasik && input.needsReview ? '\nBazı yerler net okunamadı; Excel dosyasındaki "Kontrol Edilecekler" sayfasına bakın.' : '')
            + (job.autoDeliveredAt ? `\nKontrol ekranında ${REVIEW_AUTO_DELIVER_DAYS} gün içinde onaylanmadığı için rapor, okunduğu haliyle gönderildi.` : '')
            + (refund ? `\n${refund} kâğıt okunamadı; bu sayfaların hakkı iade edildi.` : '')
            // Düzeltme.md D6: roster girilmediyse isim eşleştirme hiç çalışmadı —
            // öğretmen bunun farkında olmadan raporu güvenip kullanmasın.
            + (job.roster.length ? '' : '\nSınıf listesi girilmediği için isimler yalnızca fotoğraftaki yazıya göre okundu, listenizle çapraz kontrol edilmedi.')
            + '\n\nFotoğraflarınız sunucumuzdan silindi.',
          attachments: [
            { filename: `${name}.xlsx`, content: xlsx },
            { filename: `${name}-ozet.pdf`, content: pdf },
          ],
        });
        await refundPages(db, job.userId, refund, job.id);
      }
      await deletePhotos(deps, job.id);
      await db.update(jobs).set({
        notifiedAt: new Date(),
        ...(job.status === 'delivering' ? { status: 'done' as const } : {}),
      }).where(eq(jobs.id, job.id));
      handled++;
    } catch (e) {
      // deliveryAttemptAt stays set: the job is retried after RETRY_MS
      console.error('[deliver] failed', job.id, e instanceof Error ? e.message : e);
    }
  }
  return handled;
}

// Tells the teacher once that an exam is waiting for their check; without it
// the only sign is the status on the web page.
export async function notifyReview({ db, mailer }: Deps, now = new Date()): Promise<number> {
  const due = await db.select({ id: jobs.id, userId: jobs.userId, title: jobs.title }).from(jobs)
    .where(and(eq(jobs.status, 'review'), isNull(jobs.reviewNotifiedAt))).limit(10);
  let sent = 0;
  for (const job of due) {
    // claim first; a failed mail is not retried, the auto-delivery still follows
    const claimed = await db.update(jobs).set({ reviewNotifiedAt: now })
      .where(and(eq(jobs.id, job.id), isNull(jobs.reviewNotifiedAt))).returning({ id: jobs.id });
    if (!claimed.length) continue;
    try {
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, job.userId));
      const input = await buildReportInput(db, job.id);
      const unsure = input.rows.filter((r) => r.flags.length).length;
      const klasik = input.mode === 'klasik';
      await mailer.send({
        to: user.email,
        subject: `${job.title || 'Sınav'}: ${klasik ? 'puan önerileri hazır' : 'kontrolünüz bekleniyor'}`,
        text: `${input.rows.length} kâğıt ${klasik ? 'puanlandı' : 'okundu'}; ${unsure} kâğıtta kontrol etmeniz gereken yer var.`
          + (input.failed.length ? `\n${input.failed.length} kâğıt okunamadı; bu sayfaların hakkı iade edildi.` : '')
          + `\nKontrol edip onaylamak için: ${process.env.APP_URL}/hesap`
          + (klasik
            ? '\nPuanlar siz onaylayana kadar öneri olarak kalır; onaylamadan rapor gönderilmez.'
            : `\n${REVIEW_AUTO_DELIVER_DAYS} gün içinde onaylamazsanız rapor okunduğu haliyle e-postanıza gönderilir.`),
      });
      sent++;
    } catch (e) {
      console.error('[review-notify] failed', job.id, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}

export async function autoDeliverStale(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - REVIEW_AUTO_DELIVER_DAYS * 86_400_000);
  // klasik points are suggestions: they never go out without the teacher
  const moved = await db.update(jobs).set({ status: 'delivering', autoDeliveredAt: now })
    .where(and(eq(jobs.mode, 'optik'), eq(jobs.status, 'review'), lt(jobs.finishedAt, cutoff)))
    .returning({ id: jobs.id });
  return moved.length;
}
