import Link from 'next/link';

export function Check({ size = 17, width = 3 }: { size?: number; width?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function Lock({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark" aria-hidden="true">
        <Check />
      </span>
      SınavOku
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-head">
      <div className="wrap">
        <Logo />
        <nav className="head-nav" aria-label="Ana menü">
          <a href="#nasil" className="hide-sm">
            Nasıl çalışır
          </a>
          <a href="#ozellikler" className="hide-sm">
            Özellikler
          </a>
          <a href="#fiyat" className="hide-sm">
            Fiyat
          </a>
          <Link href="/paket" className="btn btn-primary btn-sm">
            Kâğıtlarınızı yükleyin
          </Link>
        </nav>
      </div>
    </header>
  );
}

const STEPS = ['Paket', 'Anahtar', 'Kâğıtlar', 'Özet', 'Ödeme'];

export function StepHeader({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <header className="site-head">
      <div className="wrap">
        <Logo />
        <div className="stepper" aria-label="Sipariş adımları">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < current ? 'done' : n === current ? 'current' : '';
            return (
              <span key={label} style={{ display: 'contents' }}>
                {i > 0 && <span className="line" />}
                <span className={`s ${state}`}>
                  <span className="dot">{n < current ? <Check size={11} width={3.5} /> : n}</span>
                  <span className="txt">{label}</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export function LegalLinks() {
  return (
    <nav className="foot-links legal-links" aria-label="Yasal bağlantılar">
      <Link href="/kvkk">KVKK Aydınlatma Metni</Link>
      <Link href="/gizlilik">Gizlilik Politikası</Link>
      <Link href="/kullanim-kosullari">Kullanım Koşulları</Link>
    </nav>
  );
}

export function SiteFooter({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <footer className="site-foot">
      <div className="wrap site-foot-main">
        {left ?? <span className="small muted">SınavOku · erken erişim</span>}
        {right ?? <span className="small muted">Kâğıtlarınız üçüncü kişilerle paylaşılmaz</span>}
      </div>
      <div className="wrap site-foot-legal">
        <LegalLinks />
      </div>
    </footer>
  );
}
