import { redirect } from 'next/navigation';

type Params = Promise<Record<string, string | string[] | undefined>>;

// /api/auth/callback sends a spent or expired link here; the test panel
// shows the message and the form to ask for a new one.
export default async function Page({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  redirect(sp.hata === 'baglanti' ? '/hesap?hata=baglanti' : '/hesap');
}
