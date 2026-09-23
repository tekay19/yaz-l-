'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tl } from '@/lib/packs';
import { usePlan } from '@/lib/usePlan';
import PriceTag from './PriceTag';
import { hasRequiredUpload, useUpload } from '@/lib/useUpload';
import OrderForm from './OrderForm';
import PackageOptions from './PackageOptions';
import { Lock } from './Chrome';

export default function OrderStep() {
  const router = useRouter();
  const [plan, choose] = usePlan();
  const { upload, ready } = useUpload();

  useEffect(() => {
    if (ready && !hasRequiredUpload(upload)) router.replace('/yukle');
  }, [ready, router, upload]);

  if (!ready || !hasRequiredUpload(upload)) return null;

  return (
    <main>
      <div className="wrap">
        <h1 style={{ fontSize: 'clamp(28px,3.6vw,38px)' }}>Ödeme bilgileri</h1>
        <p className="lead" style={{ marginTop: 12, maxWidth: '56ch' }}>
          Kart bilgilerinizi güvenli Stripe alanına girin. SınavOku kart numaranızı ve güvenlik
          kodunuzu göremez veya saklayamaz.
        </p>

        <section aria-label="Paket seçimi" style={{ padding: '36px 0 0' }}><h2 style={{ marginBottom: 28 }}>Paketinizi seçin</h2><PackageOptions selected={plan.name} onSelect={choose} minimumPages={upload.count} /></section>
        <div className="checkout" style={{ marginTop: 36 }}>
          <div>
            <div className="card">
              <h2 style={{ fontSize: 20, marginBottom: 6 }}>Kart bilgileri</h2>
              <p className="small muted" style={{ marginBottom: 18 }}>
                Bu adımda ödeme, provizyon veya kart kaydı oluşturulmaz.
              </p>

              {upload.count <= plan.pages ? <OrderForm amount={plan.price * 100} /> : <p className="status err" role="alert">Seçtiğiniz görseller için daha büyük bir paket seçin.</p>}
            </div>

            <p style={{ marginTop: 20 }}>
              <Link href="/ozet" className="small" style={{ color: 'var(--board)', fontWeight: 600 }}>
                ← Özete dönün
              </Link>
            </p>
          </div>

          <aside className="card summary">
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Sipariş özeti</h2>
            <div className="sum-row">
              <span className="k">
                {plan.short} · {plan.pages} sayfa
              </span>
              <span className="v"><PriceTag pack={plan} size="sm" /></span>
            </div>
            <div className="sum-row">
              <span className="k">Yüklenen kâğıt</span>
              <span className="v">{upload.count}</span>
            </div>
            <div className="sum-total">
              <span className="k">Toplam</span>
              <span className="v"><PriceTag pack={plan} size="sm" /></span>
            </div>

            <p className="trust-row" style={{ marginTop: 20 }}>
              <Lock />
              Kart bilgileriniz SınavOku&apos;ya aktarılmaz
            </p>

            <p className="tiny muted" style={{ marginTop: 14, textAlign: 'center' }}>
              <Link href="/kullanim-kosullari">Kullanım Koşulları</Link> · <Link href="/kvkk">KVKK Aydınlatma Metni</Link>
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
