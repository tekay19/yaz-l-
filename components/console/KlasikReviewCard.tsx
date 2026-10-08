'use client';

// The review screen of a klasik exam: the class on the left, one student's
// paper on the right. Each answer shows what the student wrote, how it was
// judged and why, and the teacher's three tools — their own points, a fixed
// transcription, and "this answer is right too", which teaches the rubric a
// new correct path and re-grades that question for the whole class.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Api, KlasikReview, ReviewQuestion, ReviewSheet } from './api';
import { FailedSheets, NoteBanner } from './ui';
import RosterPhoto, { mergeNames } from '@/components/upload/RosterPhoto';
import { ReviewFrame, ReviewPhoto } from './ReviewFrame';

const VERDICT: Record<string, string> = { met: 'Karşılandı', partial: 'Kısmen', not_met: 'Karşılanmadı' };
const STATUS: Record<string, string> = {
  teacher: 'Sizin puanınız', pending: 'Puanlanıyor…', failed: 'Puanlanamadı', blank: 'Boş bırakılmış', missing: 'Kâğıtta bulunamadı', graded: '',
};

type Props = { api: Api; jobId: string; onApproved: () => void };

const needs = (s: ReviewSheet) => s.attention + s.nameFlags.length > 0;
const pts = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const tone = (points: number, max: number) => (points >= max ? 'full' : points > 0 ? 'part' : 'zero');
const byName = (a: ReviewSheet, b: ReviewSheet) =>
  (a.student ? 0 : 1) - (b.student ? 0 : 1) || a.student.localeCompare(b.student, 'tr') || a.seqs[0] - b.seqs[0];

export default function KlasikReviewCard({ api, jobId, onApproved }: Props) {
  const [data, setData] = useState<KlasikReview | null>(null);
  const [roster, setRoster] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  const flagged = data ? data.sheets.filter(needs).length : 0;
  const all = showAll || !flagged;
  // the class by name; the sheet on screen stays in the list after its last
  // flag is settled, so a fixed paper does not vanish from under the teacher
  const list = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase('tr');
    return [...data.sheets].sort(byName).filter((s) =>
      (all || needs(s) || s.pageId === selected) && (!needle || s.student.toLocaleLowerCase('tr').includes(needle)));
  }, [data, all, query, selected]);
  const current = list.find((s) => s.pageId === selected) ?? list[0] ?? null;
  const at = current ? list.indexOf(current) : -1;

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
  const go = (i: number) => {
    const s = list[i];
    if (!s) return;
    setSelected(s.pageId);
    document.getElementById('review-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <ReviewFrame
      summary={<>{data.sheets.length} kâğıt · {attention} işaretli soru · puanlar onayınıza kadar öneridir</>}
      flagged={flagged} total={data.sheets.length} showAll={all} onShowAll={setShowAll}
      onApprove={approve} approveDisabled={busy || data.pending > 0}
      hint={data.pending > 0 ? `${data.pending} kâğıt yeniden puanlanıyor; bitince onaylayabilirsiniz.` : undefined}
      roster={roster} onRoster={setRoster} onSaveRoster={saveRoster}
      rosterExtra={<RosterPhoto api={api} onNames={(names) => setRoster((cur) => mergeNames(cur, names))} />}
      bodyClassName="review-split"
      after={<><FailedSheets failed={data.failed} refunded /><NoteBanner note={error ? { ok: false, text: error } : null} /></>}
    >
      <nav className="review-students" aria-label="Öğrenciler">
        <input className="review-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Öğrenci arayın…" aria-label="Öğrenci arayın" />
        <ul>
          {list.map((s) => (
            <li key={s.pageId}>
              <button type="button" className={`review-student${s.pageId === current?.pageId ? ' on' : ''}`}
                aria-current={s.pageId === current?.pageId ? 'true' : undefined} onClick={() => setSelected(s.pageId)}>
                <span className="review-student-name">{s.student || 'İsim okunamadı'}</span>
                <span className="review-student-meta">
                  {s.pending > 0
                    ? <span className="tiny muted">puanlanıyor</span>
                    : <span className={`review-student-score ${tone(s.total, s.max)}`}>{pts(s.total)}</span>}
                  {needs(s) && <span className="review-badge" title="Bakmanız gereken yer">{s.attention + s.nameFlags.length}</span>}
                </span>
              </button>
            </li>
          ))}
          {!list.length && <li className="tiny muted review-students-empty">Bu aramayla öğrenci yok.</li>}
        </ul>
      </nav>
      <section id="review-detail" className="review-detail">
        {current
          ? <SheetCard key={current.pageId} api={api} jobId={jobId} sheet={current} onChanged={load}
            position={`${at + 1} / ${list.length}`} onPrev={at > 0 ? () => go(at - 1) : undefined}
            onNext={at < list.length - 1 ? () => go(at + 1) : undefined} />
          : <p className="empty">Gösterilecek kâğıt yok.</p>}
      </section>
    </ReviewFrame>
  );
}

