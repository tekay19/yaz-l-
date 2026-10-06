import { getDb } from '@/db/client';
import { deleteClass, updateClass } from '@/lib/account';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { HttpError, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function owned(run: (userId: string) => Promise<Response>) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    return await run(userId);
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  return owned(async (userId) => Response.json(await updateClass(getDb(), userId, id, await readJson(req))));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return owned(async (userId) => {
    await deleteClass(getDb(), userId, id);
    return new Response(null, { status: 204 });
  });
}
