import Link from 'next/link';
import HeroDemo from '@/components/HeroDemo';
import { PACKS, tl } from '@/lib/packs';

const OFFER = PACKS['Başlangıç'];

// The first screen answers three questions in order: what this is (it reads
// and grades exam papers), what the teacher keeps (the final say), and how
// to start. The desk beside it shows a graded sheet rather than describing one.
export default function Hero() {
  return (
    <section className="lp-hero">
      <div className="wrap lp-hero-grid">
        <div className="lp-hero-text">
          <h1>Kâğıtları siz çekin, okumayı ve puanlamayı SınavOku yapsın.</h1>
          <p className="lp-hero-lead">
            Çoktan seçmeli ve klasik sınavlar. El yazısını okur, cevap anahtarınıza göre puan önerir ve emin
            olmadığı her yeri size gösterir. Siz kontrol edip onaylarsınız; puan listesi Excel ve PDF olarak
            e-postanıza gelir.
          </p>
          <div className="lp-cta-row">
            <Link href="/yukle" className="btn btn-primary lp-btn">Kâğıtlarınızı yükleyin</Link>
            <a href="#fiyat" className="btn btn-ghost lp-btn">Fiyatları görün</a>
          </div>
          <p className="lp-hero-small">
            İlk siparişinizde {OFFER.pages} sayfa <b>{tl(OFFER.price)}</b>. Abonelik yok; okunamayan sayfanın hakkı
            iade edilir.
          </p>
        </div>
        <div className="lp-hero-desk" id="ornek">
          <HeroDemo />
        </div>
      </div>
      <div className="wrap">
        <ul className="lp-facts" aria-label="Kısaca">
          <li><b>Optik form gerekmez</b><span>Kendi hazırladığınız kâğıt ve telefonunuzun kamerası yeter.</span></li>
          <li><b>Anahtar ücretsiz</b><span>Cevap anahtarı sayfa hakkından düşmez.</span></li>
          <li><b>Okunamayan sayfa iade</b><span>Hakkı hesabınıza geri yüklenir.</span></li>
          <li><b>Fotoğraflar silinir</b><span>Yalnızca okuma için işlenir, en geç 7 gün içinde silinir.</span></li>
        </ul>
      </div>
    </section>
  );
}
