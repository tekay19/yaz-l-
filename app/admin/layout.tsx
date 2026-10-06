import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current';
import AdminShell from '@/components/admin/AdminShell';
import './admin.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SınavOku yönetim',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// Only a signed-in admin sees the panel; anyone else gets a 404, as if it did not exist.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  if (!me) redirect('/giris?next=/admin');
  if (me.role !== 'admin') notFound();
  return <AdminShell me={{ name: me.name, email: me.email }}>{children}</AdminShell>;
}
