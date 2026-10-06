'use client';

import { useRouter } from 'next/navigation';
import { usePlan } from '@/lib/usePlan';
import { PAID_PACKS, perPage, type PackName } from '@/lib/packs';
import { track } from '@/lib/tracking';
import PriceTag from './PriceTag';
import { Check } from './Chrome';

// The landing page's prices: the three packs side by side on one sheet, all
// read from PACKS. Picking one remembers it for the wizard's payment step
// and opens the wizard.
export default function Pricing() {
  const [, choose] = usePlan();
  const router = useRouter();

  function pick(name: PackName) {
    choose(name);
    track('pack_click', 'index', name);
    router.push('/yukle');
  }

  return (
    <section id="fiyat" className="lp-section">
      <div className="wrap">
        <header className="lp-head">
          <h2>Sayfa başına ödeyin, abonelik yok.</h2>
          <p className="lp-lead">Her öğrenci sayfası bir sayfa hakkı. Cevap anahtarı sayılmaz, okunamayan sayfa iade edilir. Sayfalar dolana kadar geçerlidir.</p>
        </header>
        <div className="lp-prices">
          {PAID_PACKS.map((p) => (
            <article key={p.name} className={`lp-price${p.was ? ' offer' : ''}`} aria-labelledby={`pack-${p.pages}`}>
              <div className="lp-price-head">
                <h3 id={`pack-${p.pages}`}>{p.name}</h3>
                {p.was && <span className="lp-price-flag">{p.label}</span>}
              </div>
              <div className="lp-price-tag"><PriceTag pack={p} /></div>
              <dl className="lp-price-facts">
                <div><dt>Sayfa</dt><dd>{p.pages}</dd></div>
                <div><dt>Sayfa başı</dt><dd>₺{perPage(p)}</dd></div>
              </dl>
              <ul>{p.blurb.map((line) => <li key={line}><Check size={15} width={2.6} />{line}</li>)}</ul>
              <button type="button" className={`btn btn-block ${p.was ? 'btn-primary' : 'btn-ghost'}`} onClick={() => pick(p.name)}>
                {p.was ? 'Bu paketle başlayın' : 'Bu paketi seçin'}
              </button>
            </article>
          ))}
        </div>
        <p className="lp-price-foot">Ödeme iyzico ile alınır. Paket, sınavınızı gönderirken seçilir; önce kâğıtlarınızı yükleyebilirsiniz.</p>
      </div>
    </section>
  );
}
