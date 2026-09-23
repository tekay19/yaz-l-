'use client';

import { PAID_PACKS, perPage, type PackName } from '@/lib/packs';
import { Check } from './Chrome';
import PriceTag from './PriceTag';

export default function PackageOptions({ selected, onSelect, minimumPages = 0 }: {
  selected: PackName;
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
          <p className="pack-unit">{pack.pages} sayfa · sayfası ₺{perPage(pack)}</p>
          <ul>{pack.blurb.map((line) => <li key={line}><Check />{line}</li>)}</ul>
          <button
            type="button"
            className={`btn btn-block ${pack.was || pack.featured ? 'btn-buy' : 'btn-ghost'}`}
            aria-pressed={selected === pack.name}
            disabled={tooSmall}
            onClick={() => onSelect(pack.name)}
          >
            {tooSmall ? 'Sayfa sayısı yetersiz' : selected === pack.name ? 'Seçildi ✓' : 'Paketi seçin'}
          </button>
        </div>
      );
    })}
  </div>;
}
