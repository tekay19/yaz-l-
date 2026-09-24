import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { testDb } from './helpers/db';
import { healthy } from '@/lib/health';

describe('health', () => {
  it('is healthy when the DB answers and the upload dir is writable', async () => {
    const db = await testDb();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'so-health-'));
    expect(await healthy(() => db, dir)).toBe(true);
    expect(await fs.readdir(dir)).toEqual([]); // the probe file is cleaned up
  });

  it('is unhealthy when the DB is unreachable', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'so-health-'));
    expect(await healthy(() => { throw new Error('DATABASE_URL is not set'); }, dir)).toBe(false);
  });

  // Düzeltme.md D7: a missing or read-only upload volume raises nowhere else —
  // every upload would fail while a DB-only check stayed green.
  it('is unhealthy when the upload dir cannot be written', async () => {
    const db = await testDb();
    const missing = path.join(os.tmpdir(), 'so-health-missing', 'no', 'such', 'dir');
    expect(await healthy(() => db, missing)).toBe(false);
  });
});
