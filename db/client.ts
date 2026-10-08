import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Both the production driver (postgres-js) and the test driver (PGlite)
// satisfy this type, so every service takes a Db and never imports a driver.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// `next dev` compiles every route into its own copy of this module, so a
// module-level cache gives each route its own pool of 10 connections and the
// database runs out of clients. The cache lives on globalThis to share one pool.
const g = globalThis as unknown as { __sinavokuDb?: Db };

export function getDb(): Db {
  if (g.__sinavokuDb) return g.__sinavokuDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  g.__sinavokuDb = drizzle(postgres(url, { max: 10 }), { schema }) as unknown as Db;
  return g.__sinavokuDb;
}
