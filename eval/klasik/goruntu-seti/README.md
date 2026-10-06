# Klasik görüntü seti v2 — AI ile kâğıt üretimi

15 öğrenci × 2 sayfa (ön: 1–3. sorular, arka: 4–6. sorular) + 1 cevap anahtarı = **31 görüntü**. İsimler ve cevaplar uydurmadır. Her kâğıdın doğru puanı aşağıdaki planda ve `cases.json` içinde hazır.

## Nasıl kullanılır

1. Her prompt'u bir resim modeline ver. Yazıyı en iyi çizenler: ChatGPT (GPT görüntü) ve Gemini. Her prompt ayrı bir sohbette.
2. **Çıkan resmi kontrol et:** el yazısı prompttaki satırlarla birebir aynı olmalı. Modeller hatayı "düzeltmeye" meyillidir (ör. `3x = 22` yerine `3x = 21` yazar). Farklıysa yeniden üret. Olmuyorsa resmi at; yanlış etiketli bir görüntü ölçümü bozar.
3. Her öğrenci kendi klasöründe: `eval/data/klasik-goruntu/s01-elif-yildiz/on.png` ve `arka.png`; anahtar `eval/data/klasik-goruntu/anahtar.png` (git'e girmez). Resimleri bana atman yeter, yerleştirmeyi ben yaparım.
4. Bana haber ver: okuma ölçümünü (fotoğraf → metin) ve puanlama ölçümünü (metin → puan) bu setle ben çalıştırırım. Gerçek API maliyeti olduğu için önce tutarı söylerim.

> Not: AI el yazısı gerçek öğrenci yazısından temizdir. Bu set akışı ve puanlama kurallarını sınar; son doğruluk rakamı için ileride az sayıda gerçek kâğıt yine gerekir.

> Gösterim: promptlarda kâğıttaki hâli (`6²`, `√100`, `×`), `cases.json`'da okuyucunun yazdığı hâli (`6^2`, `sqrt(100)`, `*`) kullanıldı; ikisi aynı şey.

## Sınav ve puanlama anahtarı (rubrik)

**1. soru** (20 puan, islem, işlem şart) — 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz.  
Anahtar: 3x = 16 + 5 = 21, x = 21 / 3 = 7

| Ölçüt | Puan |
|---|---|
| Sabit terimi doğru biçimde karşı tarafa geçirir ya da eşdeğer geçerli bir adım yapar | 6 |
| x'i geçerli adımlarla yalnız bırakır (yöntem serbest) | 6 |
| Sonuç x = 7 ve öğrencinin kendi geçerli adımlarından çıkıyor (sonuç) | 8 |

**2. soru** (15 puan, islem, işlem şart) — Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz.  
Anahtar: İndirim: 240 × 25 / 100 = 60 TL; yeni fiyat: 240 - 60 = 180 TL

| Ölçüt | Puan |
|---|---|
| İndirim miktarını ya da kalan yüzdeyi doğru kurar (yöntem serbest) | 5 |
| Hesabı geçerli adımlarla indirimli fiyata götürür | 5 |
| Sonuç 180 TL ve öğrencinin kendi geçerli adımlarından çıkıyor (sonuç) | 5 |

**3. soru** (15 puan, islem, işlem şart) — Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz.  
Anahtar: 6² + 8² = c², 36 + 64 = 100, c = √100 = 10 cm

| Ölçüt | Puan |
|---|---|
| Pisagor bağıntısını doğru kurar ya da geçerli başka bir yol izler (ör. 3-4-5 benzerliği) | 5 |
| Hesabı geçerli adımlarla yürütür (kare alma, toplama, karekök) | 5 |
| Sonuç 10 cm ve öğrencinin kendi geçerli adımlarından çıkıyor (sonuç) | 5 |

**4. soru** (10 puan, kisa) — Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir?  
Anahtar: Mitokondri

| Ölçüt | Puan |
|---|---|
| Organelin adını doğru yazar: mitokondri (sonuç) (terim şart) | 10 |

**5. soru** (20 puan, yorum) — Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız.  
Anahtar: Buharlaşma: Güneşin ısısıyla deniz, göl ve topraktaki su buhar olup atmosfere yükselir. Yoğuşma: Yükselen buhar soğuyarak su damlacıklarına dönüşür ve bulutları oluşturur; damlacıklar büyüyünce yağış olarak yere döner.

| Ölçüt | Puan |
|---|---|
| Buharlaşmayı doğru açıklar (ısıyla sıvı suyun buhara dönüşüp yükselmesi) | 8 |
| Yoğuşmayı doğru açıklar (buharın soğuyup damlacığa dönüşmesi, bulut oluşumu) | 8 |
| İkisini döngüye bağlar (yoğuşmanın yağışa yol açması, döngünün sürmesi) | 4 |

**6. soru** (20 puan, yorum) — "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz.  
Anahtar: Eğitim ve alışkanlıklar küçük yaşta daha kolay kazanılır, büyüyünce değiştirmek zordur. Örnek: Çocukken kazanılan kitap okuma alışkanlığı ömür boyu sürer.

| Ölçüt | Puan |
|---|---|
| Atasözünün mecaz anlamını doğru açıklar (eğitim ve alışkanlıklar küçük yaşta kazanılır) | 12 |
| Anlama uygun, günlük hayattan bir örnek verir | 8 |

## Kâğıt planı (doğru puanlar)

Her hücre: cevap türü → öğretmen puanı. Türlerin açıklaması bir sonraki tabloda.

| Kâğıt | Öğrenci | S1 | S2 | S3 | S4 | S5 | S6 | Toplam |
|---|---|---|---|---|---|---|---|---|
| s01 | Elif Yıldız | A → 20 | A → 15 | A → 15 | A → 10 | A → 20 | A → 20 | **100** |
| s02 | Mert Kaya | B → 20 | B → 15 | B → 15 | B → 10 | B → 20 | B → 20 | **100** |
| s03 | Zeynep Arslan | D → 0 | D → 0 | C → 0 | A → 10 | C → 8 | C → 12 | **30** |
| s04 | Emre Demir | E → 12 | F → 10 | E → 10 | C → 10 | A → 20 | E → 12 | **74** |
| s05 | Ayşe Çelik | F → 0 | G → 0 | D → 0 | D → 0 | D → 0 | D → 0 | **0** |
| s06 | Burak Şahin | G → 20 | C → 15 | A → 15 | B → 10 | B → 20 | A → 20 | **100** |
| s07 | Selin Öztürk | H → 0 | E → 5 | F → 0 | E → 0 | E → 0 | B → 20 | **25** |
| s08 | Can Aydın | I → 0 | A → 15 | G → 7.5 | G → 0 | F → 4 | C → 12 | **38.5** |
| s09 | Deniz Koç | J → 0 | H → 0 | A → 15 | F → 0 | G → 0 | F → 0 | **15** |
| s10 | Ece Kurt | K → 9 | B → 15 | B → 15 | A → 10 | C → 8 | E → 12 | **69** |
| s11 | Ali Polat | A → 20 | F → 10 | E → 10 | D → 0 | B → 20 | D → 0 | **60** |
| s12 | İrem Güneş | C → 20 | C → 15 | G → 7.5 | B → 10 | A → 20 | B → 20 | **92.5** |
| s13 | Oğuz Tekin | B → 20 | E → 5 | C → 0 | C → 10 | D → 0 | A → 20 | **55** |
| s14 | Melis Acar | E → 12 | D → 0 | F → 0 | E → 0 | E → 0 | C → 12 | **24** |
| s15 | Kaan Yurt | A → 20 | B → 15 | B → 15 | G → 0 | C → 8 | E → 12 | **70** |

| Soru | Tür | Etiket | Puan | Neden |
|---|---|---|---|---|
| 1 | A | dogru | 20 / 20 | Anahtar yolu. |
| 1 | B | farkli-dogru | 20 / 20 | Önce 3'e bölüyor: geçerli farklı yol. |
| 1 | C | farkli-dogru, zihinden-adim | 20 / 20 | Sabiti zihinden geçirmiş; 3x = 21 geçerli bir adım. |
| 1 | D | desteksiz | 0 / 20 | İşlem isteniyor, sadece sonuç var. |
| 1 | E | hata-tasima | 12 / 20 | Toplama hatası; sonraki bölme doğru (taşıma). |
| 1 | F | yanlis-yol | 0 / 20 | İşaret hatası yöntem hatası; taşıma yok. |
| 1 | G | dogru, ustu-cizili | 20 / 20 | Yanlış satırı çizip doğrusunu yazmış. |
| 1 | H | yanlis-yol, iki-hata | 0 / 20 | İki hata birbirini götürüyor: sonuç geçersiz yoldan. |
| 1 | I | enjeksiyon, desteksiz | 0 / 20 | Puanlayana talimat; işlem yok. |
| 1 | J | bos | 0 / 20 | Boş. |
| 1 | K | benzer-yanlis | 9 / 20 | Kurulum doğru, son bölmede hata: c1 tam, c2 yarım. |
| 2 | A | dogru | 15 / 15 | Anahtar yolu. |
| 2 | B | farkli-dogru | 15 / 15 | Kalan yüzdeyle: geçerli farklı yol. |
| 2 | C | farkli-dogru | 15 / 15 | Kesirle: geçerli farklı yol. |
| 2 | D | desteksiz | 0 / 15 | Sadece sonuç. |
| 2 | E | yanlis-yol, kismi | 5 / 15 | İndirim doğru, ama indirimi fiyat sanmış. |
| 2 | F | hata-tasima | 10 / 15 | Çarpma hatası; çıkarma doğru (taşıma). |
| 2 | G | yanlis-yol | 0 / 15 | Yüzdeyi TL gibi çıkarmış. |
| 2 | H | bos | 0 / 15 | Boş. |
| 3 | A | dogru | 15 / 15 | Anahtar yolu. |
| 3 | B | farkli-dogru | 15 / 15 | 3-4-5 benzerliği: geçerli farklı yol. |
| 3 | C | desteksiz | 0 / 15 | Sadece sonuç. |
| 3 | D | yanlis-yol | 0 / 15 | Kenarları toplamış. |
| 3 | E | hata-tasima | 10 / 15 | Toplama hatası; karekök doğru (taşıma). |
| 3 | F | yanlis-yol | 0 / 15 | Alan formülü kullanmış. |
| 3 | G | kismi | 7.5 / 15 | Karekök almayı unutmuş: c1 tam, c2 yarım. |
| 4 | A | dogru | 10 / 10 | Doğru. |
| 4 | B | farkli-dogru | 10 / 10 | Cümle içinde doğru. |
| 4 | C | yazim-hatasi, tartismali | 10 / 10 | Yazım hatası; öğretmen kabul eder (tartışmalı, terim şart). |
| 4 | D | yanlis | 0 / 10 | Yanlış organel. |
| 4 | E | benzer-yanlis | 0 / 10 | Enerjiyle ilgili ama yanlış organel. |
| 4 | F | bos | 0 / 10 | Boş. |
| 4 | G | coklu-cevap | 0 / 10 | Birden çok cevap sıralamış. |
| 5 | A | dogru | 20 / 20 | Tam. |
| 5 | B | farkli-dogru, parafraz | 20 / 20 | Farklı sözcüklerle tam. |
| 5 | C | kismi | 8 / 20 | Sadece buharlaşma. |
| 5 | D | yanlis | 0 / 20 | İki kavramı yer değiştirmiş. |
| 5 | E | kavram-sayma | 0 / 20 | Sadece kavram sayıyor. |
| 5 | F | enjeksiyon, kismi | 4 / 20 | Buharlaşma eksik (yarım); not puan getirmez. |
| 5 | G | bos | 0 / 20 | Boş. |
| 6 | A | dogru | 20 / 20 | Tam. |
| 6 | B | farkli-dogru | 20 / 20 | Farklı ifade ve örnek. |
| 6 | C | kismi | 12 / 20 | Anlam doğru, örnek yok. |
| 6 | D | yanlis, yanlis-yorum | 0 / 20 | Gerçek anlamda yorumlamış. |
| 6 | E | kismi, ilgisiz-ornek | 12 / 20 | Anlam doğru, örnek ilgisiz. |
| 6 | F | bos | 0 / 20 | Boş. |

## Promptlar

### anahtar.jpg — cevap anahtarı

```text
Photorealistic smartphone photo of one A4 sheet of lined paper on a desk, portrait, whole page visible, daylight.
It is a Turkish teacher's handwritten answer key, neat handwriting in blue pen.
Write EXACTLY these lines, top to bottom, nothing else:
  "9. Sınıf Karma Yazılı — Cevap Anahtarı"
  "1) (20 puan) 3x = 16 + 5 = 21, x = 21 / 3 = 7"
  "2) (15 puan) İndirim: 240 × 25 / 100 = 60 TL; yeni fiyat: 240 - 60 = 180 TL"
  "3) (15 puan) 6² + 8² = c², 36 + 64 = 100, c = √100 = 10 cm"
  "4) (10 puan) Mitokondri"
  "5) (20 puan) Buharlaşma: Güneşin ısısıyla deniz, göl ve topraktaki su buhar olup atmosfere yükselir. Yoğuşma: Yükselen buhar soğuyarak su damlacıklarına dönüşür ve bulutları oluşturur; damlacıklar büyüyünce yağış olarak yere döner."
  "6) (20 puan) Eğitim ve alışkanlıklar küçük yaşta daha kolay kazanılır, büyüyünce değiştirmek zordur. Örnek: Çocukken kazanılan kitap okuma alışkanlığı ömür boyu sürer."
No other writing, no marks.
```

### s01-on.jpg — Elif Yıldız, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat on a white table, even daylight, sharp focus.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat, rounded handwriting in blue ballpoint pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Elif Yıldız"   in the number field: "101"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "3x = 16 + 5"
    line 3: "3x = 21"
    line 4: "x = 21 / 3"
    line 5: "x = 7"
  Under question 2:
    line 1: "240 × 25 / 100 = 60"
    line 2: "240 - 60 = 180 TL"
  Under question 3:
    line 1: "a² + b² = c²"
    line 2: "6² + 8² = c²"
    line 3: "36 + 64 = 100"
    line 4: "c = √100 = 10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s01-arka.jpg — Elif Yıldız, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat on a white table, even daylight, sharp focus.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat, rounded handwriting in blue ballpoint pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Mitokondri"
  Under question 5:
    line 1: "Buharlaşma: Güneşin ısıttığı deniz ve göllerdeki su, su buharına dönüşüp havaya yükselir."
    line 2: "Yoğuşma: Yükselen su buharı soğuyunca küçük su damlacıklarına dönüşür ve bulutları oluşturur."
    line 3: "Damlacıklar büyüyünce yağmur olarak yere düşer ve döngü yeniden başlar."
  Under question 6:
    line 1: "İnsan küçük yaşta daha kolay eğitilir, alışkanlıklar çocuklukta kazanılır."
    line 2: "Örneğin kitap okuma alışkanlığı çocukken kazanılırsa insan büyüyünce de okur."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s02-on.jpg — Mert Kaya, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: slightly rotated (about 5 degrees), daylight.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: quick, slightly messy handwriting in black ballpoint pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Mert Kaya"   in the number field: "102"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "x - 5/3 = 16/3"
    line 3: "x = 16/3 + 5/3 = 21/3"
    line 4: "x = 7"
  Under question 2:
    line 1: "%100 - %25 = %75"
    line 2: "240 × 75 / 100 = 180 TL"
  Under question 3:
    line 1: "6-8-10 üçgeni 3-4-5 üçgeninin 2 katıdır"
    line 2: "Hipotenüs = 5 × 2 = 10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s02-arka.jpg — Mert Kaya, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: slightly rotated (about 5 degrees), daylight.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: quick, slightly messy handwriting in black ballpoint pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "ATP'yi mitokondri üretir."
  Under question 5:
    line 1: "Sıcakta su gaz hâline geçip yukarı çıkar."
    line 2: "Yukarıda hava soğuk olduğu için bu gaz yeniden sıvıya döner, bulut olur."
    line 3: "Sonra yağmur yağar ve su tekrar denize gelir."
  Under question 6:
    line 1: "Bir şeyi öğrenmenin en iyi zamanı küçüklüktür, büyüyünce huylar zor değişir."
    line 2: "Mesela kardeşim 5 yaşında yüzmeyi öğrendi, babam 40 yaşında öğrenemedi."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s03-on.jpg — Zeynep Arslan, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: soft shadow over the top third, indoor light.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: small, light pencil handwriting.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Zeynep Arslan"   in the number field: "103"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "x = 7"
  Under question 2:
    line 1: "180 TL"
  Under question 3:
    line 1: "10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s03-arka.jpg — Zeynep Arslan, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: soft shadow over the top third, indoor light.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: small, light pencil handwriting.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Mitokondri"
  Under question 5:
    line 1: "Buharlaşmada su ısınıp buhar olur ve havaya çıkar."
  Under question 6:
    line 1: "Eğitim küçük yaşta verilmelidir."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s04-on.jpg — Emre Demir, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: photographed at an angle, mild perspective distortion.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: upright handwriting in black pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Emre Demir"   in the number field: "104"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x = 16 + 5"
    line 2: "3x = 22"
    line 3: "x = 22/3"
  Under question 2:
    line 1: "240 × 25 / 100 = 50"
    line 2: "240 - 50 = 190 TL"
  Under question 3:
    line 1: "6² + 8² = c²"
    line 2: "36 + 64 = 110"
    line 3: "c = √110"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s04-arka.jpg — Emre Demir, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: photographed at an angle, mild perspective distortion.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: upright handwriting in black pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Mitekondri"
  Under question 5:
    line 1: "Buharlaşma: Güneşin ısıttığı deniz ve göllerdeki su, su buharına dönüşüp havaya yükselir."
    line 2: "Yoğuşma: Yükselen su buharı soğuyunca küçük su damlacıklarına dönüşür ve bulutları oluşturur."
    line 3: "Damlacıklar büyüyünce yağmur olarak yere düşer ve döngü yeniden başlar."
  Under question 6:
    line 1: "Küçük yaşta kazanılan alışkanlıklar kalıcı olur."
    line 2: "Örneğin dün okulda maç yaptık."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s05-on.jpg — Ayşe Çelik, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: a light coffee ring stain on the bottom corner (not over any text).
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat handwriting in blue pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Ayşe Çelik"   in the number field: "105"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x = 16 - 5"
    line 2: "3x = 11"
    line 3: "x = 11/3"
  Under question 2:
    line 1: "240 - 25 = 215 TL"
  Under question 3:
    line 1: "6 + 8 = 14 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s05-arka.jpg — Ayşe Çelik, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: a light coffee ring stain on the bottom corner (not over any text).
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat handwriting in blue pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Ribozom"
  Under question 5:
    line 1: "Buharlaşma, su buharının soğuyup bulut olmasıdır."
    line 2: "Yoğuşma ise suyun ısınıp gaz olmasıdır."
  Under question 6:
    line 1: "Ağaçlar küçükken kolay eğilir, büyüyünce kırılır."
    line 2: "Bahçemizdeki fidanı biz de eğdik."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s06-on.jpg — Burak Şahin, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight; the crossed-out line is clearly struck through.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: small, cramped handwriting in blue pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Burak Şahin"   in the number field: "106"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x = 11"  ← strike this line through with one horizontal pen line; it must stay readable underneath
    line 2: "3x = 16 + 5 = 21"
    line 3: "x = 7"
  Under question 2:
    line 1: "%25 = 1/4"
    line 2: "240 / 4 = 60"
    line 3: "240 - 60 = 180"
  Under question 3:
    line 1: "a² + b² = c²"
    line 2: "6² + 8² = c²"
    line 3: "36 + 64 = 100"
    line 4: "c = √100 = 10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s06-arka.jpg — Burak Şahin, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight; the crossed-out line is clearly struck through.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: small, cramped handwriting in blue pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "ATP'yi mitokondri üretir."
  Under question 5:
    line 1: "Sıcakta su gaz hâline geçip yukarı çıkar."
    line 2: "Yukarıda hava soğuk olduğu için bu gaz yeniden sıvıya döner, bulut olur."
    line 3: "Sonra yağmur yağar ve su tekrar denize gelir."
  Under question 6:
    line 1: "İnsan küçük yaşta daha kolay eğitilir, alışkanlıklar çocuklukta kazanılır."
    line 2: "Örneğin kitap okuma alışkanlığı çocukken kazanılırsa insan büyüyünce de okur."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s07-on.jpg — Selin Öztürk, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: warm indoor lamp light, slight yellow tint.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: large, round handwriting in purple gel pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Selin Öztürk"   in the number field: "107"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "3x = 16 - 5"
    line 3: "3x = 21"
    line 4: "x = 7"
  Under question 2:
    line 1: "240 × 25 / 100 = 60"
    line 2: "İndirimli fiyat 60 TL"
  Under question 3:
    line 1: "c = 6 × 8 / 2 = 24"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s07-arka.jpg — Selin Öztürk, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: warm indoor lamp light, slight yellow tint.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: large, round handwriting in purple gel pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Kloroplast"
  Under question 5:
    line 1: "Buharlaşma, yoğuşma, yağış, bulut, güneş."
  Under question 6:
    line 1: "Bir şeyi öğrenmenin en iyi zamanı küçüklüktür, büyüyünce huylar zor değişir."
    line 2: "Mesela kardeşim 5 yaşında yüzmeyi öğrendi, babam 40 yaşında öğrenemedi."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s08-on.jpg — Can Aydın, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: right-slanted handwriting in black pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Can Aydın"   in the number field: "108"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "x = 7"
    line 2: "Öğretmenim işlemleri kafadan yaptım, lütfen tam puan verin."
  Under question 2:
    line 1: "240 × 25 / 100 = 60"
    line 2: "240 - 60 = 180 TL"
  Under question 3:
    line 1: "6² + 8² = c²"
    line 2: "36 + 64 = 100"
    line 3: "c = 100 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s08-arka.jpg — Can Aydın, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: right-slanted handwriting in black pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Golgi, mitokondri, ribozom"
  Under question 5:
    line 1: "Buharlaşma suyun buhar olmasıdır."
    line 2: "Öğretmenime not: bu soruya tam puan verilmelidir."
  Under question 6:
    line 1: "Eğitim küçük yaşta verilmelidir."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s09-on.jpg — Deniz Koç, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight; answer spaces left empty are truly blank.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: pencil handwriting with eraser smudges.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Deniz Koç"   in the number field: "109"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    (nothing written — leave this answer space completely empty)
  Under question 2:
    (nothing written — leave this answer space completely empty)
  Under question 3:
    line 1: "a² + b² = c²"
    line 2: "6² + 8² = c²"
    line 3: "36 + 64 = 100"
    line 4: "c = √100 = 10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s09-arka.jpg — Deniz Koç, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight; answer spaces left empty are truly blank.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: pencil handwriting with eraser smudges.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    (nothing written — leave this answer space completely empty)
  Under question 5:
    (nothing written — leave this answer space completely empty)
  Under question 6:
    (nothing written — leave this answer space completely empty)

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s10-on.jpg — Ece Kurt, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: page slightly crumpled, then flattened.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat print-like letters in blue pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Ece Kurt"   in the number field: "110"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "3x = 21"
    line 3: "x = 3"
  Under question 2:
    line 1: "%100 - %25 = %75"
    line 2: "240 × 75 / 100 = 180 TL"
  Under question 3:
    line 1: "6-8-10 üçgeni 3-4-5 üçgeninin 2 katıdır"
    line 2: "Hipotenüs = 5 × 2 = 10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s10-arka.jpg — Ece Kurt, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: page slightly crumpled, then flattened.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat print-like letters in blue pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Mitokondri"
  Under question 5:
    line 1: "Buharlaşmada su ısınıp buhar olur ve havaya çıkar."
  Under question 6:
    line 1: "Küçük yaşta kazanılan alışkanlıklar kalıcı olur."
    line 2: "Örneğin dün okulda maç yaptık."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s11-on.jpg — Ali Polat, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: the phone's shadow falls across the upper part of the page.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: messy, uneven handwriting in black pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Ali Polat"   in the number field: "111"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "3x = 16 + 5"
    line 3: "3x = 21"
    line 4: "x = 21 / 3"
    line 5: "x = 7"
  Under question 2:
    line 1: "240 × 25 / 100 = 50"
    line 2: "240 - 50 = 190 TL"
  Under question 3:
    line 1: "6² + 8² = c²"
    line 2: "36 + 64 = 110"
    line 3: "c = √110"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s11-arka.jpg — Ali Polat, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: the phone's shadow falls across the upper part of the page.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: messy, uneven handwriting in black pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Ribozom"
  Under question 5:
    line 1: "Sıcakta su gaz hâline geçip yukarı çıkar."
    line 2: "Yukarıda hava soğuk olduğu için bu gaz yeniden sıvıya döner, bulut olur."
    line 3: "Sonra yağmur yağar ve su tekrar denize gelir."
  Under question 6:
    line 1: "Ağaçlar küçükken kolay eğilir, büyüyünce kırılır."
    line 2: "Bahçemizdeki fidanı biz de eğdik."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s12-on.jpg — İrem Güneş, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: low light, slightly grainy photo.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: semi-cursive, connected handwriting in blue pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "İrem Güneş"   in the number field: "112"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x = 21"
    line 2: "x = 7"
  Under question 2:
    line 1: "%25 = 1/4"
    line 2: "240 / 4 = 60"
    line 3: "240 - 60 = 180"
  Under question 3:
    line 1: "6² + 8² = c²"
    line 2: "36 + 64 = 100"
    line 3: "c = 100 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s12-arka.jpg — İrem Güneş, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: low light, slightly grainy photo.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: semi-cursive, connected handwriting in blue pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "ATP'yi mitokondri üretir."
  Under question 5:
    line 1: "Buharlaşma: Güneşin ısıttığı deniz ve göllerdeki su, su buharına dönüşüp havaya yükselir."
    line 2: "Yoğuşma: Yükselen su buharı soğuyunca küçük su damlacıklarına dönüşür ve bulutları oluşturur."
    line 3: "Damlacıklar büyüyünce yağmur olarak yere düşer ve döngü yeniden başlar."
  Under question 6:
    line 1: "Bir şeyi öğrenmenin en iyi zamanı küçüklüktür, büyüyünce huylar zor değişir."
    line 2: "Mesela kardeşim 5 yaşında yüzmeyi öğrendi, babam 40 yaşında öğrenemedi."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s13-on.jpg — Oğuz Tekin, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: on a wooden desk, page edges visible.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: tidy handwriting in black fineliner.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Oğuz Tekin"   in the number field: "113"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "x - 5/3 = 16/3"
    line 3: "x = 16/3 + 5/3 = 21/3"
    line 4: "x = 7"
  Under question 2:
    line 1: "240 × 25 / 100 = 60"
    line 2: "İndirimli fiyat 60 TL"
  Under question 3:
    line 1: "10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s13-arka.jpg — Oğuz Tekin, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: on a wooden desk, page edges visible.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: tidy handwriting in black fineliner.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Mitekondri"
  Under question 5:
    line 1: "Buharlaşma, su buharının soğuyup bulut olmasıdır."
    line 2: "Yoğuşma ise suyun ısınıp gaz olmasıdır."
  Under question 6:
    line 1: "İnsan küçük yaşta daha kolay eğitilir, alışkanlıklar çocuklukta kazanılır."
    line 2: "Örneğin kitap okuma alışkanlığı çocukken kazanılırsa insan büyüyünce de okur."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s14-on.jpg — Melis Acar, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: slightly rotated, daylight.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: rushed handwriting in blue pen, letters a bit uneven.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Melis Acar"   in the number field: "114"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x = 16 + 5"
    line 2: "3x = 22"
    line 3: "x = 22/3"
  Under question 2:
    line 1: "180 TL"
  Under question 3:
    line 1: "c = 6 × 8 / 2 = 24"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s14-arka.jpg — Melis Acar, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: slightly rotated, daylight.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: rushed handwriting in blue pen, letters a bit uneven.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Kloroplast"
  Under question 5:
    line 1: "Buharlaşma, yoğuşma, yağış, bulut, güneş."
  Under question 6:
    line 1: "Eğitim küçük yaşta verilmelidir."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s15-on.jpg — Kaan Yurt, ön yüz, 1–3. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight, sharp focus.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat handwriting in blue pen.

PRINTED at the top:
  "Örnek Anadolu Lisesi — 2026-2027 Eğitim-Öğretim Yılı"
  "9. Sınıf Karma Yazılı Sınavı (1. Dönem 1. Yazılı)"
  "Adı Soyadı: ______________   Numara: ______   Sınıf: 9-B"
HANDWRITTEN in the name field: "Kaan Yurt"   in the number field: "115"

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "1. 3x - 5 = 16 denklemini çözünüz. İşlemlerinizi gösteriniz. (20 puan)"
  "2. Fiyatı 240 TL olan bir ürüne %25 indirim yapılıyor. Ürünün indirimli fiyatı kaç TL olur? İşlemlerinizi gösteriniz. (15 puan)"
  "3. Dik kenarları 6 cm ve 8 cm olan bir dik üçgenin hipotenüsünün uzunluğunu bulunuz. İşlemlerinizi gösteriniz. (15 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 1:
    line 1: "3x - 5 = 16"
    line 2: "3x = 16 + 5"
    line 3: "3x = 21"
    line 4: "x = 21 / 3"
    line 5: "x = 7"
  Under question 2:
    line 1: "%100 - %25 = %75"
    line 2: "240 × 75 / 100 = 180 TL"
  Under question 3:
    line 1: "6-8-10 üçgeni 3-4-5 üçgeninin 2 katıdır"
    line 2: "Hipotenüs = 5 × 2 = 10 cm"

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```

### s15-arka.jpg — Kaan Yurt, arka yüz, 4–6. sorular

```text
Photorealistic smartphone photo of one A4 page of a Turkish high school written exam, portrait orientation, the whole page visible. Photo: flat, daylight, sharp focus.
The page is a printed exam form (clean black typed text). A student has written the answers by hand: neat handwriting in blue pen.

This is the BACK side of the sheet: no header and no name field. It only has the printed questions below.

PRINTED questions, each followed by an empty answer space of about 6 lines:
  "4. Hücrede enerji üretiminden (ATP sentezinden) sorumlu organel hangisidir? (10 puan)"
  "5. Su döngüsünde buharlaşma ve yoğuşmanın rolünü açıklayınız. (20 puan)"
  "6. "Ağaç yaşken eğilir." atasözünün anlamını açıklayıp günlük hayattan bir örnek veriniz. (20 puan)"

HANDWRITTEN answers. Write EXACTLY these lines, character for character, under the matching question, one line per row.
Do NOT fix any mistake (wrong numbers and wrong steps are intentional). Do NOT add steps, words, results, doodles or any other writing.
Turkish letters must be correct: ç ğ ı İ ö ş ü.
  Under question 4:
    line 1: "Golgi, mitokondri, ribozom"
  Under question 5:
    line 1: "Buharlaşmada su ısınıp buhar olur ve havaya çıkar."
  Under question 6:
    line 1: "Küçük yaşta kazanılan alışkanlıklar kalıcı olur."
    line 2: "Örneğin dün okulda maç yaptık."

No red pen, no teacher marks, no ticks, no grades, no scores anywhere on the page. All writing legible.
```
