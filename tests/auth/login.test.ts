import { describe, expect, it } from 'vitest';
import { testDb } from '../helpers/db';
import { fakeMailer } from '../helpers/mail';
import { consumeLogin, requestLogin } from '@/lib/auth/login';

const tokenFrom = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;

describe('login', () => {
  it('mails a link whose token logs in exactly once and creates the user', async () => {
    const db = await testDb();
    const mail = fakeMailer();
    expect(await requestLogin(db, mail, ' Ogretmen@Okul.k12.tr ', 'https://sinavoku.com')).toBe(true);
    expect(mail.sent[0].to).toBe('ogretmen@okul.k12.tr');
    const token = tokenFrom(mail.sent[0].text);
    const first = await consumeLogin(db, token);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(await consumeLogin(db, token)).toBeNull();
  });

  it('returns the same user on a second login', async () => {
    const db = await testDb();
    const mail = fakeMailer();
    await requestLogin(db, mail, 'a@b.co', 'https://x');
    await requestLogin(db, mail, 'a@b.co', 'https://x');
    const a = await consumeLogin(db, tokenFrom(mail.sent[0].text));
    const b = await consumeLogin(db, tokenFrom(mail.sent[1].text));
    expect(a).toBe(b);
  });

  it('refuses an invalid address without sending mail', async () => {
    const db = await testDb();
    const mail = fakeMailer();
    expect(await requestLogin(db, mail, 'not-an-email', 'https://x')).toBe(false);
    expect(mail.sent).toHaveLength(0);
  });
});
