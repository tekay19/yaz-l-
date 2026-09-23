import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Gizlilik Politikası — SınavOku', robots: { index: false } };

export default function Page() {
  return <>
    <header className="site-head"><div className="wrap"><Logo /><Link href="/">Ana sayfa</Link></div></header>
    <main><article className="wrap legal-copy">
      <h1>Gizlilik Politikası</h1>
      <p className="small muted" style={{ marginTop: 16 }}>Taslak · Son güncelleme: 22 Eylül 2026</p>
      <div className="notice" style={{ marginTop: 20 }}><p>Veri sorumlusunun tam yasal kimliği, başvuru adresi ve altyapı bilgileri tamamlanmalıdır. Bu metin tek başına mevzuata uygunluk garantisi oluşturmaz.</p></div>
      <section><h2>Kapsam</h2><p>Bu politika Zakrom tarafından sunulan SınavOku erken erişim hizmetinin mevcut veri kullanımını açıklar. İletişim adresi admin@zakrom.com’dur. Veri sorumlusunun tam kimliği, adresi ve altyapı sağlayıcıları doğrulanana kadar bu metin taslaktır.</p></section>
      <section><h2>Kart ve görsel güvenliği</h2><p>Kart alanı Stripe tarafından sunulur. Kart numarası, son kullanma tarihi ve güvenlik kodu SınavOku uygulamasına aktarılmaz; ödeme, provizyon, kart kaydı veya ödeme yöntemi kaydı oluşturulmaz. Görseller tür ve boyut doğrulaması için sunucu belleğine gönderilir, dosyaya veya veritabanına yazılmaz ve doğrulama tamamlanınca bırakılır. Dosya adları ve sayıları oturumda saklanır; dosya adları kişisel bilgi içerebileceğinden anonim adlar kullanın.</p></section>
      <section><h2>Yerel depolama ve isteğe bağlı analitik</h2><p>Seçilen paket, dosya adları, dosya sayısı, yükleme doğrulama kodu ve işlem referansı oturum depolamasında tutulur. Analitik izni varsayılan olarak kapalıdır. İzin verirseniz sayfa görüntüleme, kaydırma, tıklama ve adım olayları rastgele kimliklerle ölçülür. Form alanı değerleri analitik olaylarına eklenmez; URL sorguları ve yönlendiren sayfa adresleri gönderilmez. Gizlilik tercihiniz cihazınızda hatırlanır. Reddetmek hizmet akışını kullanmanızı engellemez. Tercihi geri almanız gelecekteki ölçümü durdurur, sunucudaki geçmiş kayıtları otomatik silmez.</p></section>
      <section><h2>İletişim ve altyapı</h2><p>admin@zakrom.com adresine kendiniz e-posta gönderirseniz mesajınız ve adresiniz iletişimi yanıtlamak için kullanılan e-posta altyapısına ulaşır. Barındırma sistemi bağlantı sırasında IP adresi gibi teknik verileri işleyebilir; altyapı log ayarları ve saklama süreleri henüz doğrulanmamıştır. Statik HTML sürümünde Google Fonts kullanımı Google sunucularına bağlantı oluşturabilir; Next.js sürümünde fontlar uygulamadan sunulur. Altyapı sağlayıcıları ve ülkeleri nihai metne eklenmelidir.</p></section>
      <section><h2>Güvenlik ve saklama</h2><p>Kart alanı uygulamadan ayrı, Stripe tarafından yönetilen bir çerçevede çalışır. SınavOku kart alanlarının ham değerlerini okuyamaz. Görsel yükleme uç noktası dosyaları kalıcı depoya yazmaz. Hiçbir web sitesi için mutlak erişilemezlik veya risksizlik garantisi verilemez. Oturum depolaması cihazınızdaki tarayıcı üzerinden erişilebilir. Sunucu kayıtlarının süreye bağlı imhası, yedekleme ve ilgili kişi silme süreçleri işletmeci tarafından tamamlanmalıdır. Haklarınız ve başvuru bilgileri KVKK Aydınlatma Metni’nde açıklanır.</p></section>
      <p className="small">İletişim: <a href="mailto:admin@zakrom.com">admin@zakrom.com</a></p>
      <section><h2>Resmî kaynaklar</h2><p><a href="https://www.kvkk.gov.tr/Icerik/6765/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESI-HAKKINDA-KAMUOYU-DUYURUSU">KVKK aydınlatma yükümlülüğü</a></p><p><a href="https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu">Aydınlatma ve açık rızanın ayrı düzenlenmesi</a></p></section>
    </article></main>
    <SiteFooter />
  </>;
}
