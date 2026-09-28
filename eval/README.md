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

Fiyat varsayılanları Claude Opus 5'e göredir (girdi $5, çıktı $25 / 1M token). Başka bir model ölçülüyorsa `PRICE_IN_PER_M` ve `PRICE_OUT_PER_M` ile verilir. Model `GRADER_MODEL`, efor `GRADER_EFFORT` ile seçilir.

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
