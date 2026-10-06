import JobDetail from '@/components/admin/JobDetail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetail key={id} id={id} />;
}
