import { getSettings, saveSettings } from '@/lib/account';
import { noStore, readJson, withUser } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = () => withUser(async (db, userId) => Response.json(await getSettings(db, userId), noStore));

export const PUT = (req: Request) =>
  withUser(async (db, userId) => Response.json(await saveSettings(db, userId, await readJson(req))));
