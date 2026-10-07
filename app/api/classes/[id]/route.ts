import { deleteClass, updateClass } from '@/lib/account';
import { readJson, withUser } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = (req: Request, { params }: Ctx) => withUser(async (db, userId) => {
  const { id } = await params;
  return Response.json(await updateClass(db, userId, id, await readJson(req)));
});

export const DELETE = (_req: Request, { params }: Ctx) => withUser(async (db, userId) => {
  const { id } = await params;
  await deleteClass(db, userId, id);
  return new Response(null, { status: 204 });
});
