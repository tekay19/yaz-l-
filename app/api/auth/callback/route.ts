import { cookies } from 'next/headers';
import { getDb } from '@/db/client';
import { consumeLogin } from '@/lib/auth/login';
import { SESSION_COOKIE, SESSION_TTL_DAYS, issueSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');

// GET only shows a confirm button: mail scanners that prefetch links must
// not be able to burn the one-time token.
export async function GET(req: Request) {
  const token = esc(new URL(req.url).searchParams.get('token') || '');
  const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>SınavOku giriş</title><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px">
<h1 style="font-size:22px">SınavOku'ya giriş</h1>
<form method="post"><input type="hidden" name="token" value="${token}">
<button style="font-size:16px;padding:12px 20px">Giriş yap</button></form></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get('token') || '');
  const userId = await consumeLogin(getDb(), token);
  const base = process.env.APP_URL!;
  if (!userId) return Response.redirect(`${base}/giris?hata=baglanti`, 303);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, issueSession(userId), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_DAYS * 86_400,
  });
  return Response.redirect(`${base}/hesap`, 303);
}
