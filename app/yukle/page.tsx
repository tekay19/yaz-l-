import type { Metadata } from 'next';
import KeyStep from '@/components/steps/KeyStep';
import Tracker from '@/components/Tracker';
import { StepHeader, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Cevap anahtarı — SınavOku', robots: { index: false } };

export default function Page() {
  return (
    <>
      <Tracker page="yukle" />
      <StepHeader current={2} />
      <KeyStep />
      <SiteFooter />
    </>
  );
}
