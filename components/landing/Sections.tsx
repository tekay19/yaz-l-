import Link from 'next/link';
import { Board } from '@/components/Board';
import { PACKS, tl } from '@/lib/packs';

// The landing page below the hero, built around what the product really
// shows a teacher: the paper, the criteria, the evidence, the class's
// results. Each section carries a piece of the actual screen it talks
// about, with as few words as will do. Server-rendered throughout.

const OFFER = PACKS['Başlangıç'];

export function Steps() {
  return (
    <section className="lp-section" id="nasil">
      <div className="wrap">
        <header className="lp-head">
          <h2>Bir sınıfın kâğıtları, dört adımda.</h2>
        </header>
        <ol className="lp-steps">
          <li>
            <span className="lp-step-n" aria-hidden="true">1</span>
            <h3>Fotoğrafları yükleyin</h3>
            <p>Telefonla, birkaç kâğıt birden.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-thumbs">
                <span className="lp-thumb ok">uygun</span>
                <span className="lp-thumb ok">uygun</span>
                <span className="lp-thumb bad">bulanık, yeniden çekin</span>
              </div>
            </div>
          </li>
          <li>
            <span className="lp-step-n" aria-hidden="true">2</span>
            <h3>Ölçütleri onaylayın</h3>
            <p>Klasik sınavda puanlamayı siz belirlersiniz.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-crit"><span>Denklemi doğru kurar</span><b>4 puan</b></div>
              <div className="lp-crit"><span>Sonuç doğru</span><b>6 puan</b></div>
            </div>
          </li>
          <li>
            <span className="lp-step-n" aria-hidden="true">3</span>
            <h3>İşaretli yerlere bakın</h3>
            <p>Bütün kâğıtlara değil, yalnız sorulan yerlere.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-flag"><span>Mert K., 3. soru</span><em>okuma belirsiz</em></div>
              <div className="lp-flag"><span>Zeynep A., 5. soru</span><em>anahtarda yok</em></div>
            </div>
          </li>
          <li>
            <span className="lp-step-n" aria-hidden="true">4</span>
            <h3>Sonuçları alın</h3>
            <p>Excel ve PDF, panelde ve e&#8209;postanızda.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-mini-row"><span>Elif Yıldız</span><b>86</b></div>
              <div className="lp-mini-row"><span>Mert Kaya</span><b>72</b></div>
              <div className="lp-mini-row"><span>Zeynep Arslan</span><b>94</b></div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

export function Roles() {
  return (
    <section className="lp-section" id="is-bolumu">
      <div className="wrap">
        <header className="lp-head">
          <h2>Okumayı SınavOku yapar. Son söz sizin.</h2>
        </header>
        <div className="lp-roles">
          <div className="lp-role">
            <h3>SınavOku</h3>
            <ul>
              <li>Her satırı olduğu gibi okur, düzeltmez.</li>
              <li>Her puanı kâğıttan bir alıntıyla gösterir.</li>
              <li>Emin olmadığını tahmin etmez, size sorar.</li>
            </ul>
          </div>
          <div className="lp-role you">
            <h3>Siz</h3>
            <ul>
              <li>Kâğıtları telefonla çekersiniz.</li>
              <li>Ölçütleri ve işaretli yerleri onaylarsınız.</li>
              <li>Rapora yalnız onayladığınız puanlar geçer.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function KlasikSpotlight() {
  return (
    <section className="lp-section" id="klasik">
      <div className="wrap lp-split">
        <div>
          <h2>Klasik sınavda puanın gerekçesi kâğıdın üstünde.</h2>
          <ul className="lp-checks">
            <li>Kısmen doğru cevaba kısmi puan.</li>
            <li>İşlem hatası yalnız sonucun puanını götürür.</li>
            <li>Anahtardan farklı ama doğru yol tam puan alır.</li>
          </ul>
        </div>
        <figure className="lp-sheet" aria-label="Örnek değerlendirme: bir denklem sorusu">
          <figcaption className="lp-sheet-q"><span className="n">3.</span><span>2x + 3 = 11 denklemini işlem yaparak çözünüz.</span><b>10 puan</b></figcaption>
          <div className="lp-hand">
            <p>2x + 3 = 11</p>
            <p>2x = 11 − 3</p>
            <p>2x = 8</p>
            <p className="lp-err"><span className="lp-circ">x = 5</span><span className="lp-pen">4 olmalı</span></p>
          </div>
          <div className="lp-verdicts">
            <div className="lp-v met"><span className="lp-v-label">Denklemi doğru düzenler</span><q>2x = 11 − 3</q><b>3 / 3</b></div>
            <div className="lp-v met"><span className="lp-v-label">x&apos;i yalnız bırakır <i>Bölmede işlem hatası; yöntem doğru, puan kalır.</i></span><q>x = 5</q><b>3 / 3</b></div>
            <div className="lp-v miss"><span className="lp-v-label">Sonuç doğru</span><q>x = 5</q><b>0 / 4</b></div>
          </div>
          <div className="lp-total"><span>Önerilen puan</span><b>6 / 10</b></div>
        </figure>
      </div>
    </section>
  );
}

const BARS: [number, number][] = [[1, 92], [2, 81], [3, 64], [4, 23], [5, 77]];

export function Results() {
  return (
    <section className="lp-section" id="sonuclar">
      <div className="wrap lp-split reverse">
        <div className="lp-panel" role="img" aria-label="Örnek sonuç ekranı: 28 öğrenci, ortalama 71,4; 4. soruyu sınıfın yüzde 23'ü yapabildi">
          <div className="lp-panel-top">
            <span>9-B Matematik, 1. yazılı</span>
            <span className="lp-tag">Tamamlandı</span>
          </div>
          <div className="lp-panel-stats">
            <div><span>Öğrenci</span><b>28</b></div>
            <div><span>Ortalama</span><b>71,4</b></div>
            <div><span>En yüksek</span><b>98</b></div>
          </div>
          <p className="lp-panel-h">Soru başarısı</p>
          {BARS.map(([q, p]) => (
            <div key={q} className={`lp-bar${p < 50 ? ' low' : ''}`}>
              <span>{q}. soru</span><i><em style={{ width: `${p}%` }} /></i><b>%{p}</b>
            </div>
          ))}
          <p className="lp-panel-note">4. soruyu sınıfın dörtte biri yapabildi.</p>
        </div>
        <div>
          <h2>Sınıfın nerede takıldığını görün.</h2>
          <ul className="lp-checks">
            <li>Soru soru başarı ve puan dağılımı.</li>
            <li>Excel listesi not çizelgenize hazır.</li>
            <li>Sınıf listeleriniz ve geçmiş sınavlarınız tek yerde.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

const DETAILS = [
  ['Birkaç sayfalık sınav', 'Sayfalar öğrencinin adından birleşir.'],
  ['Kötü fotoğrafa anında uyarı', 'Kâğıt elinizdeyken yeniden çekersiniz.'],
  ['Okunamayan sayfa ücretsiz', 'Hakkı hesabınıza iade edilir.'],
  ['Puanlama tarzı sizin', 'Sıkı, dengeli ya da esnek.'],
  ['Optik form gerekmez', 'Kendi hazırladığınız kâğıt yeter.'],
  ['Fotoğraflar silinir', 'En geç 7 gün içinde, reklamsız.'],
];

export function Details() {
  return (
    <section className="lp-section" id="ozellikler">
      <div className="wrap">
        <header className="lp-head">
          <h2>Gerçek bir sınıfın kâğıtları için yapıldı.</h2>
        </header>
        <dl className="lp-details">
          {DETAILS.map(([t, d]) => (
            <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const FAQ = [
  ['Puanı yapay zekâ mı veriyor?', 'Yapay zekâ öneriyor, karar sizin. Klasik sınavda puanlama ölçütlerini siz onaylarsınız; sistemin emin olmadığı her yer size gösterilir ve rapora sizin onayladığınız puanlar geçer.'],
  ['Öğrencinin el yazısı çok kötüyse?', 'Okuyamadığı kelimeyi uydurmaz, işaretler. Her sayfa iki ayrı okumadan geçer; okumalar uyuşmazsa cevap "okuma belirsiz" olarak size gelir ve okunan metni düzeltebilirsiniz.'],
  ['Optik form bastırmam gerekiyor mu?', 'Hayır. Kendi hazırladığınız sınav kâğıdı yeterli; okula tarayıcı da gerekmez, telefonun kamerası yeter.'],
  ['Kaç sayfa hakkı harcanır?', 'Her öğrenci sayfası için bir sayfa. Cevap anahtarı sayılmaz, okunamayan sayfaların hakkı iade edilir.'],
  ['Fotoğraflarım ve sonuçlar ne oluyor?', 'Fotoğraflar yalnızca okuma için işlenir ve en geç 7 gün içinde (kontrolünüzü bekleyen sınavda 14 gün) silinir. Sonuçlar 30 gün panelinizde kalır; raporu indirip saklayabilirsiniz.'],
  ['Abonelik var mı?', 'Yok. Paket alırsınız, sayfalar bitene kadar geçerlidir. Otomatik yenileme yoktur.'],
];

export function Faq() {
  return (
    <section className="lp-section" id="sss">
      <div className="wrap lp-faq-wrap">
        <header className="lp-head">
          <h2>Öğretmenlerin ilk sordukları</h2>
        </header>
        <div className="lp-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// The page ends where it began: on the board, with the one thing to do.
export function Closing() {
  return (
    <section className="lp-closing">
      <div className="wrap">
        <Board className="lp-closing-board">
          <div className="lp-closing-inner">
            <h2 className="chalk">Bu hafta okunacak kâğıdınız var mı?</h2>
            <div className="lp-closing-act">
              <Link href="/yukle" className="btn lp-chalk-btn">Kâğıtlarınızı yükleyin</Link>
              <p className="lp-closing-note chalk">ilk siparişe {OFFER.pages} sayfa {tl(OFFER.price)}</p>
            </div>
          </div>
        </Board>
      </div>
    </section>
  );
}
