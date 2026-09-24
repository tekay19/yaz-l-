import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Both the production driver (postgres-js) and the test driver (PGlite)
// satisfy this type, so every service takes a Db and never imports a driver.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | null = null;

export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  cached = drizzle(postgres(url, { max: 10 }), { schema }) as unknown as Db;
  return cached;
}
