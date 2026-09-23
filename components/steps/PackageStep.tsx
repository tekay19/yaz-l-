'use client';

import { useRouter } from 'next/navigation';
import PackageOptions from '../PackageOptions';
import WizardShell from '../WizardShell';
import { usePlan } from '@/lib/usePlan';
import { track } from '@/lib/tracking';
import { useUpload } from '@/lib/useUpload';
import type { PackName } from '@/lib/packs';

export default function PackageStep() {
  const router = useRouter();
  const [plan, choose] = usePlan();
  const { upload } = useUpload();

  function pick(name: PackName) {
    choose(name);
    track('pack_click', 'paket', name);
  }

  return (
    <WizardShell
      step={1}
      title="Paketinizi seçin"
      lead="Kaç sayfa okutacağınıza göre seçin. Aylık abonelik yok; sayfa hakkınız dolana kadar geçerli."
      nextLabel="Devam edin"
      onNext={() => router.push('/yukle')}
    >
      {/* a package smaller than what is already picked would silently drop papers */}
      <PackageOptions selected={plan.name} onSelect={pick} minimumPages={upload.count} />
    </WizardShell>
  );
}
