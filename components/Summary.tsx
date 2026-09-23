'use client';

// Step 2: what was picked, shown back before the order is placed.
//
// The papers are listed by the teacher's own file names and marked "Sırada".
// No score is shown, because nothing has read them — inventing numbers here
// would be the one thing a demand test must never do.

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tl } from '@/lib/packs';
import { usePlan } from '@/lib/usePlan';
import PriceTag from './PriceTag';
import { hasRequiredUpload, useUpload } from '@/lib/useUpload';

export default function Summary() {
  const router = useRouter();
  const [plan] = usePlan();
  const { upload, ready } = useUpload();

  useEffect(() => {
    if (ready && !hasRequiredUpload(upload)) router.replace('/yukle');
  }, [ready, router, upload]);

  if (!ready || !hasRequiredUpload(upload)) return null;

  const shown = upload.names.length ? upload.names : [];
  const count = upload.count;

  return (
    <main>
      <div className="wrap">
        <h1 style={{ fontSize: 'clamp(28px,3.6vw,38px)' }}>Siparişinizi gözden geçirin</h1>
        <p className="lead" style={{ marginTop: 12, maxWidth: '56ch' }}>
          Seçtiğiniz görseller aşağıda listelenir. Sonraki adımda paketinizi ve ödeme bilgilerinizi kontrol edebilirsiniz.
        </p>

        <div className="checkout" style={{ marginTop: 36 }}>
          <div>
            <div className="card">
              <h2 style={{ fontSize: 20 }}>Yüklenen kâğıtlar</h2>
              <p className="small muted" style={{ margin: '6px 0 20px' }}>
                Görseller doğrulandı ve kalıcı olarak saklanmadı; değerlendirme yapılmadı.
              </p>

              <div className="papers">
                {!ready ? null : shown.length === 0 ? (
                  <p className="small muted">Kâğıt yüklenmedi.</p>
                ) : (
                  <>
                    {shown.slice(0, 4).map((name, i) => (
                      <div className="paper-chip" key={`${name}-${i}`}>
                        <div className="thumb" />
                        <div className="meta" title={name}>
                          {name}
                        </div>
                        <div className="state">
                          <span className="d" />
                          Sırada
                        </div>
                      </div>
                    ))}
                    {shown.length > 4 && (
                      <div className="paper-more">
                        <strong>+{shown.length - 4}</strong>
                        <span>kâğıt daha</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: 20, marginBottom: 6 }}>Sınav bilgileri</h2>
              <p className="small muted" style={{ marginBottom: 8 }}>
                Seçimlerinizi kontrol edin.
              </p>
              <div className="sum-row">
                <span className="k">Sınav türü</span>
                <span className="v">{upload.mode === 'klasik' ? 'Klasik (yazılı)' : 'Çoktan seçmeli'}</span>
              </div>
              <div className="sum-row">
                <span className="k">Cevap anahtarı</span>
                <span className={`v${upload.key ? '' : ' missing'}`}>{upload.key || 'Yüklenmedi'}</span>
              </div>
              <div className="sum-row">
                <span className="k">Öğrenci kâğıdı</span>
                <span className="v">{count || '—'}</span>
              </div>
              <div className="sum-row">
                <span className="k">Okunacak kâğıt</span>
                <span className="v">{count ? `${count} / ${count}` : '—'}</span>
              </div>
              <div className="sum-row">
                <span className="k">Tahmini süre</span>
                <span className="v">Sıra geldiğinde ~4 dakika</span>
              </div>
              <div className="sum-row">
                <span className="k">Teslim</span>
                <span className="v">E-posta · Excel + PDF</span>
              </div>
            </div>

            <p style={{ marginTop: 20 }}>
              <Link href="/yukle" className="small" style={{ color: 'var(--board)', fontWeight: 600 }}>
                ← Kâğıtları değiştirin
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
              <span className="k">Soru bazlı analiz</span>
              <span className="v">Dahil</span>
            </div>
            <div className="sum-row">
              <span className="k">Excel + PDF çıktı</span>
              <span className="v">Dahil</span>
            </div>
            <div className="sum-total">
              <span className="k">Toplam</span>
              <span className="v"><PriceTag pack={plan} size="sm" /></span>
            </div>

            <Link href="/odeme" className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
              Paket seçimi ve ödemeye geçin
            </Link>

            <p className="trust-row">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              KDV dahil · Şimdi ücret alınmaz
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
