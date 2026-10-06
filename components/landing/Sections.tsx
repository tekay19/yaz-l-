import Link from 'next/link';
import { PACKS, tl } from '@/lib/packs';

// The landing page below the hero, built around what the product really
// shows a teacher: the paper, the criteria, the evidence, the class's
// results. No stock icons standing in for features; each section carries a
// piece of the actual screen it talks about. Server-rendered throughout.

const OFFER = PACKS['Başlangıç'];

export function Roles() {
  return (
    <section className="lp-section" id="nasil">
      <div className="wrap">
        <header className="lp-head">
          <p className="lp-eyebrow">İş bölümü</p>
          <h2>Okumayı SınavOku yapar. Son sözü siz söylersiniz.</h2>
        </header>
        <div className="lp-roles">
          <div className="lp-role">
            <h3><span className="lp-tag green">SınavOku</span></h3>
            <ol>
              <li><strong>Her satırı olduğu gibi okur.</strong> Yazım hatasını düzeltmez, eksik adımı kendisi tamamlamaz.</li>
              <li><strong>Cevabı ölçütlerinizle karşılaştırır.</strong> Verdiği her puan için kâğıttan alıntı gösterir.</li>
              <li><strong>Emin olmadığını tahmin etmez,</strong> size işaretler: okunamayan kelime, şüpheli isim, anahtarda olmayan bir fikir.</li>
              <li><strong>Puan listesini ve sınıf analizini hazırlar.</strong></li>
            </ol>
          </div>
          <div className="lp-role you">
            <h3><span className="lp-tag ink">Siz</span></h3>
            <ol>
              <li><strong>Kâğıtları ve anahtarı telefonla çekersiniz.</strong> Bulanık bir fotoğrafı sistem o an söyler.</li>
              <li><strong>Klasik sınavda puanlama ölçütlerini onaylarsınız.</strong> Anahtarınızdan taslak hazırlanır, siz düzenlersiniz.</li>
              <li><strong>Yalnızca işaretli yerlere bakarsınız.</strong> İsterseniz bir puanı değiştirir ya da bir cevabı kabul edersiniz.</li>
              <li><strong>Onayladığınız puanlar rapora geçer.</strong></li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Steps() {
  return (
    <section className="lp-section lp-paper">
      <div className="wrap">
        <header className="lp-head">
          <p className="lp-eyebrow">Nasıl çalışır</p>
          <h2>Dört adım, bir sınıf.</h2>
        </header>
        <ol className="lp-steps">
          <li>
            <span className="lp-step-n">1</span>
            <h3>Kâğıtları yükleyin</h3>
            <p>Telefonun kamerasıyla, birkaç kâğıt birden. Her fotoğraf yüklenirken kontrol edilir.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-thumbs">
                <span className="lp-thumb ok">uygun</span>
                <span className="lp-thumb ok">uygun</span>
                <span className="lp-thumb bad">bulanık · yeniden çekin</span>
              </div>
            </div>
          </li>
          <li>
            <span className="lp-step-n">2</span>
            <h3>Ölçütleri onaylayın</h3>
            <p>Klasik sınavda anahtarınızdan puanlama ölçütleri çıkar. Puanları ve kabul edilecek cevapları siz belirlersiniz.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-crit"><span>Denklemi doğru kurar</span><b>4 puan</b></div>
              <div className="lp-crit"><span>Sonuç doğru, kendi adımlarından</span><b>6 puan</b></div>
            </div>
          </li>
          <li>
            <span className="lp-step-n">3</span>
            <h3>İşaretli yerlere bakın</h3>
            <p>Bütün kâğıtları değil, yalnızca sistemin size sorduğu yerleri kontrol edersiniz.</p>
            <div className="lp-frag" aria-hidden="true">
              <div className="lp-flag"><span className="dot" />Mert K. · 3. soru<em>okuma belirsiz</em></div>
              <div className="lp-flag"><span className="dot" />Zeynep A. · 5. soru<em>anahtarda yok, doğru</em></div>
            </div>
          </li>
          <li>
            <span className="lp-step-n">4</span>
            <h3>Sonuçları alın</h3>
            <p>Puan listesi, soru soru başarı ve sınıf özeti. Panelden indirin; e-postanıza da gelir.</p>
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

export function KlasikSpotlight() {
  return (
    <section className="lp-section" id="klasik">
      <div className="wrap lp-split">
        <div>
          <p className="lp-eyebrow">Klasik sınavlar</p>
          <h2>Puanın gerekçesi kâğıdın üstünde.</h2>
          <p className="lp-lead">
            Açık uçlu cevapta SınavOku tek bir not vermez; cevabı ölçüt ölçüt değerlendirir ve her kararı
            öğrencinin kendi yazdığıyla gösterir. Siz bir bakışta neden o puanı aldığını görürsünüz.
          </p>
          <ul className="lp-checks">
            <li>Kısmen doğru cevaba kısmi puan.</li>
            <li>İşlem hatası yalnızca sonuç puanını götürür; doğru kurulan adımlar sayılır.</li>
            <li>Anahtardakinden farklı ama doğru bir yol tam puan alır.</li>
            <li>Anahtarda olmayan doğru bir fikri kabul eder ve size ayrıca sorar.</li>
            <li>Yalnızca sonuç yazıp işlem göstermeyen cevap, istediğinizde puan almaz.</li>
          </ul>
        </div>
        <figure className="lp-sheet" aria-label="Örnek değerlendirme: bir denklem sorusu">
          <figcaption className="lp-sheet-q">3. <span>2x + 3 = 11 denklemini işlem yaparak çözünüz.</span> <b>10 puan</b></figcaption>
          <div className="lp-hand">
            <p>2x + 3 = 11</p>
            <p>2x = 11 − 3</p>
            <p>2x = 8</p>
            <p className="lp-err"><span className="lp-circ">x = 5</span><span className="lp-pen">4 olmalı</span></p>
          </div>
          <div className="lp-verdicts">
            <div className="lp-v met"><span className="lp-v-label">Denklemi doğru düzenler</span><q>2x = 11 − 3</q><b>3 / 3</b></div>
            <div className="lp-v met"><span className="lp-v-label">x&apos;i yalnız bırakır <i>bölmede işlem hatası; yöntem doğru, puan kalır</i></span><q>x = 5</q><b>3 / 3</b></div>
            <div className="lp-v miss"><span className="lp-v-label">Sonuç doğru</span><q>x = 5</q><b>0 / 4</b></div>
          </div>
          <div className="lp-total"><span>Önerilen puan</span><b>6 / 10</b></div>
        </figure>
      </div>
    </section>
  );
}

export function Results() {
  return (
    <section className="lp-section lp-paper" id="sonuclar">
      <div className="wrap lp-split reverse">
        <div className="lp-panel" aria-label="Örnek sonuç ekranı">
          <div className="lp-panel-top">
            <span>9-B Matematik · 1. yazılı</span>
            <span className="lp-tag green">Tamamlandı</span>
          </div>
          <div className="lp-panel-stats">
            <div><span>Öğrenci</span><b>28</b></div>
            <div><span>Ortalama</span><b>71,4</b></div>
            <div><span>En yüksek</span><b>98</b></div>
          </div>
          <p className="lp-panel-h">Soru başarısı</p>
          {[['1', 92], ['2', 81], ['3', 64], ['4', 23], ['5', 77]].map(([q, p]) => (
            <div key={q} className={`lp-bar${Number(p) < 50 ? ' low' : ''}`}>
              <span>{q}. soru</span><i><em style={{ width: `${p}%` }} /></i><b>%{p}</b>
            </div>
          ))}
          <p className="lp-panel-note">4. soruyu sınıfın dörtte biri yapabildi.</p>
        </div>
        <div>
          <p className="lp-eyebrow">Sonuçlar ve panel</p>
          <h2>Sınıfın nerede takıldığını görün.</h2>
          <p className="lp-lead">
            Her sınavın sonuçları öğretmen panelinizde: öğrenci puanları, soru soru başarı, puan dağılımı.
            Excel listesini not çizelgenize aktarın, tek sayfalık PDF özeti zümre toplantısına götürün.
          </p>
          <ul className="lp-checks">
            <li>Sınıf listelerinizi bir kez kaydedin; isimler kâğıtlarla listeye göre eşleşir.</li>
            <li>Geçmiş sınavlarınız ve raporlarınız tek yerde.</li>
            <li>Sayfa hakkınızı ve ödemelerinizi panelden takip edin.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

const DETAILS = [
  ['Birkaç sayfalık sınavlar', 'Sayfalar öğrencinin adından aynı kâğıtta toplanır; öğrenci öğrenci de çekseniz deste deste de.'],
  ['Kötü fotoğrafa anında uyarı', 'Bulanık, karanlık ya da uzaktan çekilmiş bir kâğıdı yüklerken söyler; kâğıt elinizdeyken yeniden çekersiniz.'],
  ['Okunamayan sayfa ücretsiz', 'Okunamayan her sayfanın hakkı hesabınıza iade edilir. Cevap anahtarı sayfa hakkından düşmez.'],
  ['Puanlama tarzı sizin', 'Sıkı, dengeli ya da esnek. İsterseniz sınava bir not bırakın: "yazım hatalarını önemseme" gibi.'],
  ['Çoktan seçmeli de var', 'Optik form bastırmadan, kendi hazırladığınız kâğıtla. Doğru, yanlış ve boş sayıları öğrenci öğrenci listelenir.'],
  ['Fotoğraflar silinir', 'Kâğıtlar yalnızca okuma için işlenir ve en geç 7 gün içinde silinir. Reklam için kullanılmaz.'],
];

export function Details() {
  return (
    <section className="lp-section" id="ozellikler">
      <div className="wrap">
        <header className="lp-head">
          <p className="lp-eyebrow">Ayrıntılar</p>
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
    <section className="lp-section lp-paper" id="sss">
      <div className="wrap lp-faq-wrap">
        <header className="lp-head">
          <p className="lp-eyebrow">Sorular</p>
          <h2>Öğretmenlerin ilk sorduğu şeyler.</h2>
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

export function Closing() {
  return (
    <section className="lp-closing">
      <div className="wrap">
        <h2>Bu hafta okunacak kâğıdınız var mı?</h2>
        <p>İlk siparişe özel {OFFER.pages} sayfa {tl(OFFER.price)}. Abonelik yok.</p>
        <div className="lp-cta-row">
          <Link href="/yukle" className="btn lp-btn-light">Kâğıtlarınızı yükleyin</Link>
          <Link href="/hesap" className="lp-link-light">Hesabınıza giriş yapın</Link>
        </div>
      </div>
    </section>
  );
}
