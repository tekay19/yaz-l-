import type { Metadata } from 'next';
import { VerifyScreen } from '@/components/auth/screens';

export const metadata: Metadata = { title: 'E-posta doğrulama' };

export default function Page() {
  return <VerifyScreen />;
}
