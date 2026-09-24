import { beforeAll, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/admin/eval/route';
import { COOKIE, issueToken } from '@/lib/store';

beforeAll(() => { process.env.ADMIN_SECRET = 'x'.repeat(40); });

const post = (headers: Record<string, string> = {}) =>
  POST(new Request('https://sinavoku.test/api/admin/eval', { method: 'POST', headers, body: new FormData() }));

// Every call sends a photo to the paid API: only the signed-in admin may.
describe('admin eval endpoint', () => {
  it('refuses a request without the admin session', async () => {
    expect((await post()).status).toBe(401);
  });
  it('refuses a forged admin cookie', async () => {
    expect((await post({ cookie: `${COOKIE}=9999999999.forged` })).status).toBe(401);
  });
  it('lets the admin through, then checks the input before any model call', async () => {
    const res = await post({ cookie: `other=1; ${COOKIE}=${issueToken()}` });
    expect(res.status).toBe(400); // no photo in the form
  });
});
