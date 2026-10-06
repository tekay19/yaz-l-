import { Suspense } from 'react';
import AnalyticsPage from '@/components/admin/AnalyticsPage';
import { Loading } from '@/components/admin/ui';

export default function Page() {
  return <Suspense fallback={<Loading />}><AnalyticsPage /></Suspense>;
}
