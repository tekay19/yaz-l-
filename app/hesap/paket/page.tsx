import type { Metadata } from 'next';
import BillingPage from '@/components/app/BillingPage';

export const metadata: Metadata = { title: 'Paket ve ödemeler' };

export default function Page() {
  return <BillingPage />;
}
