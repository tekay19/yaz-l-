import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { currentUserId, unauthorized } from '@/lib/auth/current';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const [u] = await getDb().select({ email: users.email, pageBalance: users.pageBalance })
    .from(users).where(eq(users.id, userId));
  if (!u) return unauthorized();
  return Response.json(u, { headers: { 'Cache-Control': 'no-store' } });
}
