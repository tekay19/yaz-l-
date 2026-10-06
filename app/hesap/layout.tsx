import type { Metadata } from 'next';
import { Suspense } from 'react';
import AppShell from '@/components/app/AppShell';
import './app.css';

export const metadata: Metadata = {
  title: { default: 'Öğretmen paneli — SınavOku', template: '%s — SınavOku' },
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// The sign-in pages send teachers here, and so does the iyzico payment page
// (/api/pay/callback?odeme=ok|hata).
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
