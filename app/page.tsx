import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/Chrome';
import HeroDemo from '@/components/HeroDemo';
import Pricing from '@/components/Pricing';
import Sections from '@/components/Sections';
import Tracker from '@/components/Tracker';

export default function Home() {
  return (
    <>
      <Tracker page="index" />
      <SiteHeader />

      <section className="hero">
        <div className="wrap hero-demo">
          <h1>Sınav okumak bütün akşamınızı almasın.</h1>
          <p className="lead">
            Sınıfın kâğıtlarını telefonla çekiyorsunuz, yapay zeka okuyup puanlıyor, tablo size
            geliyor. Yalnızca çoktan seçmeli değil: klasik soruların el yazısını da okuyup kısmi puan veriyor.
            Aşağıdaki örnek kâğıtta ikisi de var; düğmeye basın, nasıl okuduğunu görün.
          </p>

          <HeroDemo />

          <p className="hero-note">
            <svg
              width="17"
              height="17"
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
            Kâğıtlarınız üçüncü kişilerle paylaşılmaz, sınav sonrası silinir.
          </p>
        </div>
      </section>

      <Sections />

      <Pricing />

      <section className="bg-board closing">
        <div className="wrap">
          <h2>Bu hafta sınavınız var mı?</h2>
          <p>Kâğıtları çekmeniz yeterli. Tablo hazır olunca e-postanıza düşer.</p>
          <Link href="/paket" className="btn btn-primary">
            Kâğıtlarınızı yükleyin
          </Link>
        </div>
      </section>

      <SiteFooter
        left={<span className="small muted">SınavOku · erken erişim</span>}
        right={
          <span className="small muted">
            Destek:{' '}
            <a href="mailto:admin@zakrom.com" style={{ color: 'var(--board)', fontWeight: 600 }}>
              admin@zakrom.com
            </a>
          </span>
        }
      />
    </>
  );
}
