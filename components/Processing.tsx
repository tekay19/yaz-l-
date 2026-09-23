'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  'Kart bilgileriniz kontrol ediliyor…',
  'Güvenli bağlantı kuruluyor…',
  'İşlem sonucu bekleniyor…',
];

export default function Processing({ next = '/hata' }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const tick = window.setInterval(() => {
      setStep((current) => (current < STEPS.length - 1 ? current + 1 : current));
    }, 1200);
    const done = window.setTimeout(() => router.push(next), 4200);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
      document.body.style.overflow = '';
    };
  }, [next, router]);

  return (
    <div className="pay-overlay" role="status" aria-live="polite">
      <div className="box">
        <div className="pay-spin" />
        <h2>İşleminiz kontrol ediliyor</h2>
        <p className="step">{STEPS[step]}</p>
        <p className="warn">Lütfen sayfayı kapatmayın veya yenilemeyin.</p>
      </div>
    </div>
  );
}
