import { Suspense } from 'react';
import UsersPage from '@/components/admin/UsersPage';
import { Loading } from '@/components/admin/ui';

export default function Page() {
  return <Suspense fallback={<Loading />}><UsersPage /></Suspense>;
}
