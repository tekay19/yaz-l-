# KVKK, gizlilik ve kullanım koşulları — güncelleme kontrol listesi

**Durum: taslak, hukukçu onayı bekliyor. Canlı sayfalar (`app/kvkk`, `app/gizlilik`, `app/kullanim-kosullari`) değiştirilmedi.** Bu belge hukuki tavsiye değildir; hukukçunun metni yazması için gereken olguları toplar. Sayfalar, gerçek backend ile ön yüz birlikte yayına alınırken, onaylanmış metinle güncellenmelidir. Daha önce güncellenirlerse, hâlâ çalışan sahte akışı yanlış anlatırlar.

## 1. Gerçek backend'le yanlışa dönecek mevcut cümleler

| Sayfa | Mevcut ifade | Gerçek işleyiş |
|---|---|---|
| kvkk | "Görseller … dosyaya veya veritabanına yazılmaz ve yanıt tamamlandığında bırakılır" | Fotoğraflar sunucu diskine yazılır, aşağıdaki sürelerde silinir |
| kvkk | "Yapay zekâ ile değerlendirme yapılmaz" | Kâğıtlar Anthropic'in Claude modeliyle okunur (puanı kod hesaplar) |
| kvkk | "yurt dışı aktarım mekanizması işletmeci tarafından henüz bildirilmemiştir" | Fotoğraflar okuma için ABD'deki Anthropic API'sine gönderilir |
| gizlilik | "Görseller … dosyaya veya veritabanına yazılmaz" / "Görsel yükleme uç noktası dosyaları kalıcı depoya yazmaz" | Aynı: diske yazılır, süreli silinir |
| kullanim-kosullari | "Görseller … kalıcı olarak saklanmaz" | Süreli saklanır (aşağıda) |
| kullanim-kosullari, gizlilik | Stripe kart alanı ve "teknik sorun" akışı | Ödeme iyzico'nun barındırılan formunda; kart bilgisi SınavOku'ya gelmez |

## 2. Yeni metnin açıklaması gereken olgular (kodda uygulandığı hâliyle)

- **İşlenen veriler:** öğretmenin e-posta adresi; sınav fotoğrafları (öğrencinin adı ve cevapları; öğrenciler çoğunlukla reşit değil); okuma sonuçları (öğrenci adı, cevaplar, puan); ödeme kaydı (paket, tutar, iyzico işlem jetonu); site ziyaret olayları.
- **Yurt dışı aktarım:** fotoğraflar okuma için Anthropic PBC'nin (ABD) API'sine gönderilir. KVKK md. 9 kapsamındaki standart sözleşme ve Kurum'a bildirim ürün sahibinin işidir (plan, Task 16).
- **Diğer alıcılar:** SMTP sağlayıcısı (giriş bağlantısı ve rapor e-postası), iyzico (ödeme), barındırma sağlayıcısı. Hepsinin adı ve ülkesi metinde yazmalı.
- **Saklama süreleri** (`lib/retention.ts`, saatte bir çalışır):
  - Fotoğraflar: rapor e-postası gidince silinir; gitmese de en geç 7 gün, öğretmen onayı bekleyen sınavlarda en geç 14 gün.
  - Sonuçlar (öğrenci adı, puan, sınav kaydı): 30 gün.
  - Giriş bağlantısı kayıtları: 1 gün.
  - Ziyaret olayları: 180 gün. **Bekleme listesi e-postaları da aynı tabloda durduğu için 180 günde silinir.** Bu istenmiyorsa metinden önce koda karar verilmeli.
  - Ödeme kayıtları: hesap silinse de yasal süre boyunca, kullanıcıyla bağı kopartılarak.
- **Hesap silme:** öğretmen hesabını silebilir (`DELETE /api/me`). Sınavlar, sayfalar, fotoğraflar ve sayfa hakkı defteri silinir; ödeme kayıtları kullanıcısız kalır.
- **Çerezler:** `so_user` oturum çerezi (httpOnly, 30 gün); yönetim paneli için `so_admin`.

## 3. Koddan bağımsız, ürün sahibinin yapacakları

- Metnin hukukçu tarafından yazılması veya onaylanması.
- KVKK md. 9 standart sözleşme ve Kurum'a bildirim (Anthropic'e aktarım için).
- VERBİS kaydı (durum raporundaki E aşaması).
- Okulların/öğretmenlerin öğrenci verisini işleme dayanağının netleştirilmesi (öğrenciler reşit değil).
