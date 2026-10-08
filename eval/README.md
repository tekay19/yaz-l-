# Okuma doğruluğu ve maliyet ölçümü (karar kapısı)

**Durum: HENÜZ ÖLÇÜLMEDİ — kapı kapalı.** Bu ölçüm gerçek kâğıtlarla yapılıp aşağıdaki kabul ölçütleri tutmadan müşteriye rapor gönderilmez.

Neden: not, öğrencinin notudur. Bu ölçümün asıl baktığı hata, **işaretlenmeden** yanlış okunan sorudur ("sessiz yanlış"). Düşük güvenle işaretlenen okumalar öğretmenin zamanını alır ama güveni zedelemez; sessiz yanlış ise doğrudan yanlış puan demektir.

## 1. Veri setini hazırla (insan işi)

En az **1 cevap anahtarı + 40 öğrenci kâğıdı**. Setin içinde şunlar mutlaka olmalı: farklı ışık, farklı açı, silinmiş işaret, çift işaret, boş bırakılmış soru. Kâğıtlar izinli olmalı ve isimler gerçek kişilere ait olmamalı (öğretmenin kendi doldurduğu örnekler).

Her fotoğraf `eval/data/<ad>.jpg`, doğru cevabı elle yazılmış hali `eval/data/<ad>.json` olarak konur. `eval/data/` git'e **eklenmez**; `.gitignore`'da.

Öğrenci kâğıdı:

```json
{ "kind": "student", "questionCount": 20, "studentName": "Test Öğrenci 01",
  "answers": [{ "q": 1, "marked": ["A"] }, { "q": 2, "marked": [] }] }
```

Cevap anahtarı:

```json
{ "kind": "key", "questionCount": 20, "answers": [{ "q": 1, "option": "A" }] }
```

## 2. Çalıştır (gerçek API, gerçek maliyet — önce ürün sahibinin onayı)

```bash
ANTHROPIC_API_KEY=... npx tsx --tsconfig tsconfig.json scripts/eval-reader.ts eval/data
```

Fiyat varsayılanları varsayılan modele, Claude Haiku 5.5'e göredir (girdi $0,10, çıktı $0,50 / 1M token). Haiku'nun emin olmadığı sayfaları yeniden okuyan ve anahtarı hazırlayan Claude Sonnet 5.5'in payı ($2 / $10) bu tek fiyatta ayrıca hesaplanmaz; gerçek maliyet biraz daha yüksektir. Başka bir model ölçülüyorsa `PRICE_IN_PER_M` ve `PRICE_OUT_PER_M` ile verilir. Model `GRADER_MODEL`, efor `GRADER_EFFORT` ile seçilir.

## 3. Kabul ölçütleri (ürün sahibi değiştirebilir)

| Ölçüt | Eşik | Anlamı |
|---|---|---|
| `silentWrongRate` | ≤ %0,2 | 500 soruda en fazla 1 işaretlenmemiş yanlış |
| `flaggedRate` | ≤ %5 | Öğretmene sorulan soru oranı |
| `nameAccuracy` | ≥ %90 | Kalanlar zaten "Kontrol edilecekler"e düşer |
| `usdPerPage` × kur | ≤ ₺0,165 | Başlangıç paketinin sayfa fiyatının (₺0,33) yarısı |
| `secondsPerPage` × 30 / `WORKER_CONCURRENCY` | ≤ 300 sn | Sitedeki "birkaç dakika" vaadi, 30 kâğıtlık sınıf için |

Süre tutmuyorsa önce `WORKER_CONCURRENCY` artırılır (Anthropic hesabının istek sınırının izin verdiği kadar), sonra efor düşürülür.

Diğer ölçütler tutmuyorsa sıra şudur: önce prompt düzeltilip tekrar ölçülür, sonra `GRADER_EFFORT` değiştirilir. Model değişikliği ürün sahibinin kararıdır. Maliyet tutmuyorsa paket fiyatları gözden geçirilir.

## 4. Sonuçlar

