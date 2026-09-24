# Düzeltme.md — Backend Planı İnceleme Bulguları ve Düzeltmeleri

Kaynak: [2026-09-23-sinavoku-backend.md](2026-09-23-sinavoku-backend.md) planının tam okunmasından çıkan bulgular (2026-09-24 incelemesi). Plan henüz uygulanmadığı için (tüm görevler `- [ ]`), düzeltmeler doğrudan plan metnine işleniyor — yani hatalar koda değil, henüz yazılmamış kodun tarifine düzeltiliyor.

Her madde: bulgu → karar/düzeltme → plandaki uygulama yeri. İşaretlenmemiş (`- [ ]`) = henüz uygulanmadı, işaretli (`- [x]`) = plan metnine işlendi.

---

- [x] **D1 — Aşamalı çıkış planlanmamış (stratejik + küçük bir kod boşluğu)**
  Kaynak rapor (`SinavOku-Durum-Raporu.pdf`, §5) açıkça "önce talep doğrula, klasik sınavı en son ekle" diyor; plan Faz 0-7'yi kesintisiz tek blok sunuyordu. Ayrıca Task 15 atlanırsa `POST /api/jobs` klasik sınavı yine kabul ediyor, worker da açık uçlu kâğıdı optik okuyucuyla okuyup anlamsız bir puan üretiyordu.
  **Uygulama:** Plan girişine önerilen sıra eklendi: Task 1-14 → Task 16-17 → yayın → talep doğrulama → Task 15 (Faz 7 Task 15'e bağımlı değil). Task 4'ün ucuna `KLASIK_ENABLED` bayrağı (varsayılan `false`) eklendi ve `.env.example`'a yazıldı; Task 15 Step 8'e bayrağın ne zaman açılacağı yazıldı. Klasiği yayına alma kararı ürün sahibinde kalıyor.

- [x] **D2 — Klasik sınavda arkalı-önlü birleştirme hiç yapılmıyor (yüksek, kod hatası)**
  Task 14 optik için arka sayfa birleştirmeyi `buildReportInput`'a ekliyor; Task 15'in `buildKlasikInput`'ı bu birleştirmeden **geçmeden** dönüyor (early return, merge bloğundan önce). Sonuç: iki taraflı klasik kağıtlar iki ayrı, eksik ve yanlış puanlı satıra bölünür.
  **Uygulama:** `buildKlasikInput` içine, Task 14'ün optik birleştirmesinin klasik (`klasik-student`) karşılığı olan kendi birleştirme adımı eklendi + `tests/worker/klasik.test.ts`'e arkalı-önlü birleşme testi eklendi.

- [x] **D3 — HEIC (iPhone) fotoğrafları muhtemelen `normalizeImage`'de patlıyor (yüksek, kod riski)**
  `sharp`'ın prebuilt binary'leri HEVC patent lisansı yüzünden HEIC decode etmiyor; mevcut (silinecek) `app/api/uploads/route.ts` HEIC'i açıkça destekliyor. Task 4 bunu ele almıyordu.
  **Uygulama:** `lib/images.ts`'e HEIC byte-imzası tespiti + `heic-convert` (saf JS, libheif gerektirmez) ile JPEG'e önce çevirme adımı eklendi; `heic-convert` bağımlılığı ve `types/heic-convert.d.ts` eklendi; Step 6'ya gerçek bir HEIC dosyasıyla elle doğrulama notu eklendi.

- [x] **D4 — Klasik mod için doğruluk/maliyet kapısı hiç tekrarlanmıyor (yüksek, süreç eksiği)**
  Task 7'nin sıkı kabul kriterleri (`silentWrongRate`, `usdPerPage`, `secondsPerPage`) yalnızca `readKey`/`readStudent` (optik) üzerinden ölçülüyor; `readKlasikKey`/`readKlasikStudent` hiç ölçülmeden Faz 6 "commit" ile kapanıyor. Rapor B2'yi ("klasik puanlama en belirsiz kısım") tam da bu yüzden ayrı bir darboğaz sayıyor.
  **Uygulama:** Task 15'e, commit'ten önce çalıştırılması gereken yeni bir adım eklendi: `scripts/eval-reader.ts`'i klasik moda genişletme + klasik'e özgü kabul kriterleri (puan sapması, `flaggedRate`, maliyet).

- [x] **D5 — 7 günlük fotoğraf silme, kontrol ekranını kör bırakabiliyor (orta)**
  `review` durumunda 7 günü geçen işlerin fotoğrafı siliniyor; öğretmen o zamana kadar incelemediyse kontrol ekranında görsel kanıt kalmıyor.
  **Uygulama:** `runRetention`, `review` durumundaki işlerin fotoğraflarını 7 gün yerine onaylanana kadar veya en geç 14 gün (üst sınır) saklayacak şekilde değiştirildi.

- [x] **D6 — Sınıf listesi (roster) girilmezse isim eşleştirme sessizce devre dışı kalıyor (orta)**
  Roster opsiyonel; girilmezse yüksek güvenle ama yanlış okunan isimler hiç işaretlenmiyor, öğretmen bunun farkında olmuyor.
  **Uygulama:** Roster boşsa rapor e-postasına açık bir uyarı cümlesi eklendi ("isimler çapraz kontrol edilmedi").

- [x] **D7 — Sağlık kontrolü sığ, yedek geri yükleme hiç test edilmemiş (orta)**
  `/api/health` yalnızca DB'yi kontrol ediyor; disk/`UPLOAD_DIR` yazılabilirliği veya worker'ın canlılığı kontrol edilmiyor; backup script'i restore adımı hiç doğrulanmamış.
  **Uygulama:** `/api/health` disk yazma kontrolü ile genişletildi; `docs/deploy.md`'ye kurulumdan sonra bir kez yedek geri yükleme tatbikatı adımı eklendi.

---

## Yan etkiler (tutarlılık için plana ayrıca işlenenler)

- **D5 → Global Kısıtlar:** "hiçbir fotoğraf 7 günden uzun tutulmaz" satırı, `review` işleri için 14 günlük üst sınırı içerecek şekilde güncellendi (yoksa plan kendi kuralıyla çelişirdi).
- **D5 → Task 16 Interfaces:** `REVIEW_PHOTO_TTL_DAYS = 14` sabiti listeye eklendi.
- **D5 → Task 16 Step 5 (KVKK metinleri):** kullanıcıya gösterilecek saklama süresi cümlesi 14 günlük istisnayı içerecek şekilde güncellendi; hukukçu onayı şartı aynen korundu.
- **D5 → mevcut retention testi:** eski test `review` durumundaki bir işin fotoğrafının 8. günde silinmesini *bekliyordu* — yani eski davranışı kilitliyordu. `done` durumuna çevrildi, `review` için ayrı test eklendi.
- **D4 → veri klasörü:** klasik değerlendirme verisi `eval/data/klasik/` alt klasörüne konuyor; aynı klasörde olsaydı `usdPerPage`/`secondsPerPage` optik ile klasiğin karışımı çıkardı. Alt klasör zaten `.gitignore`/`.dockerignore` kapsamında.
- **D3 → hız notu:** `heic-convert` WASM tabanlı ve istek sırasında `app` sürecinde çalışıyor; 50 fotoğraflık bir yüklemede 2 vCPU'luk sunucuyu zorlayıp zorlamadığının ölçülmesi elle doğrulama adımına eklendi.
- **Kontrol Turları → Tur 4:** planın kendi denetim bölümüne bu 7 düzeltmeyi özetleyen bir "Tur 4 — Dış inceleme" eklendi.

## Düzeltme sırasında kendi hatalarımdan düzeltilenler

- **Yedek tatbikatı komutu yanlıştı:** ilk yazdığım `docker compose run --rm ... db pg_restore --list backups/...` yeni bir kapsayıcı açar; hosttaki `backups/` oraya bağlı olmadığı için dosyayı bulamazdı. Ayrıca `--list` yalnız içindekiler tablosunu okur, gerçek geri yükleme değildir. Ayrı bir `sinavoku_tatbikat` veritabanına stdin üzerinden gerçek geri yükleme + satır sayısı kontrolü + silme adımlarına çevrildi.
- **D2 testi kararsızdı (flaky):** sahte okuyucu cevapları çağrı sırasına göre veriyordu; iki öğrenci sayfası kuyruktan aynı turda çıktığı ve sıraları `createdAt`'e bağlı olduğu için, aynı zaman damgası durumunda ön/arka cevapları karışabilirdi. Okuyucu artık fotoğrafın içeriğine (`'front'`/`'back'`) göre cevap veriyor.

## Uygulanmayan / bilinçli olarak dışarıda bırakılanlar

Yok — 7 maddenin hepsi plana işlendi. Yalnızca D1'in ürün kararı kısmı (klasik sınavı ne zaman açmak) bilinçli olarak ürün sahibine bırakıldı; bu kararı uygulamaya koyacak bayrak plana eklendi.

## Sıradaki adım

Plan artık uygulanmaya hazır. D1 gereği önerilen sıra: Task 1-14 (optik akış + ödeme + kontrol ekranı) → Task 16-17 (KVKK saklama + sunucu) → yayın → talep doğrulama → Task 15 (klasik; ölçüm kapısını geçerse `KLASIK_ENABLED=true`). Uygulamaya Task 1'den başlanabilir.
