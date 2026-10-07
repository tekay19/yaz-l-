import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk, Caveat } from 'next/font/google';
import './globals.css';
import PrivacyPreferences from '@/components/PrivacyPreferences';
import { ToastHost } from '@/components/Toast';

const sans = Schibsted_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#173F33',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${sans.variable} ${caveat.variable}`}>
      <body className="page">
        <ToastHost>{children}</ToastHost>
        <PrivacyPreferences />
      </body>
    </html>
  );
}
