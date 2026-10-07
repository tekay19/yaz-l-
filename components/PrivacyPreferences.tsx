'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { setAnalyticsConsent } from '@/lib/tracking';

const REOPEN = 'sinavoku:privacy';

// The analytics question floats over the page's corner until it is answered,
// so it never adds height to a screen. Once answered it is gone; the footer's
// "Gizlilik tercihleri" link brings it back.
export default function PrivacyPreferences() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(!localStorage.getItem('sinavoku_analytics_consent')); }
    catch { setOpen(true); }
    const reopen = () => setOpen(true);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, []);
  function choose(allowed: boolean) {
    setAnalyticsConsent(allowed);
    setOpen(false);
  }
  if (!open) return null;
  return (
    <aside className="privacy-preferences" aria-label="Gizlilik tercihleri">
      <p>İsteğe bağlı kullanım analitiğine izin veriyor musunuz? Sayfa görüntüleme ve tıklamalar ölçülür.
        Tercihiniz site kullanımını etkilemez. <Link href="/gizlilik">Ayrıntılar</Link></p>
      <div className="privacy-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(false)}>Reddedin</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(true)}>İzin verin</button>
      </div>
    </aside>
  );
}

export function PrivacyLink() {
  return (
    <button type="button" className="privacy-reopen" onClick={() => window.dispatchEvent(new Event(REOPEN))}>
      Gizlilik tercihleri
    </button>
  );
}