// an empty field is not 0, and Turkish keyboards type "2,5"
const parsePoints = (s: string) => (s.trim() ? Number(s.trim().replace(',', '.')) : NaN);

function SheetCard({ api, jobId, sheet, onChanged, position, onPrev, onNext }: {
  api: Api; jobId: string; sheet: ReviewSheet; onChanged: () => void; position: string; onPrev?: () => void; onNext?: () => void;
}) {
  const [name, setName] = useState(sheet.student);
  useEffect(() => setName(sheet.student), [sheet.student]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName() {
    if (!name.trim() || name.trim() === sheet.student) return;
    const r = await api.correctKlasik(jobId, sheet.pageId, { studentName: name.trim() });
    setNote(r.ok ? { ok: true, text: 'İsim kaydedildi.' } : { ok: false, text: r.error });
    if (r.ok) onChanged();
  }
  const anchor = (q: number) => `q-${sheet.pageId}-${q}`;

  return (
    <div className="review-sheet">
      <header className="review-sheet-top">
        <div className="review-sheet-title">
          <h3>{sheet.student || 'İsim okunamadı'}</h3>
          <p className="small muted">
            <span className={`review-sheet-total ${tone(sheet.total, sheet.max)}`}>{pts(sheet.total)} / {sheet.max} puan</span>
            {' · '}%{sheet.percent} · kâğıt {sheet.seqs.join(' + ')}
          </p>
        </div>
        <div className="review-nav">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onPrev} disabled={!onPrev} aria-label="Önceki öğrenci">‹ Önceki</button>
          <span className="tiny muted">{position}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onNext} disabled={!onNext} aria-label="Sonraki öğrenci">Sonraki ›</button>
        </div>
      </header>

      {sheet.nameFlags.length > 0 && <ul className="review-q-flags">{sheet.nameFlags.map((f) => <li key={f}>{f}</li>)}</ul>}
      <details className="review-name-edit" open={sheet.nameFlags.length > 0}>
        <summary>İsmi düzeltin</summary>
        <div className="console-row">
          <input className="klasik-input grow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Öğrenci adı" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={saveName}>İsmi kaydet</button>
        </div>
        {note && <p className={`small ${note.ok ? 'muted' : 'console-err'}`}>{note.text}</p>}
      </details>

      <div className="review-qchips" role="navigation" aria-label="Sorular">
        {sheet.questions.map((q) => {
          const attn = q.notes.some((n) => n.attention);
          return (
            <button key={q.q} type="button" className={`review-qchip ${tone(q.points, q.max)}${attn ? ' attn' : ''}`}
              title={attn ? 'Bakmanız gereken soru' : undefined}
              onClick={() => document.getElementById(anchor(q.q))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <strong>{q.q}.</strong> {pts(q.points)}/{q.max}{attn ? ' !' : ''}
            </button>
          );
        })}
      </div>

      <div className="review-sheet-body">
        <div className="review-photos">
          {sheet.imageUrls.length ? sheet.imageUrls.map((url, i) => (
            <ReviewPhoto key={url} className="console-thumb klasik-thumb" src={url} alt={`Kâğıt ${sheet.seqs[i]}`} />
          )) : <span className="review-photo-gone">Fotoğraf silinmiş</span>}
          <p className="tiny muted">Büyütmek için fotoğrafa tıklayın.</p>
        </div>
        <div className="review-questions">
          {sheet.questions.map((q) => (
            <QuestionBlock key={q.q} id={anchor(q.q)} api={api} jobId={jobId} pageId={sheet.pageId} question={q} onChanged={onChanged} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionBlock({ id, api, jobId, pageId, question: q, onChanged }: {
  id: string; api: Api; jobId: string; pageId: string; question: ReviewQuestion; onChanged: () => void;
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
    done(r, 'Kaydedildi; bu soru tüm sınıf için yeniden puanlanıyor.');
  }

  async function retry() {
    done(await api.regrade(jobId, pageId), 'Yeniden deneniyor.');
  }

  return (
    <article id={id} className={`review-q${attention.length ? ' flagged' : ''}`}>
      <header className="review-q-head">
        <h4>{q.q}. soru</h4>
        <span className={`review-q-pts ${tone(q.points, q.max)}`}>{pts(q.points)} / {q.max}</span>
        {STATUS[q.status] && <span className="review-q-status">{STATUS[q.status]}</span>}
      </header>
      {attention.length > 0 && <ul className="review-q-flags">{attention.map((n) => <li key={n.code}>{n.text}</li>)}</ul>}

      <div className="review-q-sec">
        <p className="review-q-label">Öğrencinin yazdığı</p>
        {editing ? (
          <>
            <textarea className="console-text klasik-short" value={text} onChange={(e) => setText(e.target.value)} aria-label="Okumayı düzeltin" />
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
      </div>

      <div className="review-q-sec">
        <p className="review-q-label">Yapay zekânın değerlendirmesi</p>
        {q.note ? <p className="small">{q.note}</p> : <p className="small muted">Açıklama yok.</p>}
        {q.firstError && <p className="tiny muted">İlk hatalı adım: {q.firstError}</p>}
        {info.length > 0 && <p className="tiny muted">{info.map((n) => n.text).join('; ')}</p>}
        {q.criteria.some((c) => c.verdict) && (
          <details className="klasik-why" open={attention.length > 0}>
            <summary>Ölçüt ölçüt puan</summary>
            <table className="klasik-crit">
              <tbody>
                {q.criteria.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.text}{c.role === 'result' ? ' (sonuç)' : ''}
                      {c.evidence && <span className="klasik-crit-quote">“{c.evidence}”</span>}
                      {c.verdict && c.verdict !== 'not_met' && !c.counted && <span className="klasik-crit-quote">Sayılmadı</span>}
                    </td>
                    <td className={`nowrap klasik-verdict ${c.verdict ?? ''}`}>{c.verdict ? VERDICT[c.verdict] : '—'}</td>
                    <td className="nowrap">{pts(c.earned)} / {pts(c.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      <div className="review-q-sec review-q-actions">
        <label className="review-q-label" htmlFor={`${id}-pts`}>Puan</label>
        <div className="console-row">
          <input id={`${id}-pts`} className="klasik-input pts" inputMode="decimal" value={points} onChange={(e) => setPoints(e.target.value)} />
          <span className="small muted">/ {q.max}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => savePoints(parsePoints(points))}>Puanı kaydet</button>
          {q.status === 'teacher' && <button type="button" className="console-link" onClick={() => savePoints(null)}>öneriye dön</button>}
          {q.lines.some((l) => !l.crossed) && q.status !== 'teacher' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={accept} title="Bu çözüm yolu bütün sınıfta tam puan alır">Bu cevap da doğru</button>
          )}
          {q.status === 'failed' && <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>Yeniden dene</button>}
        </div>
        {msg && <p className={`small ${msg.ok ? 'muted' : 'console-err'}`}>{msg.text}</p>}
      </div>
    </article>
  );
}
