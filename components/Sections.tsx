// The static marketing sections of the landing page, ported from the
// original HTML. Everything here is server-rendered — only the hero demo and
// the pricing card need the client.

export default function Sections() {
  return (
    <>
      <div className="contrast">
        <div className="wrap">
          <div className="contrast-item was">
            <span className="big">3 saat</span>
            <span className="muted">24 kâğıdı elle okuyup deftere geçirmek</span>
          </div>
          <svg className="contrast-arrow" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          <div className="contrast-item now">
            <span className="big">4 dakika</span>
            <span className="muted">aynı sınıf, SınavOku'da</span>
          </div>
        </div>
      </div>


      <section id="nasil" className="bg-paper">
        <div className="wrap">
          <div className="section-head">
            <h2>Nasıl çalışıyor</h2>
            <p className="lead">
              Okumayı yapay zeka yapıyor: fotoğraftaki işaretleri ve el yazısını çözüp
              sizin anahtarınızla karşılaştırıyor. Kendi hazırladığınız sınav kâğıdı yeterli;
              optik form bastırmanız ya da okula tarayıcı taşımanız gerekmez.
            </p>
          </div>

          <div className="steps">
            <div className="step">
              <span className="step-n">1</span>
              <h3>Kâğıtları masaya dizip çekin</h3>
              <p>Sıraya koymanıza gerek yok. Yirmi kâğıdı da elli kâğıdı da tek seferde yükleyebilirsiniz. Kâğıt eğri durmuş, kenarı gölgede kalmış ya da biraz buruşmuş olabilir.</p>
              <div className="step-visual">
                <svg viewBox="0 0 320 148" width="100%" height="100%" role="img" aria-label="Masaya dizilmiş kâğıtların telefonla fotoğraflanması">
                  <rect width="320" height="148" fill="#F4F6F4" />
                  <g>
                    <rect x="34" y="34" width="62" height="80" rx="2" fill="#fff" stroke="#DFE4E0" transform="rotate(-6 65 74)" />
                    <rect x="106" y="30" width="62" height="80" rx="2" fill="#fff" stroke="#DFE4E0" transform="rotate(3 137 70)" />
                    <rect x="178" y="36" width="62" height="80" rx="2" fill="#fff" stroke="#DFE4E0" transform="rotate(-2 209 76)" />
                    <g stroke="#DFE4E0" strokeWidth="2" strokeLinecap="round">
                      <path d="M44 54h40M44 64h34M44 74h40M44 84h28" transform="rotate(-6 65 74)" />
                      <path d="M116 50h40M116 60h34M116 70h40M116 80h28" transform="rotate(3 137 70)" />
                      <path d="M188 56h40M188 66h34M188 76h40M188 86h28" transform="rotate(-2 209 76)" />
                    </g>
                  </g>
                  <g transform="translate(244 20)">
                    <rect x="0" y="0" width="52" height="86" rx="8" fill="#17201C" />
                    <rect x="4" y="4" width="44" height="78" rx="5" fill="#14513C" opacity=".22" />
                    <circle cx="26" cy="30" r="9" fill="none" stroke="#fff" strokeWidth="2.4" />
                    <path d="M17 52h18M17 60h12" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".6" />
                  </g>
                </svg>
              </div>
            </div>

            <div className="step">
              <span className="step-n">2</span>
              <h3>Kendi anahtarınızı da çekin</h3>
              <p>Doğru şıkları işaretlediğiniz optik formu ya da cevapları yazdığınız kâğıdı fotoğraflayıp yüklüyorsunuz. Öğrenci kâğıtları bununla karşılaştırılıyor.</p>
              <div className="step-visual">
                <svg viewBox="0 0 320 148" width="100%" height="100%" role="img" aria-label="Öğretmenin doldurduğu cevap anahtarı kâğıdı">
                  <rect width="320" height="148" fill="#F4F6F4" />
                  <rect x="96" y="16" width="128" height="116" rx="3" fill="#fff" stroke="#DFE4E0" />
                  <rect x="96" y="16" width="128" height="20" fill="#E9F1EC" />
                  <text x="108" y="30" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="10" fontWeight="700" fill="#14513C">Cevap anahtarı</text>
                  <g>
                    <text x="108" y="56" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9" fontWeight="700" fill="#8A938D">1</text>
                    <circle cx="128" cy="53" r="5.5" fill="#14513C" />
                    <circle cx="145" cy="53" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="162" cy="53" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="179" cy="53" r="5.5" fill="none" stroke="#C9CFC9" />
                  </g>
                  <g>
                    <text x="108" y="78" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9" fontWeight="700" fill="#8A938D">2</text>
                    <circle cx="128" cy="75" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="145" cy="75" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="162" cy="75" r="5.5" fill="#14513C" />
                    <circle cx="179" cy="75" r="5.5" fill="none" stroke="#C9CFC9" />
                  </g>
                  <g>
                    <text x="108" y="100" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9" fontWeight="700" fill="#8A938D">3</text>
                    <circle cx="128" cy="97" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="145" cy="97" r="5.5" fill="#14513C" />
                    <circle cx="162" cy="97" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="179" cy="97" r="5.5" fill="none" stroke="#C9CFC9" />
                  </g>
                  <g>
                    <text x="108" y="122" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9" fontWeight="700" fill="#8A938D">4</text>
                    <circle cx="128" cy="119" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="145" cy="119" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="162" cy="119" r="5.5" fill="none" stroke="#C9CFC9" />
                    <circle cx="179" cy="119" r="5.5" fill="#14513C" />
                  </g>
                  <g transform="translate(232 44)">
                    <rect x="0" y="0" width="46" height="60" rx="6" fill="#17201C" />
                    <circle cx="23" cy="22" r="7" fill="none" stroke="#fff" strokeWidth="2" />
                    <path d="M14 40h18" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
                  </g>
                </svg>
              </div>
            </div>

            <div className="step">
              <span className="step-n">3</span>
              <h3>Tabloyu e-postanızdan alın</h3>
              <p>Birkaç dakika sonra puan listesi e-postanıza düşüyor. Hangi soruyu sınıfın kaçta kaçının yaptığı da aynı dosyanın içinde.</p>
              <div className="step-visual">
                <svg viewBox="0 0 320 148" width="100%" height="100%" role="img" aria-label="E-postaya gelen Excel raporu">
                  <rect width="320" height="148" fill="#F4F6F4" />
                  <rect x="34" y="24" width="252" height="100" rx="8" fill="#fff" stroke="#DFE4E0" />
                  <rect x="34" y="24" width="252" height="24" rx="8" fill="#14513C" />
                  <rect x="34" y="40" width="252" height="8" fill="#14513C" />
                  <text x="46" y="40" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="10" fontWeight="600" fill="#fff">sinif-9b-matematik.xlsx</text>
                  <g fontFamily="Plus Jakarta Sans, sans-serif" fontSize="10" fill="#17201C">
                    <text x="48" y="68">Elif Y.</text><text x="238" y="68" fontWeight="700">84</text>
                    <text x="48" y="88">Mert K.</text><text x="238" y="88" fontWeight="700">70</text>
                    <text x="48" y="108">Zeynep D.</text><text x="234" y="108" fontWeight="700">95</text>
                  </g>
                  <g stroke="#EBEFEC"><path d="M44 76h232M44 96h232" /></g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section>
        <div className="wrap">
          <div className="section-head">
            <h2>Elinize ne geçiyor</h2>
            <p className="lead">
              Puan listesinin yanında sınıfın nerede takıldığını gösteren bir analiz de geliyor.
              Zümre toplantısında ya da veli görüşmesinde işinize yarar.
            </p>
          </div>

          <div className="output-grid">
            <div className="output-list">
              <div className="output-item">
                <span className="ico" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z" /><path d="M3 9h18M9 9v12" /></svg></span>
                <div>
                  <h3>Öğrenci puan listesi</h3>
                  <p>Ad soyad, doğru, yanlış, puan. Excel'de açılıyor; sütunları olduğu gibi kendi not çizelgenize yapıştırabilirsiniz.</p>
                </div>
              </div>
              <div className="output-item">
                <span className="ico" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18" /><path d="M6 20V10M12 20V4M18 20v-7" /></svg></span>
                <div>
                  <h3>Soru soru başarı oranı</h3>
                  <p>Hangi soruyu kaç öğrenci doğru yapmış, listede görünüyor. Sınıfın yarısından fazlası bir soruyu kaçırdıysa fark etmemeniz zor.</p>
                </div>
              </div>
              <div className="output-item">
                <span className="ico" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6" /></svg></span>
                <div>
                  <h3>Tek sayfalık sınıf özeti (PDF)</h3>
                  <p>Ortalama, en yüksek, en düşük ve puan dağılımı. Yazdırıp dosyaya koyabileceğiniz düzende.</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '4px' }}>Soru soru başarı oranı</h3>
              <p className="small muted" style={{ marginBottom: '20px' }}>9-B Matematik, örnek rapor</p>
              <div className="bars">
                <div className="bar-row"><span className="muted">12. soru</span><span className="bar-track"><span className="bar-fill" style={{ width: '92%' }}></span></span><span className="pct">92%</span></div>
                <div className="bar-row"><span className="muted">13. soru</span><span className="bar-track"><span className="bar-fill" style={{ width: '75%' }}></span></span><span className="pct">75%</span></div>
                <div className="bar-row low"><span className="muted">14. soru</span><span className="bar-track"><span className="bar-fill" style={{ width: '21%' }}></span></span><span className="pct">21%</span></div>
                <div className="bar-row"><span className="muted">15. soru</span><span className="bar-track"><span className="bar-fill" style={{ width: '67%' }}></span></span><span className="pct">67%</span></div>
                <div className="bar-row"><span className="muted">16. soru</span><span className="bar-track"><span className="bar-fill" style={{ width: '88%' }}></span></span><span className="pct">88%</span></div>
              </div>
              <p className="small" style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--line-soft)' }}>
                14. soruyu sınıfın ancak beşte biri yapabilmiş. Hangi konuyu tekrar edeceğiniz belli.
              </p>
            </div>
          </div>
        </div>
      </section>


      <section id="ozellikler" className="bg-paper">
        <div className="wrap">
          <div className="section-head">
            <h2>Ayrıntılar</h2>
            <p className="lead">Öğretmenlerin en çok sorduğu şeyler burada.</p>
          </div>
          <div className="features">
            <div className="feature">
              <span className="ico" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z" /><path d="M8 2v4M16 2v4M4 10h16" /></svg></span>
              <h3>Sayfa sayfa ödeme</h3>
              <p>Kalabalık sınıflar da sığıyor. Paketinizdeki sayfa hakkı bitene kadar istediğiniz sınavı yüklüyorsunuz.</p>
            </div>
            <div className="feature">
              <span className="ico" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h12v14H3z" /><path d="M17 8h4v11h-4" /><path d="M8 5v14" /></svg></span>
              <h3>Arkalı önlü kâğıtlar</h3>
              <p>Ön yüzü çekin, arkayı çevirip bir daha çekin. İkisini aynı öğrencinin kâğıdında birleştiriyor.</p>
            </div>
            <div className="feature">
              <span className="ico" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg></span>
              <h3>El yazısını yapay zeka okur</h3>
              <p>Üstteki ad soyadı çözüp kâğıdı doğru öğrenciyle eşleştiriyor. Okuyamadığı bir isim çıkarsa uydurmuyor, raporda size soruyor.</p>
            </div>
            <div className="feature">
              <span className="ico" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg></span>
              <h3>Klasik sınav da olur</h3>
              <p>Cevapları yazdığınız anahtar kâğıdını yüklüyorsunuz. Yapay zeka öğrencinin yazdığını sizin anahtarınızla karşılaştırıp puan öneriyor, kabul etmek size kalıyor.</p>
            </div>
            <div className="feature">
              <span className="ico" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg></span>
              <h3>Excel ve PDF</h3>
              <p>Dosya e-postayla geliyor. Bilgisayarda Excel, telefonda da açılıyor.</p>
            </div>
            <div className="feature">
              <span className="ico" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></span>
              <h3>Fotoğraflar sizde kalır</h3>
              <p>Kimseyle paylaşılmıyor, reklam için kullanılmıyor. Raporunuz gittikten sonra siliniyor.</p>
            </div>
          </div>
        </div>
      </section>


      <section className="bg-paper">
        <div className="wrap">
          <div className="section-head">
            <h2>Sık sorulanlar</h2>
          </div>
          <div className="faq">
            <details className="faq-item">
              <summary className="faq-q">
                Kâğıtlar eğri ya da gölgeli çıkarsa okuyabiliyor mu?
                <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p className="faq-a">Evet. Kâğıdın eğri durması, kenarda gölge olması veya hafif buruşukluk sorun değil. Yalnızca yazıların okunur olması ve kâğıdın tamamının kadraja girmesi yeterli. Okunamayan bir kâğıt olursa raporda ayrıca belirtilir, o kâğıdı yeniden çekip ekleyebilirsiniz.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">
                Klasik (açık uçlu) soruları nasıl değerlendiriyor?
                <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p className="faq-a">Cevapları kendi el yazınızla doldurduğunuz anahtar kâğıdını da yüklüyorsunuz. Öğrencinin yazdığı, sizin anahtarınızla karşılaştırılıyor ve her soru için bir puan öneriliyor. Öneriyi olduğu gibi kabul edebilir ya da değiştirebilirsiniz; son karar sizde.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">
                Hangi kâğıdın hangi öğrenciye ait olduğunu nereden biliyor?
                <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p className="faq-a">Kâğıdın üstündeki ad soyad bölümünü okur ve sınıf listenizle eşleştirir. Kâğıtları alfabetik sıraya dizmeniz ya da numaralandırmanız gerekmez. Eşleşmeyen bir isim olursa raporda size sorar.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">
                Optik form ya da özel bir kâğıt kullanmam gerekiyor mu?
                <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p className="faq-a">Hayır. Kendi hazırladığınız sınav kâğıdını kullanabilirsiniz. Optik okuyucu, özel form veya tarayıcı gerekmiyor; telefon kamerası yeterli.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">
                Yapay zeka yanlış okursa ne oluyor?
                <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p className="faq-a">Emin olamadığı yeri kendi kafasına göre doldurmuyor; o soruyu ya da o kâğıdı işaretleyip raporda size gösteriyor. Klasik sorularda verdiği puan zaten bir öneri, onaylayan sizsiniz. Puan defterine ne geçeceğine her zaman öğretmen karar verir.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">
                Kâğıt fotoğrafları ve öğrenci isimleri ne oluyor?
                <svg className="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <p className="faq-a">Yalnızca raporunuzu hazırlamak için kullanılır, üçüncü kişilerle paylaşılmaz ve reklam amacıyla işlenmez. Rapor size teslim edildikten sonra fotoğraflar silinir.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
