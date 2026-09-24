import crypto from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { loginTokens, users } from '@/db/schema';
import type { Mailer } from '@/lib/mail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export async function requestLogin(db: Db, mailer: Mailer, rawEmail: string, appUrl: string) {
  const email = rawEmail.trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) return false;
  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(loginTokens).values({
    tokenHash: hash(token),
    email,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  const link = `${appUrl}/api/auth/callback?token=${token}`;
  await mailer.send({
    to: email,
    subject: 'SınavOku giriş bağlantınız',
    text: `SınavOku'ya giriş yapmak için bağlantıyı açın (15 dakika geçerli):\n${link}\n\nBu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.`,
  });
  return true;
}

export async function consumeLogin(db: Db, token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db.update(loginTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(loginTokens.tokenHash, hash(token)),
      isNull(loginTokens.usedAt),
      gt(loginTokens.expiresAt, new Date()),
    ))
    .returning({ email: loginTokens.email });
  if (!row) return null;
  const [user] = await db.insert(users).values({ email: row.email })
    .onConflictDoUpdate({ target: users.email, set: { email: row.email } })
    .returning({ id: users.id });
  return user.id;
}
