import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages, users } from '@/db/schema';
import type { Storage } from '@/lib/storage';
import type { Mailer } from '@/lib/mail';
import { refundPages } from '@/lib/credits';
import { buildReportInput } from '@/lib/report/input';
import { buildWorkbook } from '@/lib/report/excel';
import { buildSummaryPdf } from '@/lib/report/pdf';

type Deps = { db: Db; storage: Storage; mailer: Mailer };
const RETRY_MS = 5 * 60 * 1000;
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
    reservedPages: jobs.reservedPages, roster: jobs.roster,
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
        await mailer.send({
          to: user.email,
          subject: `${job.title || 'Sınav'}: cevap anahtarı okunamadı`,
          text: 'Cevap anahtarınızın fotoğrafı okunamadığı için kâğıtlar puanlanamadı. '
            + `Kullanılan ${job.reservedPages} sayfa hakkı hesabınıza iade edildi. Anahtarı daha net çekip sınavı yeniden oluşturabilirsiniz.`,
        });
        await refundPages(db, job.userId, job.reservedPages, job.id);
      } else {
        const input = await buildReportInput(db, job.id);
        const [xlsx, pdf] = await Promise.all([buildWorkbook(input), buildSummaryPdf(input)]);
        const refund = input.failed.length;
        await mailer.send({
          to: user.email,
          subject: `${job.title || 'Sınav'} sonuçları`,
          text: `${input.rows.length} kâğıt puanlandı. Sınıf ortalaması: ${input.stats.average.toLocaleString('tr-TR')}.`
            + (input.needsReview ? '\nBazı yerler net okunamadı; Excel dosyasındaki "Kontrol Edilecekler" sayfasına bakın.' : '')
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
