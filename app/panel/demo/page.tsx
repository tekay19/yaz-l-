import type { Metadata } from 'next';
import DemoScreen from '@/components/demo/DemoScreen';

export const metadata: Metadata = {
  title: 'Demo — SınavOku',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// Klasik grading, live: upload exam photos, see the transcription and the
// points. Admin only: every photo goes to the paid API.
export default function Page() {
  return <DemoScreen />;
}
