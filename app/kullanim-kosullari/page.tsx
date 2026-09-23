import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Kullanım Koşulları — SınavOku', robots: { index: false } };

export default function Page() {
  return <>
    <header className="site-head"><div className="wrap"><Logo /><Link href="/">Ana sayfa</Link></div></header>
    <main><article className="wrap legal-copy">
      <h1>Kullanım Koşulları</h1>
      <p className="small muted" style={{ marginTop: 16 }}>Taslak · Son güncelleme: 22 Eylül 2026</p>
      <div className="notice" style={{ marginTop: 20 }}><p>Veri sorumlusunun tam yasal kimliği, başvuru adresi ve altyapı bilgileri tamamlanmalıdır. Bu metin tek başına mevzuata uygunluk garantisi oluşturmaz.</p></div>
      <section><h2>Hizmetin niteliği</h2><p>SınavOku, Zakrom adıyla sunulan erken erişim aşamasındaki bir üründür. İletişim: admin@zakrom.com. Mevcut sürüm gerçek sınav değerlendirmesi, rapor teslimi veya ödeme hizmeti sunmaz. Ekrandaki paket ve fiyatlar tanıtım amaçlıdır; işlem düğmesine basmak satış sözleşmesi veya ödeme borcu oluşturmaz. İşletmecinin tam yasal kimliği ve adresi henüz tamamlanmadığından metin taslaktır.</p></section>
      <section><h2>Adımlar ve zorunlu seçimler</h2><p>Devam etmek için bir cevap anahtarı görseli ve en az bir öğrenci görseli seçilmelidir. Görseller tür ve boyut doğrulaması için gönderilir ve kalıcı olarak saklanmaz. Yalnızca kullanmaya yetkili olduğunuz anonim görselleri yükleyin. Kart bilgileri Stripe tarafından sağlanan alana girilir; SınavOku ham kart verilerine erişemez.</p></section>
      <section><h2>İşlem sonucu</h2><p>Kart alanları doğrulandıktan sonra kısa bir yükleme göstergesi ve teknik sorun mesajı gösterilir. Bankaya ödeme veya provizyon talimatı gönderilmez; kart kaydı, tahsilat, abonelik ve otomatik yenileme yapılmaz.</p></section>
      <section><h2>Kullanıcı sorumluluğu</h2><p>Yalnızca kullanmaya yetkili olduğunuz, kişisel veri içermeyen örnek görselleri seçin. Sistemi hukuka aykırı içerik, izinsiz erişim veya hizmeti aksatmak amacıyla kullanmayın. Ekrandaki çıktıları öğrenci notlandırması veya önemli kararlar için esas almayın.</p></section>
      <section><h2>Gelecekteki hizmet ve iletişim</h2><p>Gerçek hizmet veya ödeme etkinleştirilirse ücret, teslim, iptal/iade, ön bilgilendirme ve ilgili sözleşme koşulları işlem öncesinde ayrıca sunulmalıdır. Bu taslak bu belgelerin yerini almaz. Sorularınızı admin@zakrom.com adresine iletebilirsiniz. Emredici mevzuattan doğan haklarınız saklıdır.</p></section>
      <p className="small">İletişim: <a href="mailto:admin@zakrom.com">admin@zakrom.com</a></p>
      <section><h2>Resmî kaynaklar</h2><p><a href="https://www.kvkk.gov.tr/Icerik/6765/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESI-HAKKINDA-KAMUOYU-DUYURUSU">KVKK aydınlatma yükümlülüğü</a></p><p><a href="https://www.kvkk.gov.tr/Icerik/8710/veri-sorumlulari-tarafindan-acik-riza-ve-aydinlatma-metinlerinin-ayri-ayri-duzenlenmesi-gerektigi-hakkinda-kisisel-verileri-koruma-kurulunun-18-02-2026-tarihli-ve-2026-347-sayili-ilke-kararina-iliskin-kamuoyu-duyurusu">Aydınlatma ve açık rızanın ayrı düzenlenmesi</a></p></section>
    </article></main>
    <SiteFooter />
  </>;
}
