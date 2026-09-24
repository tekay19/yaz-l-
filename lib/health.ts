import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { Db } from '@/db/client';

// Checks the two things that otherwise fail silently: the DB is reachable,
// and the upload volume is actually writable — a full or misconfigured
// volume raises nowhere else on its own (Düzeltme.md D7). The DB comes in as
// a getter so a missing DATABASE_URL counts as unhealthy, not as a crash.
export async function healthy(db: () => Db, uploadDir: string): Promise<boolean> {
  try {
    await db().execute(sql`select 1`);
    const probe = path.join(uploadDir, '.health');
    await fs.writeFile(probe, String(Date.now()));
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}
