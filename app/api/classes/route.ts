import { createClass, listClasses } from '@/lib/account';
import { noStore, readJson, withUser } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = () => withUser(async (db, userId) => Response.json(await listClasses(db, userId), noStore));

export const POST = (req: Request) =>
  withUser(async (db, userId) => Response.json(await createClass(db, userId, await readJson(req)), { status: 201 }));
