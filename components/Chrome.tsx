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
    <Link href="/" className="logo" aria-label="SınavOku ana sayfa">
      <span className="logo-mark" aria-hidden="true">
        <Check />
      </span>
      <span className="logo-text">SınavOku</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-head">
      <div className="wrap">
        <Logo />
        <nav className="head-nav" aria-label="Ana menü">
          <div className="head-links">
            <a href="/#nasil">Nasıl çalışır</a>
            <a href="/#klasik">Klasik sınav</a>
            <a href="/#fiyat">Fiyat</a>
            <a href="/#sss">Sorular</a>
          </div>
          <Link href="/giris" className="head-login">Giriş yapın</Link>
          <Link href="/kayit" className="btn btn-primary btn-sm">
            Ücretsiz başlayın
          </Link>
        </nav>
      </div>
    </header>
  );
}

const STEPS = ['Sınav', 'Anahtar', 'Kâğıtlar', 'Gönder'];

export function StepHeader({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <header className="site-head">
      <div className="wrap">
        <Logo />
        <ol className="stepper" aria-label="Yükleme adımları">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < current ? 'done' : n === current ? 'current' : '';
            return (
              <li key={label} className={`s ${state}`} aria-current={n === current ? 'step' : undefined}>
                <span className="dot">{n < current ? <Check size={11} width={3.5} /> : n}</span>
                <span className="txt">{label}</span>
              </li>
            );
          })}
        </ol>
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
        {left ?? <span className="small muted">SınavOku erken erişimde.</span>}
        {right ?? <span className="small muted">Fotoğraflar yalnızca okuma için işlenir, en geç 7 gün içinde silinir.</span>}
      </div>
      <div className="wrap site-foot-legal">
        <LegalLinks />
      </div>
    </footer>
  );
}
