import type { Metadata } from 'next';
import PackageStep from '@/components/steps/PackageStep';
import Tracker from '@/components/Tracker';
import { StepHeader, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Paketinizi seçin — SınavOku', robots: { index: false } };

export default function Page() {
  return (
    <>
      <Tracker page="paket" />
      <StepHeader current={1} />
      <PackageStep />
      <SiteFooter />
    </>
  );
}
