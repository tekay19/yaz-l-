import type { Metadata } from 'next';
import Link from 'next/link';
import Tracker from '@/components/Tracker';
import { Logo, LegalLinks } from '@/components/Chrome';

export const metadata: Metadata = {
  title: 'Teknik sorun — SınavOku',
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <Tracker page="hata" />

      <header className="site-head">
        <div className="wrap">
          <Logo />
          <span className="small muted">İşlem kodu PAY-503</span>
        </div>
      </header>

      <main>
        <div className="wrap checkout">
          <div>
            <span className="error-mark" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.8L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
              </svg>
            </span>

            <h1 style={{ fontSize: 'clamp(28px,3.8vw,40px)' }}>Teknik bir sorun oluştu</h1>

            <div className="notice" style={{ marginTop: 28, maxWidth: 560 }}>
              <span className="ico" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <div>
                <h3>Herhangi bir ücret alınmadı</h3>
                <p>
                  Ödeme veya provizyon oluşturulmadı; kartınızdan tahsilat yapılmadı.
                </p>
              </div>
            </div>

            <p className="small muted" style={{ marginTop: 24, maxWidth: '54ch' }}>
              Kart bilgileriniz SınavOku sunucularına gönderilmedi. Görselleriniz doğrulamadan sonra kalıcı olarak saklanmadı.
            </p>
          </div>

          <aside className="card summary">
            <h2 style={{ fontSize: 21 }}>Daha sonra yeniden deneyin</h2>
            <p className="small muted" style={{ margin: '8px 0 20px' }}>
              İşlemi yeniden denemek için yükleme adımına dönebilirsiniz.
            </p>
            <Link href="/yukle" className="btn btn-primary btn-block">
              Yükleme adımına dönün
            </Link>
          </aside>
        </div>
      </main>

      <footer className="site-foot">
        <div className="wrap">
          <Link href="/" className="small" style={{ color: 'var(--board)', fontWeight: 600 }}>
            ← Ana sayfaya dönün
          </Link>
          <span className="small muted">
            Destek:{' '}
            <a href="mailto:admin@zakrom.com" style={{ color: 'var(--board)', fontWeight: 600 }}>
              admin@zakrom.com
            </a>
          </span>
        </div>
      <div className="wrap site-foot-legal"><LegalLinks /></div></footer>
    </>
  );
}
