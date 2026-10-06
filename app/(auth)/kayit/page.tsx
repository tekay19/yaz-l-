import type { Metadata } from 'next';
import { RegisterScreen } from '@/components/auth/screens';

export const metadata: Metadata = { title: 'Hesap açın' };

export default function Page() {
  return <RegisterScreen />;
}