| Tarih | Veri seti | `GRADER_MODEL` | `GRADER_EFFORT` | silentWrongRate | flaggedRate | nameAccuracy | usdPerPage | secondsPerPage | Karar |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-25 | Sentetik, 1 anahtar + 40 kâğıt (`scripts/synth-sheets.ts`) | `gpt-5.5` (`GRADER_PROVIDER=openai`) | `medium` | %1,46 | %4,51 | %95,0 | $0,0487 | 17,7 | Geçmedi: sessiz yanlış ve maliyet eşiğin üstünde. Sentetik veri, gerçek kâğıt ölçümünün yerini tutmaz. |
| 2026-09-25 | Aynı sentetik set; 4 düşük çözünürlüklü kâğıt artık yüklemede reddediliyor (37 okundu) | `gpt-5.5` | `medium` | %0,54 | %4,32 | — | $0,0504 | 12,9 | Prompt düzeltildi; ölçüm çoklu işaretli yanlış okumayı artık "işaretli" sayıyor (puanlama zaten uyarıyor). Kalan 4 hata: 2 silik işaret "boş", eğik fotoğrafta 2 satır kayması. Geçmedi. |

Ölçüm yapılınca bu tabloya bir satır eklenir ve en üstteki **Durum** satırı güncellenir.

## Klasik (açık uçlu) puanlama

**Durum: ÖLÇÜLDÜ (2026-10-08), kabul ölçütleri henüz tam karşılanmıyor.** Varsayılan yapılandırma bu ölçümlerin en iyisidir: Claude Haiku 5.5 okur ve her cevabı iki kez puanlar (puanlar uyuşmazsa öğretmene sorar); Claude Sonnet 5.5 Haiku'nun emin olmadığı sayfaları yeniden okur ve puanlama anahtarını hazırlar (puanlar anahtardaki çözüm adımlarına eşit bölünür, 3 puan ve altı kısa sorularda tek, geniş ölçüt). Sonnet'in puanları yeniden değerlendirmesi (`ESCALATE_GRADING`) ölçümde doğruluğu artırmadı ve maliyeti ikiye katladı; kapalı. Öğretmen birkaç cevabı elle puanlayıp "Diğerlerini de böyle puanla" dediğinde soru, sınıfın geri kalanında onun ölçüsüne göre yeniden puanlanır. Gerçek kâğıtta en büyük kazanç bu oldu. `KLASIK_ENABLED=true`, bu ölçüm gerçek modelle geçmeden açılmaz.

Klasik iki ayrı adımda ölçülür:

1. **Puanlama** (`scripts/eval-klasik.ts`): yazıya dökülmüş cevaplar onaylı bir rubrikle puanlanır, ürünün kendi puan kodu (`lib/klasik/score.ts`) öneriyi hesaplar ve öğretmenin puanıyla karşılaştırılır. Veri: `eval/klasik/cases.json` (sentetik, depoda). Set, ürün sahibinin sorduğu her durumu içerir: farklı ama doğru yol, farklı sıra ve ifade, yanlış yoldan doğru sonuç, işlemsiz sonuç, iki hatanın birbirini götürmesi, hata taşıma, benzer ama yanlış cevap, kavram sayma, hatalı gerekçe, kâğıda yazılmış talimat, üstü çizili satır.
2. **Okuma** (gerçek kâğıtlarla, veri gelince): el yazısı harfi harfine ve düzeltilmeden yazıya dökülmeli. Kasıtlı olarak hatalı adım içeren kâğıtlarda okuyucunun hatayı sessizce "düzeltmediği" ayrıca sayılır; aksi hâlde yanlış yol doğru görünür.

Çalıştır (gerçek API, gerçek maliyet — önce ürün sahibinin onayı):

```bash
ANTHROPIC_API_KEY=... npx tsx --tsconfig tsconfig.json scripts/eval-klasik.ts eval/klasik/cases.json
# OpenAI ile: GRADER_PROVIDER=openai GRADER_MODEL=gpt-5.5 OPENAI_API_KEY=... PRICE_IN_PER_M=... PRICE_OUT_PER_M=...
```

