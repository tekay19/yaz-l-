import { Suspense } from 'react';
import PaymentsPage from '@/components/admin/PaymentsPage';
import { Loading } from '@/components/admin/ui';

export default function Page() {
  return <Suspense fallback={<Loading />}><PaymentsPage /></Suspense>;
}
