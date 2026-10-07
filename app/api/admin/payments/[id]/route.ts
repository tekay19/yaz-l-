import { withAdmin } from '@/lib/admin/guard';
import { reconcileOne } from '@/lib/admin/payments';
import { HttpError, json, readJson } from '@/lib/http';
import { isUuid } from '@/lib/uuid';
import { getIyzico } from '@/lib/payments/iyzico';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const POST = (req: Request, { params }: Ctx) => withAdmin(req, async (db, admin) => {
  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'Ödeme bulunamadı.' }, 404);
  const body = await readJson(req);
  if (body.action !== 'reconcile') throw new HttpError(400, 'Bilinmeyen işlem.');
  const result = await reconcileOne(db, getIyzico(), admin, id);
  return json({ ok: true, result });
});
