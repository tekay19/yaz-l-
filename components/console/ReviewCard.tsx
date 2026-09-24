'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Api, Correction, Review, ReviewRow } from './api';
import { flaggedQuestions, nameFlagged } from './flags';

const OPTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function ReviewCard({ api, jobId, onApproved }: { api: Api; jobId: string; onApproved: () => void }) {
  const [data, setData] = useState<Review | null>(null);
  const [roster, setRoster] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.review(jobId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setData(r.data);
    setRoster(r.data.roster.join('\n'));
  }, [api, jobId]);

  useEffect(() => { load(); }, [load]);

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

  const flagged = data.rows.filter((r) => r.flags.length).length;
  return (
    <div>
      <h3 className="console-sub">Kontrol</h3>
      <p className="small muted">
        {flagged} kâğıtta kontrol edilecek yer var. Düzeltmeleri kaydedip onaylayınca rapor e-postanıza gider.
      </p>

      <h3 className="console-sub">Sınıf listesi</h3>
      <textarea className="console-text" value={roster} onChange={(e) => setRoster(e.target.value)} placeholder={'Elif Yılmaz\nMert Kaya'} />
      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={saveRoster}>Listeyi kaydet ve yeniden eşleştir</button>
      </div>

      {data.rows.map((row) => (
        <RowEditor key={row.pageId} api={api} jobId={jobId} row={row} onSaved={load} />
      ))}

      {data.failed.length > 0 && (
        <>
          <h3 className="console-sub">Okunamayan kâğıtlar</h3>
          <ul className="small console-list">
            {data.failed.map((f) => <li key={f.seq}>Kâğıt {f.seq}: {f.reason} (hakkı iade edilir)</li>)}
          </ul>
        </>
      )}

      {error && <p className="console-banner err">{error}</p>}
      <div className="console-row">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={approve}>Onayla, raporu gönder</button>
      </div>
    </div>
  );
}

type RowProps = { api: Api; jobId: string; row: ReviewRow; onSaved: () => void };

function RowEditor({ api, jobId, row, onSaved }: RowProps) {
  const [name, setName] = useState(row.student);
  const [questions, setQuestions] = useState<number[]>(() => flaggedQuestions(row.flags));
  const [extra, setExtra] = useState('');
  // only questions the teacher actually touched are sent back
  const [marks, setMarks] = useState<Record<number, string[]>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (q: number, option: string) =>
    setMarks((m) => {
      const cur = m[q] ?? [];
      return { ...m, [q]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option].sort() };
    });

  function addQuestion() {
    const q = Number(extra);
    if (Number.isInteger(q) && q > 0 && !questions.includes(q)) setQuestions([...questions, q].sort((a, b) => a - b));
    setExtra('');
  }

  async function save() {
    const patch: Correction = {};
    if (name.trim() && name.trim() !== row.student) patch.studentName = name.trim();
    const answers = Object.entries(marks).map(([q, marked]) => ({ q: Number(q), marked }));
    if (answers.length) patch.answers = answers;
    if (!patch.studentName && !patch.answers) {
      setNote({ ok: false, text: 'Değişiklik yok.' });
      return;
    }
    const r = await api.correct(jobId, row.pageId, patch);
    setNote(r.ok ? { ok: true, text: 'Kaydedildi.' } : { ok: false, text: r.error });
    if (r.ok) {
      setMarks({});
      onSaved();
    }
  }

  return (
    <div className="console-review">
      <a href={row.imageUrl} target="_blank" rel="noreferrer">
        <img className="console-thumb" src={row.imageUrl} alt={`Kâğıt ${row.seq} (fotoğraf silinmiş olabilir)`} />
      </a>
      <div>
        <p className="small">
          <strong>Kâğıt {row.seq}</strong> · puan {row.score} (doğru {row.correct}, yanlış {row.wrong}, boş {row.blank})
        </p>
        {row.flags.length > 0 ? (
          <ul className="small console-list console-err">{row.flags.map((f) => <li key={f}>{f}</li>)}</ul>
        ) : (
          <p className="tiny muted">Kontrol edilecek yer yok.</p>
        )}

        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor={`name-${row.pageId}`}>Öğrenci adı{nameFlagged(row.flags) ? ' (kontrol edin)' : ''}</label>
          <input id={`name-${row.pageId}`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {questions.map((q) => (
          <div key={q} className="console-opts">
            <span className="small">Soru {q}:</span>
            {OPTIONS.map((o) => (
              <label key={o}>
                <input type="checkbox" checked={(marks[q] ?? []).includes(o)} onChange={() => toggle(q, o)} />
                {o}
              </label>
            ))}
            {marks[q] && marks[q].length === 0 && <span className="tiny muted">boş sayılacak</span>}
          </div>
        ))}
        <div className="console-row">
          <input className="console-qno" inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Soru no" aria-label="Düzeltilecek soru numarası" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={addQuestion}>Başka soru düzelt</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={save}>Kaydet</button>
          {note && <span className={`small ${note.ok ? 'muted' : 'console-err'}`}>{note.text}</span>}
        </div>
        <p className="tiny muted">Bir soruda şık işaretleyip kaydederseniz o soru okunanın yerine geçer; hiç şık seçilmezse boş sayılır.</p>
      </div>
    </div>
  );
}
