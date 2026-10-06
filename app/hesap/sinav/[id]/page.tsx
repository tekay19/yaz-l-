import type { Metadata } from 'next';
import ExamPage from '@/components/app/ExamPage';

export const metadata: Metadata = { title: 'Sınav' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamPage id={id} />;
}
