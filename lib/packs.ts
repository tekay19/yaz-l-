// The only place package prices live. Every screen of the funnel and the
// admin panel render from here, so a price can never drift between steps.

export type Pack = {
  name: PackName;
  label: string;
  short: string;
  price: number;
  pages: number;
  was?: number;
  blurb: string[];
  featured?: boolean;
};

export type PackName = 'Başlangıç' | 'Öğretmen' | 'Zümre';

export const PACKS: Record<PackName, Pack> = {
  // The intro offer lives on this pack rather than a separate one, so the
  // struck-through ₺500 and the ₺50 the visitor actually pays travel together
  // through every screen of the funnel.
  'Başlangıç': {
    name: 'Başlangıç',
    label: 'İlk siparişe özel',
    short: 'Başlangıç paketi',
    price: 50,
    was: 500,
    pages: 150,
    blurb: ['Yaklaşık 3 sınıf sınavı', 'Excel ve PDF rapor', 'Sayfalar dolana kadar geçerli'],
  },
  'Öğretmen': {
    name: 'Öğretmen',
    label: 'Öğretmen paketi',
    short: 'Öğretmen paketi',
    price: 850,
    pages: 200,
    featured: true,
    blurb: ['Yaklaşık 4 sınıf sınavı', 'Excel ve PDF rapor', 'Sınıf karşılaştırma özeti'],
  },
  'Zümre': {
    name: 'Zümre',
    label: 'Zümre paketi',
    short: 'Zümre paketi',
    price: 1490,
    pages: 500,
    blurb: ['Yaklaşık 10 sınıf sınavı', 'Excel ve PDF rapor', 'Zümre içinde paylaşılabilir'],
  },
};

export const DEFAULT_PLAN: PackName = 'Başlangıç';
export const PAID_PACKS: Pack[] = [PACKS['Başlangıç'], PACKS['Öğretmen'], PACKS['Zümre']];

export const tl = (n: number) => '₺' + n.toLocaleString('tr-TR');

export const perPage = (p: Pack) =>
  (p.price / p.pages).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const isPackName = (v: unknown): v is PackName =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(PACKS, v);
