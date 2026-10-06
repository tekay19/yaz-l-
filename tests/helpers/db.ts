import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import type { Db } from '@/db/client';

// A fresh in-process Postgres with every migration applied. Each test gets
// its own, so tests never share rows.
export async function testDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return db as unknown as Db;
}

export async function makeUser(db: Db, email = 'ogretmen@okul.k12.tr', pageBalance = 0, extra: Partial<typeof schema.users.$inferInsert> = {}) {
  const [u] = await db.insert(schema.users).values({ email, pageBalance, emailVerifiedAt: new Date(), ...extra }).returning();
  return u;
}
