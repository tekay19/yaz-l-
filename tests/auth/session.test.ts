import { beforeAll, describe, expect, it } from 'vitest';
import { issueSession, verifySession } from '@/lib/auth/session';

beforeAll(() => { process.env.SESSION_SECRET = 'x'.repeat(40); });

describe('session', () => {
  const id = '6f1c2d3e-0000-4000-8000-000000000001';
  it('round-trips a user id', () => {
    expect(verifySession(issueSession(id))).toBe(id);
  });
  it('rejects a tampered token', () => {
    const t = issueSession(id);
    expect(verifySession(t.replace(id, '6f1c2d3e-0000-4000-8000-000000000002'))).toBeNull();
  });
  it('rejects an expired token', () => {
    const t = issueSession(id, Date.now() - 31 * 86_400_000);
    expect(verifySession(t)).toBeNull();
  });
  it('rejects everything when the secret is short', () => {
    process.env.SESSION_SECRET = 'short';
    expect(verifySession(issueSession(id))).toBeNull();
    process.env.SESSION_SECRET = 'x'.repeat(40);
  });
});
