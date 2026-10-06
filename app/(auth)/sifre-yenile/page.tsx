import type { Metadata } from 'next';
import { ResetScreen } from '@/components/auth/screens';

export const metadata: Metadata = { title: 'Yeni şifre' };

export default function Page() {
  return <ResetScreen />;
}
