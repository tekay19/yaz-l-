'use client';

import { useRouter } from 'next/navigation';
import { usePlan } from '@/lib/usePlan';
import { PACKS, perPage, tl, type PackName } from '@/lib/packs';
import { track } from '@/lib/tracking';
import PackageOptions from './PackageOptions';
import PriceTag from './PriceTag';
import { Check } from './Chrome';

// The headline offer and the package grid both read from PACKS, so the
// struck-through price on the landing page can never drift from the cards.
const OFFER = PACKS['Başlangıç'];

export default function Pricing() {
  const [plan, choose] = usePlan();
  const router = useRouter();

  function pick(name: PackName) {
    choose(name);
    track('pack_click', 'index', name);
    router.push('/yukle');
  }

  return (
    <section id="fiyat">
      <div className="wrap">
        <div className="landing-offer card">
          <span className="offer-flag">{OFFER.label}</span>
          <h2>
            {tl(OFFER.price)} ile {OFFER.pages} sayfa sınav kâğıdı okutun
          </h2>

          <div className="offer-price" style={{ marginTop: 20 }}>
            <PriceTag pack={OFFER} />
            <span className="unit">
              {OFFER.pages} sayfa · sayfası ₺{perPage(OFFER)}
            </span>
          </div>

          <ul className="offer-list">
            {OFFER.blurb.map((line) => (
              <li key={line}>
                <Check size={17} width={2.4} />
                {line}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-buy btn-block"
            style={{ marginTop: 22 }}
            onClick={() => pick(OFFER.name)}
          >
            Hemen satın al · {tl(OFFER.price)}
          </button>

          <p className="tiny muted" style={{ marginTop: 12 }}>
            Sonraki adımda kâğıtlarınızı yüklersiniz. Abonelik yok, taahhüt yok —{' '}
            {OFFER.pages} sayfa bitince hesabınızdan bir şey çıkmaz.
          </p>
        </div>

        <div className="section-head" style={{ marginTop: 56 }}>
          <h2>Sayfa paketleri</h2>
          <p>Aylık abonelik yok. Paketinizi ödeme adımında da değiştirebilirsiniz.</p>
        </div>

        <PackageOptions selected={plan.name} onSelect={pick} />
      </div>
    </section>
  );
}
