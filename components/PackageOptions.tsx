'use client';

import { PAID_PACKS, perPage, tl, type PackName } from '@/lib/packs';
import { Check } from './Chrome';
import PriceTag from './PriceTag';

// Packs to buy now (the account's billing page, the wizard's last step):
// each button starts the payment for its pack.
export default function PackageOptions({ onSelect, minimumPages = 0 }: {
  onSelect: (name: PackName) => void;
  minimumPages?: number;
}) {
  return <div className="pack-grid">
    {PAID_PACKS.map((pack) => {
      const tooSmall = minimumPages > pack.pages;
      return (
        <div key={pack.name} className={`price-card pack${pack.featured ? ' featured' : ''}${pack.was ? ' discounted' : ''}`}>
          {pack.featured && <span className="pack-tag">En çok tercih edilen</span>}
          {pack.was && <span className="pack-tag offer">{pack.label}</span>}
          <p className="pack-name">{pack.name}</p>
          <div className="price-amount"><PriceTag pack={pack} /></div>
          <p className="pack-unit">{pack.pages} sayfa, sayfası {perPage(pack)} TL</p>
          <ul>{pack.blurb.map((line) => <li key={line}><Check size={15} width={2.6} />{line}</li>)}</ul>
          <button
            data-pack-btn
            type="button"
            className={`btn btn-block ${pack.was || pack.featured ? 'btn-buy' : 'btn-ghost'}`}
            disabled={tooSmall}
            onClick={() => onSelect(pack.name)}
          >
            {tooSmall ? 'Bu sınava yetmez' : `${tl(pack.price)} ile satın alın`}
          </button>
        </div>
      );
    })}
  </div>;
}
