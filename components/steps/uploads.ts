'use client';

// Shared upload plumbing for the two file-picking steps.
//
// Files go to /api/uploads, which checks the magic bytes and throws the
// bytes away — nothing is written to disk or a database. A file the server
// refuses is never added to the list, so one bad photo cannot wedge the
// wizard the way it used to.

export const ACCEPT =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';

const BATCH = 8; // /api/uploads accepts at most this many files per request

export const fileKey = (f: File) => `${f.name}:${f.size}`;

export type Validation = {
  ok: File[];
  rejected: number;
  reason: string;
  receipt: string | null;
};

export async function validate(files: File[]): Promise<Validation> {
  const ok: File[] = [];
  let rejected = 0;
  let reason = '';
  let receipt: string | null = null;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const body = new FormData();
    batch.forEach((f) => body.append('files', f));

    try {
      const res = await fetch('/api/uploads', { method: 'POST', body, cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { error?: string; receipt?: string };
      if (res.ok) {
        ok.push(...batch);
        if (json.receipt) receipt = json.receipt;
      } else {
        rejected += batch.length;
        reason = json.error || 'Görseller doğrulanamadı.';
      }
    } catch {
      rejected += batch.length;
      reason = 'Bağlantı kurulamadı. Tekrar deneyin.';
    }
  }

  return { ok, rejected, reason, receipt };
}
