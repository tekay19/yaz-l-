# SınavOku API (ön yüz sözleşmesi)

Tüm uçlar JSON döner; hata gövdesi `{ "error": "<Türkçe mesaj>" }`. Oturum `so_user` çerezi ile (30 gün; şifre değişince, sıfırlanınca ya da hesap askıya alınınca geçersizleşir).

E-postası doğrulanmamış hesap `POST /api/jobs`, `POST /api/jobs/:id/submit` ve `POST /api/pay/checkout` uçlarında 403 `{ error, code: "unverified" }` alır.

Yönetim uçları (`/api/admin/*`) yalnızca `role = admin` olan hesaba açıktır: oturum yoksa 401, öğretmen hesabıyla 403. Değişiklik yapan istekler (GET dışı) yalnızca kendi sitemizden kabul edilir. Uçlar: `overview`, `users`, `users/:id` (POST `action`: pages, suspend, unsuspend, role, verify, reset), `jobs`, `jobs/:id` (POST `action: close`), `payments`, `payments/:id` (POST `action: reconcile`), `analytics` (GET, DELETE), `audit`. Her yönetici işlemi `admin_actions` tablosuna yazılır.

| Uç | Gövde | Başarılı yanıt | Hatalar |
|---|---|---|---|
| POST /api/auth/register | `{ name, email, password }` | 201 `{ ok, role }` + oturum çerezi | 400 `{ error, field }`, 403 (başka site), 409 (e-posta kayıtlı), 429 |
| POST /api/auth/login | `{ email, password }` | 200 `{ ok, role }` + oturum çerezi | 401, 403 (askıda / başka site), 429 |
| POST /api/auth/logout | — | `{ ok: true }` | — |
| POST /api/auth/forgot | `{ email }` | 200 `{ ok: true }` (hesap olsun olmasın aynı) | 400, 429 |
| POST /api/auth/reset | `{ token, password }` | 200 `{ ok, role }` + oturum çerezi | 400, 403, 429 |
| POST /api/auth/verify | `{ token }` | 200 `{ ok: true }` | 400, 403, 429 |
| POST /api/auth/verify/resend | — | 200 `{ ok }` | 401, 429 |
| GET /api/me | — | `{ email, name, role, verified, pageBalance, settings, klasik }` | 401 |
| POST /api/me/password | `{ current, next }` | 200 `{ ok }` (diğer oturumlar kapanır) | 400 `{ error, field }`, 401 |
| POST /api/jobs | `{ title, mode: "optik"\|"klasik", klasikMax?: number[] }` | 201 `{ id }` | 400, 401 |
| GET /api/jobs | — | `JobStatusView[]` | 401 |
| GET /api/jobs/:id | — | `JobStatusView` | 401, 404 |
| POST /api/jobs/:id/pages | multipart `file`, `kind: "key"\|"student"` | 201 `{ id, seq }` | 400, 404, 409, 413, 415, 429 |
| DELETE /api/jobs/:id/pages/:pageId | — | 204 | 404, 409 |
| POST /api/jobs/:id/submit | `{ consent: true, noRoster?: true }` | 202 `{ ok, reserved }` | 400 (`no_roster` dahil), 402 `{ need, have }`, 409 |
| POST /api/pay/checkout | `{ pack }` | `{ paymentPageUrl }` | 400, 401 |
| PUT /api/jobs/:id/roster | `{ roster: "Ad Soyad\nAd Soyad" }` | `{ count }` | 404, 409 |
| GET /api/jobs/:id/review | — | `{ roster, key, rows[{…, flags, imageUrl}], failed }` | 404 |
| GET /api/jobs/:id/pages/:pageId | — | image/jpeg | 404 |
| PATCH /api/jobs/:id/pages/:pageId | `{ studentName?, answers?: [{q, marked[]}], points?: [{q, points}] }` | `{ ok }` | 400, 409 |
| POST /api/jobs/:id/approve | — | 202 | 404, 409 |

İlerleme: gönderimden sonra `GET /api/jobs/:id` 5 saniyede bir sorgulanır; `status` `done` olunca "Rapor e-postanıza gönderildi" gösterilir, `review` olunca kontrol ekranına yönlendirilir (Task 14), `failed` olunca "Cevap anahtarı okunamadı, hakkınız iade edildi" gösterilir.

Klasik sınav: sunucuda `KLASIK_ENABLED=true` olmadıkça `POST /api/jobs` `mode: "klasik"` isteğini 400 ile reddeder ("Klasik sınav henüz açık değil."). Ön yüz bu seçeneği o zamana kadar göstermemelidir (Düzeltme.md D1).

Sınıf listesi: listesi kaydedilmemiş bir sınav `noRoster: true` olmadan gönderilirse 400 `{ error: "no_roster" }` döner. Ön yüz bu durumda "Sınıf listesi olmadan devam et" onayını gösterir; onaylanınca aynı istek `noRoster: true` ile tekrarlanır. Listesiz sınavda isimler yalnızca fotoğraftan okunur; isme benzemeyen yazılar "İsim net okunamadı" uyarısıyla kontrol ekranına düşer.

