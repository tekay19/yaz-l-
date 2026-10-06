import type { Metadata } from 'next';
import SettingsPage from '@/components/app/SettingsPage';

export const metadata: Metadata = { title: 'Ayarlar' };

export default function Page() {
  return <SettingsPage />;
}
