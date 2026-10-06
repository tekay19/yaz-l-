import { paging, withAdmin } from '@/lib/admin/guard';
import { PAYMENT_FILTERS, listPayments, type PaymentFilter } from '@/lib/admin/payments';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withAdmin(req, async (db) => {
  const url = new URL(req.url);
  const { page, size, offset } = paging(url);
  const asked = url.searchParams.get('filtre') as PaymentFilter;
  const filter = PAYMENT_FILTERS.includes(asked) ? asked : 'all';
  const r = await listPayments(db, { q: url.searchParams.get('q') ?? '', filter, offset, size });
  return json({ ...r, page, size });
});
