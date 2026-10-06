import type { Metadata } from 'next';
import { Suspense } from 'react';
import Tracker from '@/components/Tracker';
import UploadWizard from '@/components/upload/UploadWizard';

export const metadata: Metadata = { title: 'Sınav yükleyin — SınavOku', robots: { index: false } };

export default function Page() {
  return (
    <>
      <Tracker page="yukle" />
      {/* the wizard reads ?sinav= and ?adim= */}
      <Suspense>
        <UploadWizard />
      </Suspense>
    </>
  );
}
