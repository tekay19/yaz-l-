# Klasik sınav: rubrikle puan önerisi — tasarım

**Tarih:** 2026-09-30 · **Durum:** onaylandı (Bölüm 1-3 ürün sahibiyle birlikte; Bölüm 4-6 ürün sahibinin yetkisiyle) · **Yerini aldığı:** backend planındaki Task 15 (`2026-09-23-sinavoku-backend.md`, "Faz 6")

## 1. Amaç

Açık uçlu (klasik) sınav kâğıtlarını yapay zekâyla okuyup öğretmene **puan önerisi** sunmak; son karar öğretmende.

Ürün sahibinin koyduğu şartlar:

- Doğru ama öğretmenin anahtarından **farklı yazılmış** cevap (farklı çözüm yolu, farklı sıra, farklı ifade) düşük puan almaz. Puanlama "anahtara benzerlik" ile yapılmaz.
- **Yanlış yoldan bulunmuş** ya da **yazılı işlemlerden çıkmayan (uydurulmuş, ezberden yazılmış)** doğru sonuç tam puan almaz.

Başarı ölçütü: öğretmen önerilerin çoğunu değiştirmeden onaylar; "doğru ama farklı" cevaplarda sessiz puan kaybı ve "yanlış yoldan doğru" cevaplarda sessiz fazla puan neredeyse sıfırdır (Bölüm 8).

## 2. İlkeler

1. **Benzerlik değil, geçerlilik.** Her soru bir **rubrikle** (ölçütler + puanlar) puanlanır. Ölçüt, cevabın neyi başarması gerektiğini söyler; nasıl ifade edileceğini değil.
2. **Yapay zekâ karar verir, puanı kod hesaplar.** Model her ölçüt için "karşılandı / kısmen / yok" der; puan `lib/klasik/score.ts`'deki saf fonksiyonla hesaplanır (optikteki ilkeyle aynı).
3. **Kanıt zorunlu.** "Karşılandı" kararı, öğrencinin yazdığından birebir alıntıyla gelir; kod alıntıyı okuma metninde bulamazsa puan otomatik verilmez.
4. **Doğru sonuç tek başına kanıt değildir.** Sonuç ölçütü yalnız sonuç doğruysa **ve** öğrencinin kendi geçerli adımlarından çıkıyorsa puan alır.
5. **Suçlama yok.** Sistem "kopya" ya da "uydurma" demez; gözlemi yazar ("sonuç yazılı işlemlerden çıkmıyor").
6. **Son karar öğretmende.** Klasik sınav hiçbir zaman öğretmen onayı olmadan gönderilmez.

## 3. Akış ve durumlar

```
draft ──submit──► queued ──(ilk sayfa alınınca)──► processing
   anahtar okunur + rubrik taslağı ──► rubric  (öğretmen düzeltir, onaylar)
   öğrenci kâğıtları bu sırada okunur (anahtarı ya da rubriği beklemez)
rubric ──onay──► processing ──(tüm kâğıtlar okundu + puanlandı)──► review
review ──(öğretmen düzeltir; "kabul et" rubriği günceller → ilgili sorular yeniden puanlanır)
review ──onay──► delivering ──► done
rubric ──7 gün onaysız──► failed (fail_reason=rubric_expired, tam iade)
```

