import type { Metadata } from 'next';
import Console from '@/components/console/Console';

export const metadata: Metadata = {
  title: 'Hesabım — SınavOku',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<Record<string, string | string[] | undefined>>;

// The backend sends people here after the login link (/api/auth/callback)
// and after the iyzico payment page (/api/pay/callback?odeme=ok|hata).
export default async function Page({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const payment = sp.odeme === 'ok' ? 'ok' : sp.odeme === 'hata' ? 'hata' : null;
  const open = typeof sp.sinav === 'string' ? sp.sinav : null;
  return <Console loginError={sp.hata === 'baglanti'} payment={payment} open={open} />;
}
