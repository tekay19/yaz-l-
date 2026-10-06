'use client';

// The review screen of a klasik exam: each answer as it was read, what each
// criterion decided and why, and the teacher's three tools — their own
// points, a fixed transcription, and "accept this answer", which teaches the
// rubric a new correct path and re-grades that question for the whole class.

import { useCallback, useEffect, useState } from 'react';
import type { Api, KlasikReview, ReviewQuestion, ReviewSheet } from './api';
import { FailedSheets, NoteBanner } from './ui';
import { ReviewFrame, ReviewPhoto } from './ReviewFrame';

const VERDICT: Record<string, string> = { met: 'Karşılandı', partial: 'Kısmen', not_met: 'Karşılanmadı' };
const STATUS: Record<string, string> = {
  teacher: 'Sizin puanınız', pending: 'Puanlanıyor…', failed: 'Puanlanamadı', blank: 'Boş bırakılmış', missing: 'Kâğıtta bulunamadı', graded: '',
};

type Props = { api: Api; jobId: string; onApproved: () => void };

export default function KlasikReviewCard({ api, jobId, onApproved }: Props) {
  const [data, setData] = useState<KlasikReview | null>(null);
  const [roster, setRoster] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const r = await api.klasikReview(jobId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setData(r.data);
    setRoster((cur) => cur || r.data.roster.join('\n'));
  }, [api, jobId]);

  useEffect(() => { load(); }, [load]);
  // re-grading runs in the worker; follow it until it settles
  useEffect(() => {
    if (!data?.pending) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [data?.pending, load]);

  async function saveRoster() {
    const r = await api.setRoster(jobId, roster);
    if (r.ok) load();
    else setError(r.error);
  }

  async function approve() {
    setBusy(true);
    const r = await api.approve(jobId);
    setBusy(false);
    if (r.ok) onApproved();
    else setError(r.error);
  }

  if (!data) return error ? <p className="console-banner err">{error}</p> : <p className="empty">Kontrol verisi yükleniyor…</p>;

  const attention = data.sheets.reduce((s, x) => s + x.attention, 0);
  // sheets that need a look come first
  const sheets = [...data.sheets].sort((a, b) => (b.attention + b.nameFlags.length) - (a.attention + a.nameFlags.length) || a.seqs[0] - b.seqs[0]);
  const needs = (s: ReviewSheet) => s.attention + s.nameFlags.length > 0;
  const flagged = data.sheets.filter(needs).length;
  const shown = showAll || !flagged ? sheets : sheets.filter(needs);
  return (
    <ReviewFrame
      summary={<>{data.sheets.length} kâğıt, {attention} soruda işaret. Puanlar siz onaylayana kadar öneridir; onaylayınca rapor e-postanıza gider.</>}
      flagged={flagged} total={data.sheets.length} showAll={showAll || !flagged} onShowAll={setShowAll}
      onApprove={approve} approveDisabled={busy || data.pending > 0}
      hint={data.pending > 0 ? `${data.pending} kâğıt yeniden puanlanıyor; bitince onaylayabilirsiniz.` : undefined}
      roster={roster} onRoster={setRoster} onSaveRoster={saveRoster}
      after={<><FailedSheets failed={data.failed} refunded /><NoteBanner note={error ? { ok: false, text: error } : null} /></>}
    >
      {shown.map((s) => <SheetCard key={s.pageId} api={api} jobId={jobId} sheet={s} onChanged={load} />)}
    </ReviewFrame>
  );
}

// an empty field is not 0, and Turkish keyboards type "2,5"
const parsePoints = (s: string) => (s.trim() ? Number(s.trim().replace(',', '.')) : NaN);

