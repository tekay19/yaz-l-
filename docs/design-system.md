# SınavOku tasarım dili

SınavOku, öğretmenin kâğıt okuma masasıdır. Bu yüzden görünüm de bu masanın malzemesinden gelir: kara tahta yeşili, öğretmenin kırmızı kalemi, optik formun ince çizgileri ve not defterinin satır düzeni. Cesaret tek yerde harcanır. **Kırmızı kalem yalnızca öğretmenin dikkatini gerektiren şeyler içindir.** Geri kalan her şey sakin, düzenli ve okunaklı kalır.

## Renk

| Ad | Hex | Görev |
|---|---|---|
| Tahta | `#173F33` | Ana renk: birincil düğmeler, koyu yüzeyler (admin menüsü), logo |
| Tahta açık | `#2C6B55` | Bağlantılar, hover, seçili durum çizgileri |
| Kırmızı kalem | `#C9362C` | Yalnızca dikkat: kontrol bekleyen, hata, takılı iş, okunamayan sayfa. Süs için kullanılmaz |
| Mürekkep | `#18211D` | Metin |
| Kurşun | `#66706B` | İkincil metin, etiketler |
| Çizgi | `#D9DFDB` / yumuşak `#E8ECE9` | Kurallar, tablo çizgileri |
| Kâğıt | `#FFFFFF` | İçerik yüzeyi |
| Masa | `#EEF1EE` | Sayfa zemini |
| Fosfor | `#F3E68F` | Çok seyrek: metin içinde "sizi bekleyen" vurgusu (fosforlu kalem gibi alt yarı vurgu) |

Durum renkleri: yeşil tamam `#1F7A55` / zemin `#E4F1EA`; amber bekliyor `#9A6411` / zemin `#FBF1DC`; kırmızı = kırmızı kalem / zemin `#FBE9E7`; nötr `#66706B` / zemin `#EEF1EE`.

Gradyan arka planlar, renkli bloblar ve dekoratif yıkamalar yok.

## Yazı

- **Schibsted Grotesk** (400/500/600/700/800): arayüzün ve başlıkların tek ailesi. Gazete kökenli, sağlam ve kişilikli bir grotesk; Türkçe karakterleri tam.
- **Caveat** (600): yalnızca kırmızı kalem notları için. Bir kâğıt üstündeki puan, "✓ 18/20", tanıtım sayfasındaki örnek kâğıt gibi. Arayüz etiketi olarak kullanılmaz.
- `font-variant-numeric: tabular-nums` yalnızca alt alta hizalanan sayılara (tablo sayı hücreleri, istatistik değerleri) verilir; Schibsted'in tabular modu virgül ve noktayı da genişletir, bu yüzden metne ya da kapsayıcıya verilmez. Tablolarda sayısal sütunlar sağa hizalanır.
- Ölçek (px): 12.5 · 14 · 15.5 · 17 · 20 · 26 · 34 · 48. Başlıklarda harf aralığı −0.02em; gövde 1.55 satır aralığı.
- Yapılmayacaklar: TÜMÜ BÜYÜK HARF etiketler; başlıkta tek kelimeyi renklendirmek ya da italik yapmak; her başlığın üstüne küçük etiket koymak; bağlantı ve düğme metnine "→" eklemek; tek boşluklu (monospace) veri etiketleri.

## Düzen

- **Not defteri ilkesi:** içerik kutulara doğranmaz. Bir sayfa; başlık satırı (solda başlık ve kısa açıklama, sağda eylemler), ardından ince çizgilerle ayrılmış bölümler. Kart yalnızca içerik gerçekten bir nesne olduğunda kullanılır (bir sınav, bir paket).
- **İstatistik şeridi:** dört ayrı kart yerine, tek yüzey üzerinde dikey çizgilerle bölünmüş tek satır. Etiket küçük ve kurşun rengi, değer büyük ve tabular.
- **Tablolar** birincil kalıptır: 1px yatay çizgiler, başlık satırı kurşun rengi 12.5px ve normal harf, satır hover'ı masa rengi, sayılar sağda.
- **Köşe yarıçapı hiyerarşisi:** kontroller 6px, paneller 10px, rozetler 999px. Her şeye aynı yarıçap verilmez.
- **Gölge:** yalnızca yüzen öğelerde (menü, toast, dialog). Paneller gölgesiz, 1px çizgiyle durur.
- Sola hizalı okuma düzeni. Ortalanmış içerik yalnızca tek odaklı ekranlarda (giriş) olur.
- Odak halkası her yerde görünür: 2px tahta açık, 2px boşluk.
- Hareket: yalnızca kullanıcının eylemine cevap olarak (açılma, onay). Kendiliğinden giriş animasyonu yok; tek istisna tanıtım sayfasının hero sahnesidir (aşağıda). `prefers-reduced-motion` kuralına uyulur.

## Tanıtım ve giriş sayfaları: kara tahta

Herkese açık sayfalar (tanıtım, giriş, kayıt) sınıfın kara tahtası üstüne kurulur: `components/Board.tsx`. Ahşap çerçeve, tebeşir dokusu, silginin eski izleri, altta tebeşir rafı ve silgi.

- Tahta üstünde yazı tebeşirdir: başlıklar Schibsted 800, `.chalk` filtresiyle (`ChalkDefs`, sayfada bir kez); notlar Caveat ile sarı tebeşir (`#F3E68F`).
- Tanıtım sayfası tahtayla açılır (hero) ve tahtayla kapanır (son çağrı). Aradaki bölümler masa zemininde, büyük başlık ve az yazıyla durur.
- Hero sahnesi ürünü üç hamlede gösterir: telefon kâğıdı çeker, kâğıt taranır ve kırmızı kalemle işaretlenir, sonuç listesi e-postayla gelir. Her hamlenin tebeşir etiketi sırası gelince yanar. Sayfa açılınca bir kez oynar; azaltılmış harekette bitmiş hâli gösterilir.
- Giriş sayfalarında tahta sağdadır ve üstünde mıknatısla tutturulmuş, puanlanmış bir kâğıt vardır. Telefonda yalnızca form görünür.

## Paneller (öğretmen ve yönetim)

- Sol menü duvardaki tahtadır (`.chalk-side`): tahta dokusu, sağ kenarda meşe çerçeve, bütün yazılar tebeşir. Bulunulan sayfa sarı tebeşir çizgisiyle (`.chalk-mark`) işaretlenir; "Yeni sınav yükleyin" tebeşir beyazı düğmedir; sayfa hakkı sarı tebeşirle büyük yazılır. Telefonda üst çubuk da tahtadır.
- İçerik alanı çalışma yeridir: masa zemini, kâğıt yüzeyler, ince çizgiler. Okunurluk orada tahtadan önce gelir.
- Sayfa başlıkları 800 ağırlıkta ve büyüktür, tanıtım sayfasıyla aynı ses.
- Yeni öğretmenin ilk ekranı ("Hoş geldiniz", üç adım) bir tahta üstündedir; tamamlanan adımın üstü sarı tebeşirle çizilir.

## Dil

- Düğme, ne olacağını söyler: "Sınavı gönderin", "Sayfa hakkı ekleyin". Aynı eylem akış boyunca aynı adı taşır.
- Hata mesajı ne olduğunu ve ne yapılacağını söyler; özür dilemez.
- Boş ekran bir davettir: tek cümle ve bir eylem.
- Öğretmene "siz" diye hitap edilir. Admin ekranları kısa ve nötr etiketler kullanır.
