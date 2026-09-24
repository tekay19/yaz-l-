import type { Metadata } from 'next';
import EvalScreen from '@/components/eval/EvalScreen';

export const metadata: Metadata = {
  title: 'Ölçüm — SınavOku',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

// The accuracy/cost gate of eval/README.md. Admin only: the screen checks
// the panel session, and /api/admin/eval refuses every call without it.
export default function Page() {
  return <EvalScreen />;
}
