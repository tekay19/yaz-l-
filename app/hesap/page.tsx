import type { Metadata } from 'next';
import ExamsPage from '@/components/app/ExamsPage';

export const metadata: Metadata = { title: 'Sınavlarım' };

export default function Page() {
  return <ExamsPage />;
}
