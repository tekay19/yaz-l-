import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/auth/callback/route';
import { fromOwnOrigin } from '@/lib/auth/origin';

const APP = 'https://sinavoku.test';
const req = (headers: Record<string, string>) =>
  new Request(`${APP}/api/auth/callback`, { method: 'POST', headers });

// Login CSRF: a page on another site can auto-submit a form that posts the
// attacker's own token here. The victim would end up signed in to the
// attacker's account, and the student photos they upload next — names and
// grades of minors — would land where the attacker can read them.
describe('login callback', () => {
  it('refuses a token posted from another site, before spending it', async () => {
    process.env.APP_URL = APP;
    const body = new FormData();
    body.set('token', 'x'.repeat(43));
    const res = await POST(new Request(`${APP}/api/auth/callback`, {
      method: 'POST', body, headers: { origin: 'https://evil.example' },
    }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`${APP}/giris?hata=baglanti`);
  });
});

describe('fromOwnOrigin', () => {
  it.each([
    [{ origin: APP }, true],
    [{ origin: 'https://evil.example' }, false],
    [{ origin: 'null' }, false],
    [{ referer: `${APP}/api/auth/callback?token=x` }, true],
    [{ referer: 'https://evil.example/' }, false],
    [{ referer: 'https://sinavoku.test.evil.example/' }, false],
    [{}, false],
  ])('%o → %s', (headers, want) => {
    expect(fromOwnOrigin(req(headers), APP)).toBe(want);
  });
});
