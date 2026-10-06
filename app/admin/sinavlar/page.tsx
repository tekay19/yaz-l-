import { Suspense } from 'react';
import JobsPage from '@/components/admin/JobsPage';
import { Loading } from '@/components/admin/ui';

export default function Page() {
  return <Suspense fallback={<Loading />}><JobsPage /></Suspense>;
}
