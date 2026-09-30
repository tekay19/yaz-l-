# Klasik rubrik puanlaması — uygulama planı (kısa)

> Uygulayan: ana oturum (native). Kullanıcı ayrıntılı plan incelemesini devretti ("devam et kodla"). Commit yok. Her görev sonunda `npx vitest run` + `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-09-30-klasik-rubrik-puanlama-design.md`

## Global kurallar
- Model çıktı şemalarında `optional` yok, yalnız `nullable`. Model puan döndürmez; puan `lib/klasik/score.ts`.
- Klasik iş öğretmen onayı olmadan gönderilmez (`autoDeliverStale` yalnız optik). Rubrik 7 gün, kontrol hatırlatması 3. gün.
- "Kısmen" = yarım puan; toplamlar 0,5'e yuvarlanır. `READER_TIMEOUT_MS` = 240000, SDK `maxRetries: 0`.
- Kullanıcı mesajları Türkçe, kod İngilizce. Kuyruk yazımları kira sahipliğiyle (`id + status='reading' + attempts`).

## Görevler
1. **Şema + tipler + migration** — `db/schema.ts` (job_status 'rubric'; jobs: key_text, rubric, rubric_rev, rubric_approved_at, rubric_ready_at, rubric_draft_at, rubric_draft_attempts, rubric_notified_at, review_reminded_at, fail_reason; pages: grade, graded_rev, grade_attempts, grade_lease_until), `lib/types.ts` (Klasik*, Rubric*, QuestionGrade, PageOverride.key/texts), `drizzle/0002`.
2. **Kuyruk sahipliği + okuyucu zaman aşımı + klasik öğrenci anahtarı beklemez** — `lib/queue.ts` (`completePage/failPage(db, {id, attempts}, …)` → boolean), `worker/process.ts`, `lib/reader/config.ts`.
3. **Saklama düzeltmesi** — `lib/retention.ts` (coalesce(submitted_at, created_at); 7 gün yalnız delivering/done/failed; 14 gün üst sınır; eski taslak sayfaları silinir).
4. **Optik inceleme düzeltmeleri** — `lib/report/input.ts` (eksik soruya düzeltme, anahtar düzeltmesi + `keyFlags`, aynı isim uyarısı, ReportInput: mode/keyFlags/klasik, satır points/total/max), `lib/jobs/review.ts` (OptikPatch zod, saveKeyOverride), PATCH/review rotaları.
5. **Başlangıç yalnız ilk sipariş** — `lib/payments/iyzico.ts` (`IntroPackUsed`), checkout rotası.
6. **Klasik çekirdek (saf)** — `lib/klasik/evidence.ts` (quoteFound), `sheets.ts` (mergeSheets, answerText), `score.ts` (scoreQuestion, scoreSheet, FLAG_TEXT, questionMax), `grade.ts` (toGrade, failedGrade), `rubric.ts` (RubricInput zod, normalizeDraft, rubricProblems, amendRubric, fromInput).
7. **Okuyucu** — `lib/reader/klasik-prompts.ts`, `schemas.ts` (KlasikReadSchema, RubricDraftSchema, GradeOutputSchema), `claude.ts`/`openai.ts` (`readKlasik`, `draftRubric`, `gradeKlasik`).
8. **Klasik rapor** — `lib/report/klasik.ts` (buildKlasikInput, sheetStudent), `excel.ts`, `pdf.ts`.
9. **Klasik worker akışı** — `lib/klasik/worker.ts` (draftPendingRubrics, gradePending, completeKlasikJobs, expireRubrics), `lib/klasik/notify.ts` (notifyRubric, remindKlasikReview), `lib/jobs/progress.ts` (klasik no-op), `lib/jobs/deliver.ts` (failReason metinleri, klasik e-postaları, autoDeliver yalnız optik), `worker/main.ts`.
10. **Klasik API** — `lib/klasik/jobs.ts` (setKeyText, rubricView, saveRubric, approveRubric, redraftRubric, acceptAnswer, saveKlasikOverride, requestRegrade, regradesPending, klasikReviewView), `lib/klasik/http.ts`, rotalar: key-text, rubric (GET/PUT), rubric/approve, rubric/redraft, rubric/accept, pages/[pageId]/regrade; değişen: jobs POST, pages POST (çok anahtar), submit (key_text), review, approve, me.
11. **Konsol arayüzü** — `components/console/api.ts`, `JobFlow.tsx`, `DraftJob.tsx`, `RubricCard.tsx`, `KlasikReviewCard.tsx`, `ReviewCard.tsx` (anahtar düzeltme), `app/globals.css`.
12. **Ölçüm** — `lib/eval/klasik-metrics.ts`, `scripts/eval-klasik.ts`, `eval/klasik/cases.json`, `eval/README.md`.
13. **Sahte kapı + belgeler** — `app/api/uploads/route.ts` (main'den), `.env.example`, `docs/api.md`, `docs/kvkk-taslak.md`.
14. **Uçtan uca doğrulama** — sahte yapay zekâ + sahte SMTP + Postgres ile tam akış; `next build`.

## İnceleme odağı (testle sabitlenecek)
1. Model bilinmeyen ölçüt kimliği döndürür ya da birini atlar → atlanan `not_met`, bilinmeyen yok sayılır.
2. Kanıt alıntısı boşluk/büyük-küçük harf/tırnak farkıyla gelir → yine bulunur; uydurma alıntı bulunmaz.
3. Arka yüz aynı sorunun devamını taşır → satırlar ön yüzün ardına eklenir.
4. Rubrik puanlama sürerken değişir → yalnız değişen soru yeniden puanlanır.
5. Model istenen bir soruyu çıktıda atlar → kâğıt yeniden denenir, 3. denemede "puanlanamadı".
