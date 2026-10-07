import { balanceHistory } from '@/lib/account';
import { noStore, withUser } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = () => withUser(async (db, userId) => Response.json(await balanceHistory(db, userId), noStore));
