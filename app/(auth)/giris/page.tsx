import type { Metadata } from 'next';
import { LoginScreen } from '@/components/auth/screens';

export const metadata: Metadata = { title: 'Giriş' };

export default function Page() {
  return <LoginScreen />;
}