Kabul ölçütleri (ürün sahibi değiştirebilir):

| Ölçüt | Eşik | Anlamı |
|---|---|---|
| `avgDeviationPct` | ≤ %10 | Önerinin öğretmen puanına ortalama uzaklığı (sorunun azami puanına göre) |
| `silentUnderRate` | ≤ %2 | Doğru ama farklı cevabın uyarısız puan kaybetmesi |
| `silentOverRate` | ≤ %2 | Yanlış yoldan ya da işlemsiz bulunan sonucun uyarısız puan alması |
| Okuma sadakati | %100 | Kasıtlı hatalı adımların hiçbiri düzeltilerek okunmaz (gerçek kâğıt) |
| Klasik sayfa maliyeti | ölçülür | Okuma + puanlama birlikte; klasik sayfanın kaç hak düşeceği ürün sahibinin kararı |

"Sessiz" sayılmayan: öneriyle birlikte öğretmenin dikkatini isteyen bir uyarı gösterilmiş olması. Yalnız bilgi veren "Anahtardan farklı bir yöntem" notu uyarı sayılmaz.

| Tarih | Veri seti | `GRADER_MODEL` | Efor | avgDeviationPct | silentUnderRate | silentOverRate | usdPerAnswer | Karar |
|---|---|---|---|---|---|---|---|---|
| 2026-10-08 | MEB 9. sınıf Matematik ortak yazılı, sentetik zor el yazısı, 50 öğrenci × 4 sayfa; okuma + anahtar + puanlama uçtan uca | Haiku 5.5; yeniden okuma ve anahtar Sonnet 5.5 | okuma `medium`, puanlama `high`, çift puanlama | %10,1 | %2,9 | %4,0 | ~$0,005 | Seçildi, varsayılan. İşaretlenen %49, uyarısız 5+ puan hata %3,7, temiz okunan cevap %63 → %72. Aynı anahtar her çalıştırmada farklı bölünüyordu (15 / 7+8 / 5+10); adımlara eşit bölme kuralıyla sabitlendi. |
| 2026-10-08 | MEB 8. sınıf Türkçe ortak yazılı, sentetik zor, 50 × 4 | aynı | aynı | %8,1 | %0,9 | %2,6 | ~$0,005 | Seçildi. İşaretlenen %59. Sonnet'in yeniden puanlaması işaretlemeyi %59 → %54 indirdi ama ±3 içindeki oranı %87 → %83 düşürdü. |
| 2026-10-08 | Gerçek: Mendeley "Digitized Student Examination Papers" (CC BY 4.0), İngilizce Veri Bilimi, 50 öğrenci, 750 iki puanlık kısa cevap, öğretmen puanı | aynı | aynı; `balanced` | %24,9 | %9,9 | %1,1 | — | Okuma iyi: test harfleri %97,5, yazılan cevapların %97'si bulundu. Puanlama bu öğretmenden sert (öğretmen cevapların %54'üne tam puan vermiş): öğrenci toplamı 30 üzerinden −6,0. |
| 2026-10-08 | Aynı set, öğretmenin elle puanladığı 5 kâğıt dışındaki 45 öğrenci | aynı | `lenient`, kısa soruda tek ölçüt, 5 kâğıt "Diğerlerini de böyle puanla" | %18,4 | %5,3 | %1,5 | — | Birebir uyum %53 → %66, öğrenci toplamı −6,0 → −3,2. İşaretlenen %77, hâlâ çok yüksek. |
| 2026-10-08 | Gerçek: CHECK-MAT (Rusya üniversite sınavı, 122 el yazısı çözüm, uzman puanı 0–4, düşük çözünürlüklü tarama) | aynı | `balanced` | %26,3 | %0,0 | %0,8 | — | Yarım puan içinde %63; neredeyse her şey işaretli (%95), yani öğretmen kontrol ediyor ama sessiz hata yok denecek kadar az. |

