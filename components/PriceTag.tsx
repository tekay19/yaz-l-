import { tl, type Pack } from '@/lib/packs';

/**
 * A pack's price, with the pre-discount figure struck through when the pack
 * carries one. Used on the package cards and in every order summary, so the
 * discount reads the same from the landing page through to checkout.
 */
export default function PriceTag({ pack, size = 'md' }: { pack: Pack; size?: 'sm' | 'md' }) {
  return (
    <span className={`price-tag price-tag-${size}`}>
      {pack.was && (
        <s className="was" aria-label={`Normal fiyat ${tl(pack.was)}`}>
          {tl(pack.was)}
        </s>
      )}
      <span className="now">{tl(pack.price)}</span>
    </span>
  );
}
