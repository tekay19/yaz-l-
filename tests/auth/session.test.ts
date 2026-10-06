import { beforeAll, describe, expect, it } from 'vitest';
import { issueSession, verifySession } from '@/lib/auth/session';

beforeAll(() => { process.env.SESSION_SECRET = 'x'.repeat(40); });

describe('session', () => {
  const id = '6f1c2d3e-0000-4000-8000-000000000001';
  it('round-trips a user id and its session version', () => {
    expect(verifySession(issueSession(id, 3))).toEqual({ userId: id, version: 3 });
  });
  it('rejects a tampered token', () => {
    const t = issueSession(id, 0);
    expect(verifySession(t.replace(id, '6f1c2d3e-0000-4000-8000-000000000002'))).toBeNull();
    expect(verifySession(t.replace(`${id}.0.`, `${id}.1.`))).toBeNull();
  });
  it('rejects an expired token', () => {
    const t = issueSession(id, 0, Date.now() - 31 * 86_400_000);
    expect(verifySession(t)).toBeNull();
  });
  it('rejects the old three-part cookie format', () => {
    const [u, , exp, mac] = issueSession(id, 0).split('.');
    expect(verifySession(`${u}.${exp}.${mac}`)).toBeNull();
  });
  it('rejects everything when the secret is short, and issues nothing', () => {
    const t = issueSession(id, 0);
    process.env.SESSION_SECRET = 'short';
    expect(verifySession(t)).toBeNull();
    expect(() => issueSession(id, 0)).toThrow('SESSION_SECRET');
    process.env.SESSION_SECRET = 'x'.repeat(40);
  });
});