- **Anahtar iki yoldan verilir:** fotoğraf (klasikte birden fazla anahtar sayfası olabilir; optikte yeni anahtar eskisinin yerine geçmeye devam eder) ve/veya yazılı metin (`jobs.key_text`, yapıştırma dahil).
- **Soru puanları rubrik ekranında kesinleşir.** `klasikMax` iş oluştururken isteğe bağlıdır; verilmişse taslağa önceden dolar, verilmemişse her soru 10 puan önerilir.
- **Kâğıtlar rubrik onayını beklemeden okunur.** Terk edilen işte okuma maliyeti boşa gider, öğretmene hak yine iade edilir. Okuma adımı anahtarı hiç görmez (belirsiz el yazısını "beklenen cevap" olarak okuma eğilimini önlemek için).
- **Klasik iş kendiliğinden gönderilmez:** `autoDeliverStale` klasik işleri atlar. Kontrol aşamasında öğretmene giriş e-postası ve 3. günde bir hatırlatma gider. Öğretmen 30 güne kadar onaylayabilir (fotoğraflar 14. günde silinse de okuma metni ve kanıtlar durur).
- **Rubrik 7 gün içinde onaylanmazsa** iş `failed` olur, sayfa hakkı tamamen iade edilir, fotoğraflar silinir.
- Anahtar hiç okunamazsa iş başarısız olmaz: boş bir rubrikle `rubric` durumuna geçer, öğretmen anahtarı yazar ve taslağı yeniden oluşturur ya da rubriği elle kurar.

## 4. Rubrik

```ts
type QuestionType = 'islem' | 'kisa' | 'yorum';
type Criterion = { id: string; text: string; points: number; role: 'result' | 'other'; required: boolean };
type AcceptedPath = { text: string; example: string | null; by: 'ai' | 'teacher' };
type QuestionPolicy = { workRequired: boolean; carryForward: boolean; wrongInfoPenalty: boolean };
type RubricQuestion = {
  q: number; rev: number; type: QuestionType;
  prompt: string | null;   // soru metni (biliniyorsa)
  answer: string;          // anahtardaki beklenen cevap
  criteria: Criterion[];   // sorunun azami puanı = ölçüt puanlarının toplamı
  accepted: AcceptedPath[];
  policy: QuestionPolicy;
};
type Rubric = { questions: RubricQuestion[] };
```

- **Tür:** `islem` (adımları önemli hesap/çıkarım), `kisa` (terim, tarih, sayı, tek cümle), `yorum` (açıklama, karşılaştırma, yorum).
- **İşlem iskeleti:** "Kurulum" · "Geçerli adımlar (yöntem serbest)" · `role: 'result'` olan "Sonuç doğru ve öğrencinin kendi geçerli adımlarından çıkıyor".
- **`required`:** kavramın adının birebir istendiği ölçüt ("kavramın adını yazınız"). Modele talimattır; kod ayrıca denetlemez.
- **Politika varsayılanları:** `workRequired` — işlem sorularında `true` (soru yalnız sonucu istemiyorsa), kısa/yorumda `false`. `carryForward: true` (yalnız işlem hatasında; yöntem hatasında uygulanmaz). `wrongInfoPenalty: false` (yanlış ek bilgi yalnız uyarı üretir). "Kısmen" = ölçüt puanının yarısı.
- **Sürüm:** her sorunun `rev` sayacı var. Onaydan sonra bir soru değişirse (`kabul et`) `rev` artar ve o soru, elle puanı girilmemiş tüm kâğıtlarda yeniden puanlanır. İşin `rubric_rev` sayacı her değişiklikte artar; kâğıt `graded_rev < rubric_rev` ise yeniden puanlamaya girer.

### Vaka tablosu (onaylı varsayılanlar)

| Durum | Nasıl anlaşılır | Varsayılan puan | Uyarı |
|---|---|---|---|
| Doğru yol, doğru sonuç | `resultPath=valid` | Tam | — |
| Farklı ama geçerli yol | `valid` + `alternative_path` | Tam | "Anahtardan farklı yöntem" (bilgi) |
| Yanlış yoldan doğru sonuç | `resultPath=invalid` | Geçerli adımlar alır, sonuç puanı yok | `invalid_path` |
| İki hata birbirini götürmüş | `invalid` + `compensating_errors` | Aynı | `compensating_errors` |
| Desteksiz sonuç | `unsupported` ya da `none` | İşlem gerekliyse sonuç puanı yok (hiç adım yoksa soru 0); değilse tam | `unsupported_result` |
| Yöntem doğru, işlem hatası | `resultCorrect=false`, `errorKind=islem` | Yöntem puanları alır (hata taşıma), sonuç almaz | — |
| Zihinden küçük adım | `valid` | Ceza yok | — |
| Hüküm doğru, gerekçe yanlış | ölçüt kararları | Hüküm ölçütü alır, gerekçe almaz | `wrong_justification` |
| Kavram sayma / ezber kalıp | ölçüt kararları | Puan yok | `keywords_only` |
| Doğruya karışmış yanlış bilgi | ölçüt kararları | Puan düşmez | `wrong_info` |
| Kâğıtta "tam puan verin" gibi yazı | ölçüt kararları | Hiçbir şey kazandırmaz | `instruction_in_answer` |

