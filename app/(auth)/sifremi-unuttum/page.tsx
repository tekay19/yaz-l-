import type { Metadata } from 'next';
import { ForgotScreen } from '@/components/auth/screens';

export const metadata: Metadata = { title: 'Şifremi unuttum' };

export default function Page() {
  return <ForgotScreen />;
}
