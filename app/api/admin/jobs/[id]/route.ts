import { listActions, withAdmin } from '@/lib/admin/guard';
import { closeJob, jobDetail } from '@/lib/admin/jobs';
import { HttpError, json, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export const GET = (req: Request, { params }: Ctx) => withAdmin(req, async (db) => {
  const { id } = await params;
  const detail = UUID.test(id) ? await jobDetail(db, id) : null;
  if (!detail) return json({ error: 'Sınav bulunamadı.' }, 404);
  const actions = await listActions(db, { offset: 0, size: 20, targetId: id });
  return json({ ...detail, actions: actions.rows });
});

export const POST = (req: Request, { params }: Ctx) => withAdmin(req, async (db, admin) => {
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: 'Sınav bulunamadı.' }, 404);
  const body = await readJson(req);
  if (body.action !== 'close') throw new HttpError(400, 'Bilinmeyen işlem.');
  await closeJob(db, admin, id, typeof body.note === 'string' ? body.note : '');
  return json({ ok: true });
});
