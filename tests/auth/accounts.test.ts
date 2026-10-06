import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { fakeMailer } from '../helpers/mail';
import { users } from '@/db/schema';
import type { Db } from '@/db/client';
import {
  authenticate, changePassword, register, requestPasswordReset, resetPassword, sendVerification, verifyEmail,
} from '@/lib/auth/accounts';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password';

const APP = 'https://sinavoku.test';
const tokenIn = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)![1];
const GOOD = 'tebeşir2026';

describe('password hashing', () => {
  it('verifies the right password only, and never a missing hash', async () => {
    const h = await hashPassword(GOOD);
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword(GOOD, h)).toBe(true);
    expect(await verifyPassword('tebesir2026', h)).toBe(false);
    expect(await verifyPassword(GOOD, null)).toBe(false);
    expect(await verifyPassword('', null)).toBe(false);
  });
  it('asks for length, a letter and a digit', () => {
    expect(passwordProblem('kısa1')).toMatch(/10 karakter/);
    expect(passwordProblem('sadeceharfler')).toMatch(/rakam/);
    expect(passwordProblem('1234567890')).toMatch(/harf/);
    expect(passwordProblem(GOOD)).toBeNull();
  });
});

describe('accounts', () => {
  let db: Db;
  let mail: ReturnType<typeof fakeMailer>;
  beforeEach(async () => { db = await testDb(); mail = fakeMailer(); delete process.env.ADMIN_EMAILS; });

  it('registers an unverified teacher, mails a link that verifies them once', async () => {
    const r = await register(db, mail, { name: ' Ayşe  Yılmaz ', email: ' Ayse@Okul.k12.tr ', password: GOOD }, APP);
    expect(r.ok).toBe(true);
    const [u] = await db.select().from(users);
    expect([u.email, u.name, u.role, u.emailVerifiedAt]).toEqual(['ayse@okul.k12.tr', 'Ayşe Yılmaz', 'teacher', null]);
    expect(u.passwordHash).not.toContain(GOOD);
    expect(mail.sent[0].text).toContain(`${APP}/dogrula?token=`);
    const token = tokenIn(mail.sent[0].text);
    expect(await verifyEmail(db, token)).toBe(u.id);
    expect(await verifyEmail(db, token)).toBeNull(); // spent
    const [after] = await db.select().from(users);
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(await sendVerification(db, mail, u.id, APP)).toBe(false); // nothing to verify any more
  });

  it('refuses a taken address, a bad name and a weak password', async () => {
    await register(db, mail, { name: 'Ayşe Yılmaz', email: 'a@okul.k12.tr', password: GOOD }, APP);
    const again = await register(db, mail, { name: 'Başka', email: 'A@okul.k12.tr', password: GOOD }, APP);
    expect(again).toMatchObject({ ok: false, field: 'email', taken: true });
    expect(await register(db, mail, { name: 'A', email: 'b@okul.k12.tr', password: GOOD }, APP)).toMatchObject({ ok: false, field: 'name' });
    expect(await register(db, mail, { name: 'Ali Can', email: 'b@okul.k12.tr', password: 'kısa' }, APP)).toMatchObject({ ok: false, field: 'password' });
    expect(await register(db, mail, { name: 'Ali Can', email: 'not-mail', password: GOOD }, APP)).toMatchObject({ ok: false, field: 'email' });
  });

  it('signs in with the right password only; a suspended account is refused', async () => {
    await register(db, mail, { name: 'Ayşe Yılmaz', email: 'a@okul.k12.tr', password: GOOD }, APP);
    expect(await authenticate(db, 'A@okul.k12.tr', GOOD)).toMatchObject({ ok: true, user: { email: 'a@okul.k12.tr', role: 'teacher' } });
    expect(await authenticate(db, 'a@okul.k12.tr', 'yanlış2026x')).toEqual({ ok: false, reason: 'invalid' });
    expect(await authenticate(db, 'yok@okul.k12.tr', GOOD)).toEqual({ ok: false, reason: 'invalid' });
    await db.update(users).set({ suspendedAt: new Date() });
    expect(await authenticate(db, 'a@okul.k12.tr', GOOD)).toEqual({ ok: false, reason: 'suspended' });
  });

  it('an account from the e-mail link era has no password and cannot sign in until it resets', async () => {
    await makeUser(db, 'eski@okul.k12.tr');
    expect(await authenticate(db, 'eski@okul.k12.tr', GOOD)).toEqual({ ok: false, reason: 'invalid' });
    expect(await requestPasswordReset(db, mail, 'eski@okul.k12.tr', APP)).toBe(true);
    const r = await resetPassword(db, tokenIn(mail.sent[0].text), GOOD);
    expect(r.ok).toBe(true);
    expect((await authenticate(db, 'eski@okul.k12.tr', GOOD)).ok).toBe(true);
  });

  it('reset: same answer for unknown addresses, one use, bumps the session version, kills older links', async () => {
    expect(await requestPasswordReset(db, mail, 'kimse@okul.k12.tr', APP)).toBe(true);
    expect(mail.sent).toHaveLength(0);
    const u = await makeUser(db, 'a@okul.k12.tr', 0, { emailVerifiedAt: null });
    await requestPasswordReset(db, mail, 'a@okul.k12.tr', APP);
    await requestPasswordReset(db, mail, 'a@okul.k12.tr', APP);
    const [first, second] = mail.sent.map((m) => tokenIn(m.text));
    expect(await resetPassword(db, second, 'kısa')).toMatchObject({ ok: false });
    const r = await resetPassword(db, second, GOOD);
    expect(r).toMatchObject({ ok: true, user: { id: u.id, sessionVersion: 1 } });
    expect((await resetPassword(db, second, GOOD)).ok).toBe(false); // spent
    expect((await resetPassword(db, first, GOOD)).ok).toBe(false); // superseded
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.emailVerifiedAt).not.toBeNull(); // the link proved the mailbox
  });

  it('change password needs the current one and signs other devices out', async () => {
    const r = await register(db, mail, { name: 'Ayşe Yılmaz', email: 'a@okul.k12.tr', password: GOOD }, APP);
    const id = r.ok ? r.user.id : '';
    expect(await changePassword(db, id, 'yanlış2026x', 'yeniŞifre2027')).toMatchObject({ ok: false, field: 'current' });
    expect(await changePassword(db, id, GOOD, 'kısa')).toMatchObject({ ok: false, field: 'next' });
    expect(await changePassword(db, id, GOOD, 'yeniŞifre2027')).toEqual({ ok: true, sessionVersion: 1 });
    expect((await authenticate(db, 'a@okul.k12.tr', 'yeniŞifre2027')).ok).toBe(true);
  });

  it('addresses in ADMIN_EMAILS become admins on sign-up and sign-in', async () => {
    await register(db, mail, { name: 'Ayşe Yılmaz', email: 'a@okul.k12.tr', password: GOOD }, APP);
    process.env.ADMIN_EMAILS = 'kurucu@sinavoku.com, A@okul.k12.tr';
    expect(await authenticate(db, 'a@okul.k12.tr', GOOD)).toMatchObject({ ok: true, user: { role: 'admin' } });
    const r = await register(db, mail, { name: 'Kurucu', email: 'kurucu@sinavoku.com', password: GOOD }, APP);
    expect(r).toMatchObject({ ok: true, user: { role: 'admin' } });
  });
});
