import { describe, expect, it } from 'vitest';
import { fromOwnOrigin } from '@/lib/auth/origin';

const APP = 'https://sinavoku.test';
const req = (headers: Record<string, string>) =>
  new Request(`${APP}/api/auth/login`, { method: 'POST', headers });

describe('fromOwnOrigin', () => {
  it.each([
    [{ origin: APP }, true],
    [{ origin: 'https://evil.example' }, false],
    [{ origin: 'null' }, false],
    [{ referer: `${APP}/giris` }, true],
    [{ referer: 'https://evil.example/' }, false],
    [{ referer: 'https://sinavoku.test.evil.example/' }, false],
    [{}, false],
  ])('%o → %s', (headers, want) => {
    expect(fromOwnOrigin(req(headers), APP)).toBe(want);
  });
});
