import type { Metadata } from 'next';
import { Suspense } from 'react';
import AppShell from '@/components/app/AppShell';
import './app.css';

export const metadata: Metadata = {
  title: { default: 'Öğretmen paneli — SınavOku', template: '%s — SınavOku' },
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// The backend sends teachers here after the sign-in link (/api/auth/callback)
// and after the iyzico payment page (/api/pay/callback?odeme=ok|hata).
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
