import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { deleteAccount } from '@/lib/retention';
import { getStorage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const [u] = await getDb().select({ email: users.email, pageBalance: users.pageBalance, settings: users.settings })
    .from(users).where(eq(users.id, userId));
  if (!u) return unauthorized();
  return Response.json({ ...u, klasik: process.env.KLASIK_ENABLED === 'true' }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await deleteAccount(getDb(), getStorage(), userId);
  (await cookies()).delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
