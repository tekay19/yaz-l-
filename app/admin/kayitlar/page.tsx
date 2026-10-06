import { Suspense } from 'react';
import AuditPage from '@/components/admin/AuditPage';
import { Loading } from '@/components/admin/ui';

export default function Page() {
  return <Suspense fallback={<Loading />}><AuditPage /></Suspense>;
}
