import { withAdmin } from '@/lib/admin/guard';
import { overview } from '@/lib/admin/overview';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withAdmin(req, async (db) => json(await overview(db)));