function SheetCard({ api, jobId, sheet, onChanged }: { api: Api; jobId: string; sheet: ReviewSheet; onChanged: () => void }) {
  const [name, setName] = useState(sheet.student);
  useEffect(() => setName(sheet.student), [sheet.student]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    if (!name.trim() || name.trim() === sheet.student) return;
    const r = await api.correctKlasik(jobId, sheet.pageId, { studentName: name.trim() });
    setNote(r.ok ? { ok: true, text: 'İsim kaydedildi.' } : { ok: false, text: r.error });
    if (r.ok) onChanged();
  }

  return (
    <div className="console-review">
      <div>
        {sheet.imageUrls.length ? sheet.imageUrls.map((url, i) => (
          <ReviewPhoto key={url} className="console-thumb klasik-thumb" src={url} alt={`Kâğıt ${sheet.seqs[i]}`} />
        )) : <span className="review-photo-gone">Fotoğraf silinmiş</span>}
      </div>
      <div>
        <p className="review-sheet-head">
          <strong>Kâğıt {sheet.seqs.join(' + ')}</strong>
          <span>{sheet.student}</span>
          <span className="review-score">{sheet.total} / {sheet.max} puan <span className="muted">(%{sheet.percent})</span></span>
        </p>
        {sheet.nameFlags.length > 0 && <ul className="small console-list console-err">{sheet.nameFlags.map((f) => <li key={f}>{f}</li>)}</ul>}
        <div className="console-row">
          <input className="klasik-input grow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Öğrenci adı" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={saveName}>İsmi kaydet</button>
        </div>
        {note && <p className={`small ${note.ok ? 'muted' : 'console-err'}`}>{note.text}</p>}
        {sheet.questions.map((q) => (
          <QuestionBlock key={q.q} api={api} jobId={jobId} pageId={sheet.pageId} question={q} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function QuestionBlock({ api, jobId, pageId, question: q, onChanged }: {
  api: Api; jobId: string; pageId: string; question: ReviewQuestion; onChanged: () => void;
}) {
  const [points, setPoints] = useState(String(q.points));
  const [editing, setEditing] = useState(false);
  const readText = q.lines.filter((l) => !l.crossed).map((l) => l.text).join('\n');
  const [text, setText] = useState(readText);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // a re-grade changes the points (and a fixed reading the text) under the
  // inputs: follow the server, or "Puanı kaydet" would store the stale number
  useEffect(() => setPoints(String(q.points)), [q.points]);
  useEffect(() => { if (!editing) setText(readText); }, [readText, editing]);
  const attention = q.notes.filter((n) => n.attention);
  const info = q.notes.filter((n) => !n.attention);

  const done = (r: { ok: boolean; error?: string }, ok: string) => {
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error ?? 'İşlem başarısız.' });
    if (r.ok) onChanged();
  };

  async function savePoints(value: number | null) {
    if (value !== null && (Number.isNaN(value) || value < 0 || value > q.max)) {
      setMsg({ ok: false, text: `Puan 0 ile ${q.max} arasında olmalı.` });
      return;
    }
    const r = await api.correctKlasik(jobId, pageId, { points: [{ q: q.q, points: value }] });
    done(r, value === null ? 'Öneriye dönüldü.' : 'Puan kaydedildi.');
  }

  async function saveText() {
    const r = await api.correctKlasik(jobId, pageId, { texts: [{ q: q.q, text }] });
    if (r.ok) setEditing(false);
    done(r, 'Okuma düzeltildi; soru yeniden puanlanıyor.');
  }

  async function accept() {
    const why = window.prompt('Bu cevap neden doğru? (isteğe bağlı kısa not; diğer kâğıtlarda da bu yol tam puan alacak)', '');
    if (why === null) return;
    const r = await api.acceptAnswer(jobId, pageId, q.q, why);
    done(r, 'Rubriğe eklendi; bu soru tüm sınıf için yeniden puanlanıyor.');
  }

  async function retry() {
    done(await api.regrade(jobId, pageId), 'Yeniden deneniyor.');
  }

  return (
    <div className={`klasik-q${attention.length ? ' flagged' : ''}`}>
      <div className="console-row between">
        <strong className="small">{q.q}. soru <span className="review-pts">{q.points} / {q.max}</span></strong>
        {STATUS[q.status] && <span className="tiny muted">{STATUS[q.status]}</span>}
      </div>
      {attention.length > 0 && <ul className="small console-list console-err">{attention.map((n) => <li key={n.code}>{n.text}</li>)}</ul>}
      {info.length > 0 && <p className="tiny muted">{info.map((n) => n.text).join('; ')}</p>}
      {q.note && <p className="small">{q.note}</p>}
      {q.firstError && <p className="tiny muted">İlk hatalı adım: {q.firstError}</p>}

      {editing ? (
        <>
          <textarea className="console-text klasik-short" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="console-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={saveText}>Okumayı kaydet</button>
            <button type="button" className="console-link" onClick={() => setEditing(false)}>vazgeç</button>
          </div>
        </>
      ) : (
        <div className="klasik-answer">
          {q.lines.length ? q.lines.map((l, i) => (
            <div key={i} className={l.crossed ? 'klasik-line crossed' : 'klasik-line'}>{l.text}</div>
          )) : <div className="klasik-line muted">(cevap yok)</div>}
          {q.altText !== null && q.altText !== undefined && (
            <div className="tiny muted" style={{ marginTop: 6 }}>
              İkinci okuma{q.altText ? `: ${q.altText}` : ' bu cevabı görmedi'} — fotoğrafa bakıp gerekirse okumayı düzeltin.
            </div>
          )}
          <button type="button" className="console-link" onClick={() => setEditing(true)}>okumayı düzelt</button>
        </div>
      )}

      {q.criteria.some((c) => c.verdict) && (
        <table className="klasik-crit">
          <tbody>
            {q.criteria.map((c) => (
              <tr key={c.id}>
                <td>{c.text}{c.role === 'result' ? ' (sonuç)' : ''}</td>
                <td className="nowrap">{c.verdict ? VERDICT[c.verdict] : '—'}</td>
                <td className="nowrap">{c.earned} / {c.points}</td>
                <td className="tiny muted">
                  {c.evidence && <>“{c.evidence}”</>}
                  {c.verdict && c.verdict !== 'not_met' && !c.counted && <> — sayılmadı</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="console-row">
        <input className="klasik-input pts" inputMode="decimal" value={points}
          onChange={(e) => setPoints(e.target.value)} aria-label="Puan" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => savePoints(parsePoints(points))}>Puanı kaydet</button>
        {q.status === 'teacher' && <button type="button" className="console-link" onClick={() => savePoints(null)}>öneriye dön</button>}
        {q.lines.some((l) => !l.crossed) && q.status !== 'teacher' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={accept}>Bu cevabı kabul et, rubriğe ekle</button>
        )}
        {q.status === 'failed' && <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>Yeniden dene</button>}
      </div>
      {msg && <p className={`small ${msg.ok ? 'muted' : 'console-err'}`}>{msg.text}</p>}
    </div>
  );
}
