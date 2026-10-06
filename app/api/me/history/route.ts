import { getDb } from '@/db/client';
import { balanceHistory } from '@/lib/account';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { noStore } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return Response.json(await balanceHistory(getDb(), userId), noStore);
}
