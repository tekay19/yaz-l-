import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Caveat } from 'next/font/google';
import './globals.css';
import PrivacyPreferences from '@/components/PrivacyPreferences';
import { ToastHost } from '@/components/Toast';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin', 'latin-ext'],
  weight: ['600'],
  variable: '--font-caveat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SınavOku — Sınav kâğıtlarını yapay zeka okusun, puanlar size gelsin',
  description:
    'Sınav kâğıtlarını telefonla çekin, yapay zeka okuyup puanlasın. Öğrenci puan listesi, soru bazlı başarı analizi ve sınıf özeti dakikalar içinde e-postanıza gelir.',
  icons: {
    icon:
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%2314513C"/><path d="M9 16.5l4.5 4.5L23 11" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14513C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${jakarta.variable} ${caveat.variable}`}>
      <body className="page">
        <ToastHost>{children}</ToastHost>
        <PrivacyPreferences />
      </body>
    </html>
  );
}
