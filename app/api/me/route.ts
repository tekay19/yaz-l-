import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { currentUser, currentUserId, signOut, unauthorized } from '@/lib/auth/current';
import { deleteAccount } from '@/lib/retention';
import { getStorage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await currentUser();
  if (!me) return unauthorized();
  const [u] = await getDb().select({ pageBalance: users.pageBalance, settings: users.settings })
    .from(users).where(eq(users.id, me.id));
  if (!u) return unauthorized();
  return Response.json({
    email: me.email, name: me.name, role: me.role, verified: me.verified, ...u,
    klasik: process.env.KLASIK_ENABLED === 'true',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await deleteAccount(getDb(), getStorage(), userId);
  await signOut();
  return new Response(null, { status: 204 });
}
