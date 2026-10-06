'use client';

// The accuracy/cost gate of eval/README.md, run from the browser: the admin
// picks photos, labels each by hand, then every labelled photo is read one
// by one through /api/admin/eval and scored as it comes in, with the same
// arithmetic as scripts/eval-reader.ts. Photos stay in this tab; labels are
// kept in this browser so an hour of labelling survives a reload.

import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCriteria, summarize, type Check, type Gate } from '@/lib/eval/metrics';
import { PAID_PACKS } from '@/lib/packs';
import type { Effort } from '@/lib/reader/types';
import type { StudentRead } from '@/lib/types';
import { createEvalApi } from './api';
import { browserStore, fileKey, loadLabels, saveLabels, type Label, type Labels } from './labels';
import { failed, report, score, tally, type Run } from './run';
import LabelSheet, { blankLabel } from './LabelSheet';

type Photo = { key: string; file: File; url: string };

const EFFORTS: [Effort, string][] = [['low', 'Düşük'], ['medium', 'Orta'], ['high', 'Yüksek']];
// the cheapest page a teacher can buy; the gate wants cost ≤ half of it
const CHEAPEST_PAGE_TRY = Math.min(...PAID_PACKS.map((p) => p.price / p.pages));
const MIN_KEYS = 1;
const MIN_STUDENTS = 40;
const STOP_AFTER_FAILURES = 3;

