'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { setAnalyticsConsent } from '@/lib/tracking';

export default function PrivacyPreferences() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(!localStorage.getItem('sinavoku_analytics_consent')); }
    catch { setOpen(true); }
  }, []);
  function choose(allowed: boolean) {
    setAnalyticsConsent(allowed);
    setOpen(false);
  }
  return <aside className="privacy-preferences" aria-label="Gizlilik tercihleri">
    {open ? <>
      <p>İsteğe bağlı kullanım analitiğine izin veriyor musunuz? Sayfa görüntüleme ve tıklamalar ölçülür.
        Tercihiniz site kullanımını etkilemez. <Link href="/gizlilik">Ayrıntılar</Link></p>
      <div className="privacy-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(false)}>Reddet</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(true)}>İzin ver</button>
      </div>
    </> : <button type="button" className="small" onClick={() => setOpen(true)}>Gizlilik tercihleri</button>}
  </aside>;
}
