import type { Metadata } from 'next';
import { Suspense } from 'react';
import '../hesap/app.css';

export const metadata: Metadata = {
  title: { default: 'Giriş — SınavOku', template: '%s — SınavOku' },
  robots: { index: false, follow: false },
  // the reset and verify links carry their token in the URL
  referrer: 'no-referrer',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
