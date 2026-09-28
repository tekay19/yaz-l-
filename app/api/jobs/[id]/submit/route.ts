import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { submitJob } from '@/lib/jobs/submit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGES = {
  no_key: 'Önce cevap anahtarını yükleyin.',
  no_pages: 'En az bir öğrenci kâğıdı yükleyin.',
  no_consent: 'Devam etmek için aydınlatma metnini onaylayın.',
  no_roster: 'Sınıf listesi girmediniz. Listeyi girin ya da isimlerin yalnız fotoğraftan okunmasını onaylayın.',
  insufficient: 'Sayfa hakkınız yetmiyor.',
  not_draft: 'Bu sınav zaten gönderilmiş.',
} as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await submitJob(getDb(), id, userId, body.consent === true, body.noRoster === true);
  if (r.ok) return Response.json(r, { status: 202 });
  const status = r.error === 'insufficient' ? 402 : r.error === 'not_draft' ? 409 : 400;
  return Response.json({ ...r, message: MESSAGES[r.error] }, { status });
}
