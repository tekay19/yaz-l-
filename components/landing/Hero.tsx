import Link from 'next/link';
import HeroDemo from '@/components/HeroDemo';
import { PACKS, tl } from '@/lib/packs';

const OFFER = PACKS['Başlangıç'];

// The first screen answers three questions in order: what this is (it reads
// and grades exam papers), what the teacher keeps (the final say), and how
// to start. The sample paper below shows it rather than describing it.
export default function Hero() {
  return (
    <section className="lp-hero">
      <div className="wrap">
        <div className="lp-hero-text">
          <p className="lp-eyebrow">Öğretmenler için sınav okuma</p>
          <h1>
            Kâğıtları siz çekin,{' '}
            <span className="lp-mark">okumayı ve puanlamayı</span>{' '}
            SınavOku yapsın.
          </h1>
          <p className="lp-hero-lead">
            Çoktan seçmeli ve klasik sınavlar. El yazısını okur, cevap anahtarınıza göre puan önerir ve emin
            olmadığı her yeri size gösterir. Siz kontrol edip onaylarsınız; puan listesi Excel ve PDF olarak hazır.
          </p>
          <div className="lp-cta-row">
            <Link href="/yukle" className="btn btn-primary lp-btn">Kâğıtlarınızı yükleyin</Link>
            <a href="#ornek" className="btn btn-ghost lp-btn">Örnek kâğıdı görün</a>
          </div>
          <p className="lp-hero-small">
            İlk siparişe özel {OFFER.pages} sayfa <b>{tl(OFFER.price)}</b>
            <span aria-hidden="true"> · </span>abonelik yok<span aria-hidden="true"> · </span>okunamayan sayfa iade
          </p>
          <span className="lp-pen-note" aria-hidden="true">puanı siz onaylarsınız</span>
        </div>
        <div className="lp-hero-demo" id="ornek">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