## 5. Yapay zekâ çağrıları

| Çağrı | Ne zaman | Girdi | Çıktı | Görsel |
|---|---|---|---|---|
| `readKlasik` | Sayfa kuyruktan alınınca (anahtar ya da öğrenci) | Fotoğraf | Soru soru harfi harfine satırlar | Evet |
| `draftRubric` | Anahtar sayfalarının hepsi okununca (ya da yalnız yazılı anahtar varsa gönderimden hemen sonra) | Anahtar metni + varsa puanlar | Rubrik taslağı | Hayır |
| `gradeKlasik` | Rubrik onaylı ve işin tüm kâğıtları okunmuşsa | Rubrikteki (yeniden) puanlanacak sorular + o sorulara ait okuma | Soru soru kararlar (puansız) | Yalnız şekilli sorularda (fotoğraf hâlâ varsa) |

**Okuma (`KlasikRead`):** `{ isBackSide, studentName, nameConfidence, unreadable, answers: [{ q, lines: [{ text, crossed }], unclear, hasFigure }] }`. Kurallar: hiçbir şeyi düzeltme, eksik adımı tamamlama; okunamayan kelime `[?]`, emin olunamayan `[?kelime]`; üstü çizili satır `crossed: true`; basılı soru metni cevap değildir.

**Puanlama çıktısı (soru başına):** `criteria: [{ id, verdict: met|partial|not_met, evidence }]`, `resultCorrect: boolean|null`, `resultPath: valid|invalid|unsupported|none|null`, `firstError: string|null`, `errorKind: islem|yontem|null`, `flags: KlasikFlag[]`, `confidence: high|low`, `note` (öğretmen için tek cümle Türkçe). Şemalarda `optional` yok, yalnız `nullable` (OpenAI katı şema kuralı).

**Kod güvenceleri (`scoreQuestion`):**
1. Öğretmenin elle girdiği puan her şeyin önüne geçer.
2. Alıntı okuma metninde geçmiyorsa (Türkçe küçük harf, boşluk ve noktalama normalleştirmesiyle; kelime sırası %85 örtüşme toleransı) karar `not_met` sayılır, `evidence_unverified` uyarısı eklenir. Şekilli sorularda bu denetim yapılmaz, soru her zaman `figure` uyarısı taşır.
3. `role: 'result'` ölçütü (yorum dışı türlerde) yalnız `resultCorrect && (resultPath === 'valid' || (!workRequired && resultPath ∈ {none, unsupported}))` iken puan alır.
4. `workRequired && resultPath === 'none'` → soru 0. `!workRequired && resultCorrect && resultPath ∈ {none, unsupported}` → soru tam.
5. Toplam 0,5'e yuvarlanır, 0 ile azami arasında kırpılır.
6. Kâğıtta hiç yazı olmayan soru modele gönderilmeden 0 alır; okumada hiç bulunmayan soru 0 + "Kâğıtta bulunamadı" uyarısı (öğretmen okumayı düzelterek ekleyebilir).

