import type { Metadata } from 'next';
import Panel from '@/components/Panel';

export const metadata: Metadata = {
  title: 'Panel — SınavOku',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return <Panel />;
}
