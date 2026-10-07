import { requestPasswordReset } from '@/lib/auth/accounts';
import { listActions, withAdmin } from '@/lib/admin/guard';
import { adjustPages, markVerified, noteResetSent, setRole, setSuspended, userDetail } from '@/lib/admin/users';
import { HttpError, json, readJson } from '@/lib/http';
import { isUuid } from '@/lib/uuid';
import { getMailer } from '@/lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = (req: Request, { params }: Ctx) => withAdmin(req, async (db) => {
  const { id } = await params;
  const detail = isUuid(id) ? await userDetail(db, id) : null;
  if (!detail) return json({ error: 'Öğretmen bulunamadı.' }, 404);
  const actions = await listActions(db, { offset: 0, size: 30, targetId: id });
  return json({ ...detail, actions: actions.rows });
});

// One endpoint for the actions on a teacher, chosen by `action`.
export const POST = (req: Request, { params }: Ctx) => withAdmin(req, async (db, admin) => {
  const { id } = await params;
  if (!isUuid(id)) return json({ error: 'Öğretmen bulunamadı.' }, 404);
  const body = await readJson(req);
  switch (body.action) {
    case 'pages': {
      const balance = await adjustPages(db, admin, id, Number(body.delta), typeof body.note === 'string' ? body.note : '');
      return json({ ok: true, balance });
    }
    case 'suspend':
    case 'unsuspend':
      await setSuspended(db, admin, id, body.action === 'suspend');
      return json({ ok: true });
    case 'role':
      await setRole(db, admin, id, body.role);
      return json({ ok: true });
    case 'verify':
      await markVerified(db, admin, id);
      return json({ ok: true });
    case 'reset': {
      const email = await noteResetSent(db, admin, id);
      await requestPasswordReset(db, getMailer(), email, process.env.APP_URL!);
      return json({ ok: true });
    }
    default:
      throw new HttpError(400, 'Bilinmeyen işlem.');
  }
});
