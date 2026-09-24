import { describe, expect, it } from 'vitest';
import { testDb } from './helpers/db';
import { pushEvents, readEvents, clearEvents, type TrackEvent } from '@/lib/store';

const ev = (event: string, ts: string): TrackEvent => ({
  ts, event, page: 'index', label: '', value: null, visitor: 'v', session: 's',
  ref: '', utm: '', vw: 390, ua: 'test',
});

describe('store', () => {
  it('returns events newest first and clears them', async () => {
    const db = await testDb();
    await pushEvents([ev('page_view', '2026-09-01T10:00:00Z'), ev('cta_click', '2026-09-02T10:00:00Z')], db);
    const out = await readEvents(10, db);
    expect(out.map((e) => e.event)).toEqual(['cta_click', 'page_view']);
    expect(out[0].ts).toBe('2026-09-02T10:00:00.000Z');
    await clearEvents(db);
    expect(await readEvents(10, db)).toHaveLength(0);
  });
});
