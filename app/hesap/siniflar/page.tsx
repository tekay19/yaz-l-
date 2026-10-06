import type { Metadata } from 'next';
import ClassesPage from '@/components/app/ClassesPage';

export const metadata: Metadata = { title: 'Sınıflarım' };

export default function Page() {
  return <ClassesPage />;
}