Fotoğraf kontrolü: `POST /api/jobs/:id/pages` çok küçük (uzun kenar 1000 pikselin altında), çok karanlık veya bulanık fotoğrafı 415 ve ne yapılacağını söyleyen Türkçe bir mesajla reddeder.

Kontrol bekleyen sınav: okuma bitince okunamayan sayfaların hakkı hemen iade edilir ve öğretmene "kontrolünüz bekleniyor" e-postası gider. Sınav 3 gün içinde onaylanmazsa rapor okunduğu haliyle gönderilir.

## Klasik sınav (açık uçlu)

Tasarım: `docs/superpowers/specs/2026-09-30-klasik-rubrik-puanlama-design.md`. Sunucuda `KLASIK_ENABLED=true` değilse `POST /api/jobs` klasik isteğini 400 ile reddeder; `GET /api/me` yanıtındaki `klasik: boolean` ön yüze bunu söyler.

Akış: `draft` → gönder → (sayfalar hemen okunur; anahtardan rubrik taslağı çıkar) → `rubric` (öğretmen düzenler, onaylar) → `processing` (puanlama) → `review` (öğretmen kontrol eder) → `delivering` → `done`. Rubrik 7 gün içinde onaylanmazsa iş `failed` olur (`fail_reason = rubric_expired`) ve tüm hak iade edilir. Klasik iş hiçbir zaman öğretmen onayı olmadan gönderilmez.

| Uç | Gövde | Başarılı yanıt | Hatalar |
|---|---|---|---|
| POST /api/jobs | `{ title, mode: "klasik", klasikMax?: number[] }` (puanlar isteğe bağlı; rubrik taslağına önceden dolar) | 201 `{ id }` | 400, 401 |
| POST /api/jobs/:id/pages | `kind: "key"` klasikte birden çok kez (en fazla 10 anahtar sayfası) | 201 | optikteki gibi |
| PUT /api/jobs/:id/key-text | `{ text }` — yazılı/yapıştırılmış anahtar (`draft` ve `rubric` aşamasında) | `{ ok }` | 404, 409 |
| POST /api/jobs/:id/submit | optikteki gibi; klasikte anahtar fotoğrafı ya da yazılı anahtar yeterli | 202 | optikteki gibi |
| GET /api/jobs/:id/rubric | — | `{ status, keyText, rubric, approved, problems[] }` | 404 |
| PUT /api/jobs/:id/rubric | `{ questions: RubricQuestion[] }` (yalnız `rubric` aşamasında) | `{ rubric }` | 400 (Türkçe neden), 409 |
| POST /api/jobs/:id/rubric/approve | — | 202 | 400 (`Rubrikte hiç soru yok.`), 409 |
| POST /api/jobs/:id/rubric/redraft | — (anahtardan taslağı yeniden oluşturur) | 202 | 409 |
| GET /api/jobs/:id/review | — | `{ mode: "klasik", roster, rubric, sheets[{ pageId, seqs, student, nameFlags, total, max, percent, imageUrls, questions[{ q, points, max, status, lines, criteria[{ text, points, verdict, evidence, earned, counted }], notes[{ code, text, attention }], note, firstError }] }], failed, pending }` | 404 |
| PATCH /api/jobs/:id/pages/:pageId | `{ studentName?, points?: [{ q, points \| null }], texts?: [{ q, text }] }` — `points: null` öğretmen puanını kaldırır; `texts` o soruyu yeniden puanlatır | `{ ok }` | 400, 404, 409 |
| POST /api/jobs/:id/rubric/accept | `{ pageId, q, note? }` — "Bu cevabı kabul et, rubriğe ekle": soru, elle puanlanmamış tüm kâğıtlarda yeniden puanlanır | 202 | 400, 404, 409 |
| POST /api/jobs/:id/pages/:pageId/regrade | — (puanlaması başarısız kâğıt için) | 202 | 404, 409 |
| POST /api/jobs/:id/approve | — | 202 | 409 (yeniden puanlama sürerken) |

## Diğer değişiklikler (2026-09-30)

- Optik kontrol: `GET /api/jobs/:id/review` yanıtına `keyPageId` ve `keyFlags` eklendi. Okunamayan anahtar sorusu işi kontrole düşürür; öğretmen `PATCH /api/jobs/:id/pages/:keyPageId` ile `{ key: [{ q, option: "A".."E" | null }] }` gönderir (`null` = soru iptal, kimseye puanlanmaz).
- `PATCH /api/jobs/:id/pages/:pageId` gövdesi doğrulanır; bozuk gövde 500 yerine 400 döner.
- `POST /api/pay/checkout`: Başlangıç paketi hesabın ilk ödemesinden sonra 400 `Başlangıç paketi yalnızca ilk siparişte alınabilir.` döner.
