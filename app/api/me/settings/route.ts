import { getDb } from '@/db/client';
import { getSettings, saveSettings } from '@/lib/account';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { HttpError, noStore, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return Response.json(await getSettings(getDb(), userId), noStore);
}

export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    return Response.json(await saveSettings(getDb(), userId, await readJson(req)));
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
