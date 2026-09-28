# SınavOku API (ön yüz sözleşmesi)

Tüm uçlar JSON döner; hata gövdesi `{ "error": "<Türkçe mesaj>" }`. Oturum `so_user` çerezi ile.

| Uç | Gövde | Başarılı yanıt | Hatalar |
|---|---|---|---|
| POST /api/auth/login | `{ email }` | 200 `{ ok: true }` | 400, 429 |
| GET /api/me | — | `{ email, pageBalance }` | 401 |
| POST /api/auth/logout | — | `{ ok: true }` | — |
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