// Turkish keyboards type "41,5"
const positive = (s: string) => {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (v: number | null, digits: number) =>
  v === null ? '—' : v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function EvalScreen() {
  const api = useMemo(() => createEvalApi(), []);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [loaded, setLoaded] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState(20);

  const [effort, setEffort] = useState<Effort>('medium');
  const [priceIn, setPriceIn] = useState('5');
  const [priceOut, setPriceOut] = useState('25');
  const [rate, setRate] = useState('');
  const [concurrency, setConcurrency] = useState('4');

  const [runs, setRuns] = useState<{ key: string; run: Run }[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [runNote, setRunNote] = useState('');
  const stop = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { api.signedIn().then(setAuthed); }, [api]);
  useEffect(() => { setLabels(loadLabels(browserStore())); setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveLabels(browserStore(), labels); }, [labels, loaded]);

  // leaving the page stops a run and frees the photo previews
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => {
    stop.current = true;
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
  }, []);

  const running = progress !== null;
  const runByKey = new Map(runs.map((r) => [r.key, r.run]));
  const ready = photos.filter((p) => labels[p.key]?.done);
  const currentPhoto = photos.find((p) => p.key === current) ?? null;

  function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    const have = new Set(photos.map((p) => p.key));
    const added: Photo[] = [];
    for (const file of list) {
      if (have.has(fileKey(file))) continue; // already on the list
      have.add(fileKey(file));
      added.push({ key: fileKey(file), file, url: URL.createObjectURL(file) });
    }
    setPhotos([...photos, ...added]);
    if (!current && added[0]) setCurrent(added[0].key);
  }

  function removePhoto(p: Photo) {
    URL.revokeObjectURL(p.url);
    setPhotos(photos.filter((x) => x.key !== p.key));
    if (current === p.key) setCurrent(null);
  }

  function clearLabels() {
    if (!window.confirm('Bu tarayıcıdaki bütün ölçüm etiketleri silinsin mi? Bu geri alınamaz.')) return;
    setLabels({});
  }

  function setLabel(key: string, label: Label) {
    setLabels((prev) => ({ ...prev, [key]: label }));
    setLastCount(label.questionCount);
  }

  // the next photo still waiting for a confirmed label, else simply the next one
  function next() {
    if (!photos.length) return;
    const at = photos.findIndex((p) => p.key === current);
    const after = [...photos.slice(at + 1), ...photos.slice(0, at + 1)];
    setCurrent((after.find((p) => !labels[p.key]?.done) ?? after[0]).key);
  }

  async function start() {
    if (!ready.length || running) return;
    const effortName = EFFORTS.find(([e]) => e === effort)?.[1];
    const ok = window.confirm(
      `${ready.length} fotoğraf gerçek API ile "${effortName}" eforla okunacak. Her okuma ücretlidir. Başlansın mı?`,
    );
    if (!ok) return;
    const todo = ready.map((p) => ({ p, label: labels[p.key] as Label })); // labels as they are now
    stop.current = false;
    setRuns([]);
    setRunNote('');
    let failures = 0;
    for (const [i, { p, label }] of todo.entries()) {
      if (stop.current) {
        setRunNote(`Durduruldu: ${i}/${todo.length} fotoğraf okundu.`);
        break;
      }
      setProgress({ done: i, total: todo.length });
      const r = await api.read(p.file, label, effort);
      const run = r.ok ? score(p.file.name, label, r.data) : failed(p.file.name, label, r.error);
      setRuns((prev) => [...prev, { key: p.key, run }]);
      failures = r.ok ? 0 : failures + 1;
      if (!r.ok && (r.status === 401 || r.status === 0)) {
        setRunNote(r.error);
        break;
      }
      if (failures >= STOP_AFTER_FAILURES) {
        setRunNote(`Üst üste ${STOP_AFTER_FAILURES} okuma başarısız olduğu için ölçüm durduruldu. Son hata: ${r.ok ? '' : r.error}`);
        break;
      }
    }
    setProgress(null);
  }

  // ── Results ──
  const all = runs.map((r) => r.run);
  const t = tally(all);
  const pIn = positive(priceIn);
  const pOut = positive(priceOut);
  const prices = { inPerM: pIn ?? 0, outPerM: pOut ?? 0 };
  const summary = summarize(t.totals, prices);
  const gate: Gate = {
    // without both prices and a rate the cost criterion stays undecided
    tryPerUsd: pIn !== null && pOut !== null ? positive(rate) : null,
    pagePriceTry: CHEAPEST_PAGE_TRY,
    concurrency: positive(concurrency) ?? 1,
  };
  const checks = checkCriteria(summary, gate);
  const enough = t.keys >= MIN_KEYS && t.students >= MIN_STUDENTS;
  const failing = checks.filter((c) => c.pass === false).length;
  const undecided = checks.filter((c) => c.pass === null).length;

  function download() {
    const at = new Date().toISOString();
    const data = report(all, { at, prices, gate });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `olcum-${data.effort ?? 'efor'}-${at.slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authed === null) return <div className="panel-login" />;
  if (!authed) {
    return (
      <div className="panel-login">
        <div className="card panel-login-card">
          <h1>Ölçüm ekranı</h1>
          <p className="small muted">Bu sayfa yönetici oturumu ister. Önce panelden giriş yapın, sonra buraya dönün.</p>
          <a href="/panel" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>Panele git</a>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-page">
      <header className="panel-head">
        <div className="panel-wrap">
          <a href="/" className="logo">
            <span className="logo-mark" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            SınavOku <span className="panel-badge">ölçüm</span>
          </a>
          <div className="panel-actions">
            <a href="/panel" className="btn btn-ghost btn-sm">Panel</a>
          </div>
        </div>
      </header>

      <main className="panel-wrap panel-main">
        <p className="panel-note">
          Her okuma Anthropic API&apos;ye gerçek bir istektir ve ücretlidir. Fotoğraflar sunucuda saklanmaz; etiketler yalnız bu
          tarayıcıda tutulur. Kâğıtlar izinli olmalı, adlar gerçek öğrencilere ait olmamalı (öğretmenin doldurduğu örnekler).
          Karar için en az {MIN_KEYS} cevap anahtarı + {MIN_STUDENTS} öğrenci kâğıdı gerekir; sette farklı ışık, açı, silinmiş ve
          çift işaret, boş soru bulunmalı (eval/README.md).
        </p>

        <section className="panel-card">
          <div className="console-row between">
            <div>
              <h2>1. Fotoğraflar</h2>
              <p className="small muted">
                {photos.length} fotoğraf · {ready.length} etiketi onaylı
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={running} onClick={() => fileInput.current?.click()}>
              Fotoğraf ekle
            </button>
            <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
          </div>
          {photos.length === 0 ? (
            <p className="empty">Henüz fotoğraf yok. Aynı fotoğrafları yeniden seçerseniz etiketleri geri gelir.</p>
          ) : (
            <div className="eval-photos">
              {photos.map((p) => {
                const label = labels[p.key];
                const run = runByKey.get(p.key);
                const [text, tone] = photoStatus(label, run);
                return (
                  <div key={p.key} className={`eval-photo-item${p.key === current ? ' on' : ''}`}>
                    <button type="button" className="n" onClick={() => setCurrent(p.key)} title={p.file.name}>
                      {p.file.name}
                      <span className={`s ${tone}`}>{text}</span>
                    </button>
                    <button type="button" className="x" aria-label={`${p.file.name} kaldır`} disabled={running}
                      onClick={() => removePhoto(p)}>×</button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="console-row">
            <button type="button" className="btn btn-ghost btn-sm console-danger" onClick={clearLabels}
              disabled={running || !Object.keys(labels).length}>
              Kayıtlı etiketleri sil
            </button>
          </div>
        </section>

        {currentPhoto && (
          <section className="panel-card">
            <h2>2. Etiket</h2>
            <p className="small muted">Kâğıtta gerçekte ne varsa onu girin. Modelin okuması burada gösterilmez.</p>
            <LabelSheet
              key={currentPhoto.key}
              name={currentPhoto.file.name}
              url={currentPhoto.url}
              label={labels[currentPhoto.key] ?? blankLabel('student', lastCount)}
              locked={running}
              onChange={(l) => setLabel(currentPhoto.key, l)}
              onNext={next}
            />
          </section>
        )}

        <section className="panel-card">
          <h2>3. Ölçüm</h2>
          <p className="small muted">Onaylı etiketi olan fotoğraflar sırayla, tek tek okunur; sonuçlar geldikçe aşağıda güncellenir.</p>
          <div className="eval-settings">
            <div className="field">
              <label>Efor</label>
              <div className="seg" role="group" aria-label="Efor">
                {EFFORTS.map(([e, name]) => (
                  <button key={e} type="button" className={effort === e ? 'on' : undefined} disabled={running}
                    onClick={() => setEffort(e)}>{name}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="eval-in">Girdi $ / 1M token</label>
              <input id="eval-in" inputMode="decimal" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="eval-out">Çıktı $ / 1M token</label>
              <input id="eval-out" inputMode="decimal" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="eval-rate">Kur (₺ / $)</label>
              <input id="eval-rate" inputMode="decimal" placeholder="örn. 41,50" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="eval-conc">Eş zamanlı okuma</label>
              <input id="eval-conc" inputMode="numeric" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
            </div>
          </div>
          <p className="field-hint" style={{ marginTop: 8 }}>
            Fiyatlar Claude Opus 5 içindir. Eş zamanlı okuma, sunucudaki WORKER_CONCURRENCY değeridir. Kur boşsa maliyet ölçütü karara girmez.
          </p>
          <div className="console-row">
            {running ? (
              <button type="button" className="btn btn-ghost btn-sm console-danger" onClick={() => { stop.current = true; }}>
                Durdur
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={start} disabled={!ready.length}>
                Ölçümü başlat ({ready.length} fotoğraf)
              </button>
            )}
            {progress && <span className="small muted">Okunuyor: {progress.done + 1} / {progress.total}</span>}
          </div>
          {runNote && <p className="console-banner err">{runNote}</p>}
        </section>

        {runs.length > 0 && (
          <section className="panel-card">
            <div className="console-row between">
              <div>
                <h2>Sonuç</h2>
                <p className="small muted">
                  {t.totals.pages} sayfa okundu ({t.keys} anahtar, {t.students} öğrenci)
                  {t.failed > 0 && `, ${t.failed} fotoğraf okunamadı (oranlara girmez)`} · {t.totals.questions} soru
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={download} disabled={running}>JSON indir</button>
            </div>

            <Verdict enough={enough} failing={failing} undecided={undecided} keys={t.keys} students={t.students} running={running} />

            <div className="table-wrap">
              <table className="panel-table">
                <thead>
                  <tr><th>Ölçüt</th><th>Değer</th><th>Eşik</th><th>Sonuç</th></tr>
                </thead>
                <tbody>
                  {checks.map((c) => <CheckRow key={c.key} c={c} />)}
                </tbody>
              </table>
            </div>

            <p className="small muted" style={{ marginTop: 12 }}>
              Sayfa başına {fmt(summary.secondsPerPage, 1)} sn · ${fmt(summary.usdPerPage, 4)} · token: {t.totals.tokensIn.toLocaleString('tr-TR')} girdi /{' '}
              {t.totals.tokensOut.toLocaleString('tr-TR')} çıktı
            </p>

            <div className="table-wrap">
              <table className="panel-table">
                <thead>
                  <tr><th>#</th><th>Fotoğraf</th><th>Tür</th><th>Ad</th><th>Sessiz yanlış</th><th>İşaretli</th><th>Hatalar (doğrusu → okunan)</th><th>Süre</th></tr>
                </thead>
                <tbody>
                  {all.map((r, i) => (
                    <tr key={runs[i].key}>
                      <td>{i + 1}</td>
                      <td>{r.file}</td>
                      <td>{r.kind === 'key' ? 'Anahtar' : 'Öğrenci'}</td>
                      {r.ok ? (
                        <>
                          <td>{nameCell(r)}</td>
                          <td className={r.result.silentWrong ? 'eval-fail' : undefined}>{r.result.silentWrong}</td>
                          <td>{r.result.flagged}</td>
                          <td className="eval-mistakes">
                            {r.result.mistakes.length ? r.result.mistakes.map((m) => `${m.q}: ${m.want} → ${m.got}`).join(' · ') : '—'}
                          </td>
                          <td>{fmt(r.ms / 1000, 1)} sn</td>
                        </>
                      ) : (
                        <td colSpan={5} className="eval-fail">Okunamadı: {r.error}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function photoStatus(label: Label | undefined, run: Run | undefined): [string, string] {
  if (run && !run.ok) return ['Okunamadı', 'err'];
  if (run?.ok) {
    const wrong = run.result.silentWrong;
    return [wrong ? `${wrong} sessiz yanlış` : 'Hatasız', wrong ? 'err' : 'ok'];
  }
  if (!label) return ['Etiket yok', ''];
  const kind = label.kind === 'key' ? 'Anahtar' : 'Öğrenci';
  return label.done ? [`${kind} · onaylı`, 'ok'] : [`${kind} · onaysız`, ''];
}

function nameCell(r: Extract<Run, { ok: true }>) {
  if (r.result.name === null) return '—';
  if (r.result.name === 'ok') return 'doğru';
  const got = (r.read as StudentRead).studentName;
  return <span className="eval-fail">yanlış ({got ? `"${got}"` : 'okunmadı'})</span>;
}

function CheckRow({ c }: { c: Check }) {
  const digits = c.key === 'costTry' ? 3 : c.key === 'classSeconds' ? 0 : 2;
  return (
    <tr>
      <td>{c.label}</td>
      <td>{fmt(c.value, digits)}</td>
      <td>{c.limit}</td>
      <td className={c.pass === null ? 'eval-na' : c.pass ? 'eval-pass' : 'eval-fail'}>
        {c.pass === null ? '— veri yok' : c.pass ? '✓ tuttu' : '✗ tutmadı'}
      </td>
    </tr>
  );
}

function Verdict({ enough, failing, undecided, keys, students, running }: {
  enough: boolean; failing: number; undecided: number; keys: number; students: number; running: boolean;
}) {
  if (running) return null;
  if (failing) {
    return (
      <p className="console-banner err">
        Kapı kapalı kalır: {failing} ölçüt tutmadı. eval/README.md&apos;deki sırayla düzeltip (önce prompt, sonra efor) yeniden ölçün.
      </p>
    );
  }
  if (!enough) {
    return (
      <p className="panel-note" style={{ marginTop: 12 }}>
        Karar için yeterli değil: en az {MIN_KEYS} anahtar ve {MIN_STUDENTS} öğrenci kâğıdı okunmalı (şu an {keys} anahtar, {students} öğrenci).
      </p>
    );
  }
  if (undecided) {
    return <p className="panel-note" style={{ marginTop: 12 }}>{undecided} ölçüt için veri yok (kur girilmemiş olabilir); karar verilemez.</p>;
  }
  return (
    <p className="console-banner ok">
      Beş ölçütün hepsi tuttu. JSON&apos;u indirip sonucu eval/README.md&apos;deki tabloya işleyin; kapıyı açma kararı ürün sahibinindir.
    </p>
  );
}
