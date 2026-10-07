import Link from 'next/link';
import HeroDemo from '@/components/HeroDemo';
import { Board, ChalkDefs } from '@/components/Board';
import { PACKS, tl } from '@/lib/packs';

const OFFER = PACKS['Başlangıç'];

// The first screen is the classroom board: one sentence in chalk, the offer
// in yellow chalk under the button, and beside them the whole product in
// three moves (photo, red pen, e-mail) that play once on load.
export default function Hero() {
  return (
    <section className="lp-hero">
      <ChalkDefs />
      <div className="wrap">
        <Board className="lp-board">
          <div className="lp-board-grid">
            <div className="lp-board-text">
              <h1 className="lp-board-title chalk">Yazılıları siz okumayın.</h1>
              <p className="lp-board-lead">Kâğıtları telefonla çekin; puan listesi e&#8209;postanıza gelsin.</p>
              <div className="lp-board-cta">
                <Link href="/yukle" className="btn lp-chalk-btn">Kâğıtlarınızı yükleyin</Link>
                <a href="#nasil" className="btn lp-chalk-ghost">Nasıl çalışır</a>
              </div>
              <p className="lp-chalk-note">
                <svg className="lp-chalk-arrow chalk" viewBox="0 0 70 46" aria-hidden="true">
                  <path d="M64 40C46 42 22 34 12 10" />
                  <path d="M5 17l7-8 9 5" />
                </svg>
                <span className="chalk">
                  ilk siparişe {OFFER.pages} sayfa <b>{tl(OFFER.price)}</b>{' '}
                  <s aria-label={`normal fiyatı ${tl(OFFER.was ?? OFFER.price)}`}>{tl(OFFER.was ?? OFFER.price)}</s>
                </span>
              </p>
            </div>
            <div className="lp-board-scene" id="ornek">
              <HeroDemo autoPlay />
            </div>
          </div>
        </Board>
      </div>
    </section>
  );
}
