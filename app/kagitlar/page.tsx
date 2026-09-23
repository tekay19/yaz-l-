import type { Metadata } from 'next';
import PapersStep from '@/components/steps/PapersStep';
import Tracker from '@/components/Tracker';
import { StepHeader, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Öğrenci kâğıtları — SınavOku', robots: { index: false } };

export default function Page() {
  return (
    <>
      <Tracker page="kagitlar" />
      <StepHeader current={3} />
      <PapersStep />
      <SiteFooter />
    </>
  );
}