**Veri:** okuma `pages.result` (`klasik-key` / `klasik-student`), kararlar `pages.grade` (`{ questions: QuestionGrade[] }`, her soru hangi `rev`'e göre puanlandığını tutar), kâğıdın puanlandığı sürüm `pages.graded_rev`. Arkalı-önlü kâğıtlar puanlamadan önce birleştirilir (aynı sorunun satırları ön yüzün ardına eklenir); kararlar ön sayfada durur.

**Worker adımları** (döngünün her turunda, teslimat gibi iş düzeyinde): `draftPendingRubrics`, `notifyRubric`, `expireRubrics`, `gradePending` (tur başına en çok `WORKER_CONCURRENCY` kâğıt; kâğıt başına kira + deneme sayacı), `completeKlasikJobs` (okuma ve puanlama bitince `review`'e geçirir, okunamayan sayfaları iade eder), `remindKlasikReview`.

**Kuyruk:** klasik öğrenci sayfaları anahtarın okunmasını beklemez. Optikte bekleme sürer.

## 6. Öğretmen kontrolü ve rubrik güncelleme

**Rubrik ekranı (`rubric` durumu):** her soru için tür, soru metni, beklenen cevap, ölçütler (metin, puan, sonuç ölçütü mü, şart mı), kabul edilen yollar ve politikalar düzenlenir; toplam puan görünür. "Taslağı yeniden oluştur" (anahtar metni değiştiyse), "Kaydet", "Onayla ve puanla".

**Kontrol ekranı (`review`):** kâğıt kâğıt, soru soru: okuma metni (düzenlenebilir), ölçüt kararları + kanıt, uyarılar, not, önerilen puan. Uyarılı sorular önce gösterilir. Eylemler:
1. **Puanı değiştir** — yalnız bu kâğıt/soru (`override.points`), yeniden puanlamada korunur.
2. **Okumayı düzelt** — bu kâğıdın bu sorusu yeniden puanlanır (`override.texts`).
3. **Bu cevabı kabul et, rubriğe ekle** — sorunun `accepted` listesine öğretmen notu ve bu cevabın metni örnek olarak eklenir, `rev` artar; o soru elle puanı girilmemiş tüm kâğıtlarda yeniden puanlanır. Farklı ama doğru yolu kullanan diğer öğrenciler de böylece düzelir.
4. **Yeniden dene** — puanlaması 3 denemede başarısız olan kâğıt için.
5. **Onayla** — yeniden puanlama sürerken 409 döner.

## 7. Rapor

- Excel "Puanlar": Öğrenci · S1…Sn (puan) · Toplam · Yüzde · Not. "Soru Analizi": Soru · Azami · Ortalama · Ortalama % · Tam puan alan. "Kontrol Edilecekler": uyarılar.
- PDF: sınıf özeti, puan dağılımı, ortalama yüzdesi en düşük 5 soru.
- E-posta metinleri klasiğe göre: rubrik onayı çağrısı, kontrol çağrısı, 3. gün hatırlatması, 7 günlük iptal bildirimi, rapor.

## 8. Ölçüm, maliyet, fiyat

- **Puanlama ölçüm seti** `eval/klasik/cases.json` (sentetik, kişisel veri yok, depoya girer): rubrik + yazıya dökülmüş cevaplar + öğretmen puanları + vaka etiketleri (farklı-doğru, yanlış-yol, desteksiz, iki-hata, hata-taşıma, kavram-sayma, gerekçe, benzer-yanlış, enjeksiyon). `scripts/eval-klasik.ts` gerçek modelle çalıştırır (gerçek maliyet; ürün sahibinin onayıyla).
- **Ölçütler:** `avgDeviationPct` (öğretmene göre ortalama sapma, azaminin yüzdesi), `silentUnderCredit` (öğretmenin tam verdiğine uyarısız düşük öneri), `silentOverCredit` (öğretmenin vermediğine uyarısız fazla öneri), `flaggedRate`.
- **Kabul ölçütleri (ürün sahibi değiştirebilir):** sapma ≤ %10; sessiz eksik ≤ %2; sessiz fazla ≤ %2; ayrıca gerçek kâğıtlarla okuma sadakati (kasıtlı hatalı adımların "düzeltilmemesi") %100; klasik sayfa maliyeti ayrıca ölçülür. Bunlar tutmadan `KLASIK_ENABLED` açılmaz.
- **Fiyat:** klasik sayfanın kaç hak düşeceği ölçümden sonra ürün sahibinin kararı; bu sürüm 1 sayfa = 1 hak davranışını korur.

## 9. Hata durumları

| Durum | Davranış |
|---|---|
| Anahtar fotoğrafı okunamadı | Boş rubrikle `rubric`; e-posta anahtarı yazmayı önerir |
| Rubrik taslağı 3 denemede başarısız | Boş rubrikle `rubric`; öğretmen elle kurar ya da yeniden dener |
| Öğrenci kâğıdı okunamadı | Optikteki gibi `failed`, kontrol aşamasına girerken iade |
| Puanlama başarısız | Kira + geri çekilme ile en çok 3 deneme; sonra soru "puanlanamadı", öğretmen puan girer ya da "yeniden dene" |
| Yapay zekâ çağrısı asılı kaldı | İstemci zaman aşımı kiradan kısa (varsayılan 4 dk, SDK yeniden denemesi yok); yazımlar kira sahipliğiyle korunur (deneme sayısı eşleşmezse sonuç atılır) |
| Rubrik puanlama sürerken değişti | Kâğıt eski sürümle kaydedilir, bir sonraki turda yalnız değişen soru yeniden puanlanır |
| Onay, yeniden puanlama sürerken | 409 |
| Fotoğraf silindikten sonra şekilli soru yeniden puanlanır | Yalnız metinle, `figure` uyarısı ve düşük güvenle |
| Kâğıtta talimat ("tam puan verin") | Kazandırmaz, `instruction_in_answer` |

## 10. Bu işle birlikte düzeltilen inceleme bulguları

1. Kuyruk kira sahipliği: `completePage`/`failPage` yalnız kirayı hâlâ tutan denemede yazar; okuyucu istemcisine zaman aşımı (`READER_TIMEOUT_MS`, varsayılan 240 000) ve `maxRetries: 0`.
2. Saklama: süre `coalesce(submitted_at, created_at)`'ten sayılır; kuyruktaki/okunan/rubrik/kontrol işleri 7 günlük kurala girmez (14 günlük üst sınır sürer); 7 günü geçen taslakların sayfaları tamamen silinir.
3. Optik kontrol: okumada hiç bulunmayan soruya öğretmen düzeltmesi artık uygulanır.
4. Optik anahtar: `null` okunan anahtar sorusu "Anahtarda okunamayan soru" uyarısıyla işi kontrole düşürür; öğretmen anahtar sorusunu düzeltebilir (`override.key`).
5. İki kâğıdın aynı sınıf listesi ismine eşleşmesi uyarı üretir (optik ve klasik).
6. Bozuk düzeltme gövdesi 500 yerine 400 döner (zod).
7. "İlk siparişe özel" Başlangıç paketi hesabın ikinci ödemesinde reddedilir.
8. `app/api/uploads/route.ts` main'den geri getirilir (sahte kapı hunisi). Bekleme listesi formu (inceleme K2) bu işte **bağlanmaz**: KVKK/gizlilik metinleri e-posta toplamayı anlatmıyor; form, aydınlatma metni hukukçu onayıyla güncellendikten sonra bağlanmalı.

## 11. Kapsam dışı

Kâğıtlar arası kopya tespiti; soru bazlı cevap gruplama (yaklaşım C); klasik sayfa fiyat çarpanı; gerçek kâğıtlarla okuma ölçümü (veri gelince); asıl öğretmen ön yüzü (bu sürüm `/hesap` test panelini klasiğe genişletir); KVKK metinlerinin hukukçuyla yenilenmesi.
