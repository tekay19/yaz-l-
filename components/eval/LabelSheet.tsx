'use client';

// Labels one photo by hand. The model's reading is never shown here: the
// admin writes what is really on the paper, and only the run compares.
// Every edit clears "confirmed", so a changed label is looked at again.

import { useState } from 'react';
import { OPTIONS, type Option } from '@/lib/types';
import { labelGap, type Label } from './labels';
import { parseQuick } from './run';

const MAX_QUESTIONS = 200; // what /api/admin/eval accepts

export function blankLabel(kind: Label['kind'], questionCount: number): Label {
  return kind === 'key'
    ? { kind: 'key', questionCount, answers: {}, done: false }
    : { kind: 'student', questionCount, name: '', marks: {}, done: false };
}

export default function LabelSheet({ name, url, label, locked, onChange, onNext }: {
  name: string;
  url: string;
  label: Label;
  locked: boolean;
  onChange: (label: Label) => void;
  onNext: () => void;
}) {
  const [quick, setQuick] = useState('');
  const [quickError, setQuickError] = useState('');
  const [noPreview, setNoPreview] = useState(false);
  const edit = (next: Label) => onChange({ ...next, done: false });
  const gap = labelGap(label);
  const questions = Array.from({ length: label.questionCount }, (_, i) => i + 1);

  function setCount(raw: string) {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n >= 1 && n <= MAX_QUESTIONS) edit({ ...label, questionCount: n });
  }

  function toggle(q: number, o: Option) {
    if (label.kind === 'key') {
      edit({ ...label, answers: { ...label.answers, [q]: o } });
      return;
    }
    const cur = label.marks[q] ?? [];
    const next = cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o].sort();
    edit({ ...label, marks: { ...label.marks, [q]: next } });
  }

  function applyQuick() {
    const r = parseQuick(quick, label.kind, label.questionCount);
    if (!r.ok) {
      setQuickError(r.error);
      return;
    }
    setQuickError('');
    if (label.kind === 'key') {
      const answers = { ...label.answers };
      for (const [q, m] of Object.entries(r.marks)) answers[Number(q)] = m[0] ?? 'blank';
      edit({ ...label, answers });
    } else {
      edit({ ...label, marks: { ...label.marks, ...r.marks } });
    }
    setQuick('');
  }

  return (
    <div className="eval-label">
      <div className="eval-photo">
        {noPreview ? (
          <p className="empty">Bu tarayıcı bu dosyayı önizleyemiyor (HEIC olabilir). Okuma yine çalışır.</p>
        ) : (
          <a href={url} target="_blank" rel="noreferrer" title="Tam boyut aç">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimised */}
            <img src={url} alt={name} onError={() => setNoPreview(true)} />
          </a>
        )}
        <p className="small muted eval-filename">{name}</p>
      </div>

      <fieldset className="eval-form" disabled={locked}>
        <div className="console-row between">
          <div className="seg" role="group" aria-label="Kâğıt türü">
            <button type="button" className={label.kind === 'student' ? 'on' : undefined}
              onClick={() => label.kind !== 'student' && edit(blankLabel('student', label.questionCount))}>
              Öğrenci kâğıdı
            </button>
            <button type="button" className={label.kind === 'key' ? 'on' : undefined}
              onClick={() => label.kind !== 'key' && edit(blankLabel('key', label.questionCount))}>
              Cevap anahtarı
            </button>
          </div>
          <label className="eval-inline">
            Soru sayısı
            <input className="console-qno" type="number" min={1} max={MAX_QUESTIONS} value={label.questionCount}
              onChange={(e) => setCount(e.target.value)} />
          </label>
        </div>

        {label.kind === 'student' && (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="eval-name">Kâğıttaki ad</label>
            <input id="eval-name" value={label.name} autoComplete="off"
              onChange={(e) => edit({ ...label, name: e.target.value })} />
          </div>
        )}

        <div className="console-row">
          <input className="eval-quick console-grow" value={quick} placeholder={label.kind === 'key' ? 'Hızlı giriş: A C - B …' : 'Hızlı giriş: A BC - D …'}
            aria-label="Hızlı giriş" onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyQuick(); } }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={applyQuick} disabled={!quick.trim()}>Uygula</button>
        </div>
        <p className="field-hint" style={{ marginTop: 6 }}>
          {label.kind === 'key'
            ? 'Her soru için bir şık; anahtarda boş bırakılan soru için "Boş" seçin (ya da - yazın).'
            : 'Kâğıtta ne işaretliyse onu seçin; iki işaret varsa ikisini de. Dokunulmayan soru boş sayılır.'}
        </p>
        {quickError && <p className="field-error" role="alert">{quickError}</p>}

        <div className="eval-grid">
          {questions.map((q) => {
            const picked: Option[] = label.kind === 'key'
              ? (label.answers[q] && label.answers[q] !== 'blank' ? [label.answers[q] as Option] : [])
              : (label.marks[q] ?? []);
            const missing = label.kind === 'key' && !label.answers[q];
            return (
              <div key={q} className={`eval-q${missing ? ' missing' : ''}`}>
                <span className="eval-qno">{q}</span>
                {OPTIONS.map((o) => (
                  <button key={o} type="button" aria-pressed={picked.includes(o)}
                    className={picked.includes(o) ? 'on' : undefined} onClick={() => toggle(q, o)}>
                    {o}
                  </button>
                ))}
                {label.kind === 'key' && (
                  <button type="button" aria-pressed={label.answers[q] === 'blank'}
                    className={`blank${label.answers[q] === 'blank' ? ' on' : ''}`}
                    onClick={() => edit({ ...label, answers: { ...label.answers, [q]: 'blank' } })}>
                    Boş
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="console-row">
          {label.done ? (
            <span className="console-status">Etiket onaylandı</span>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(gap)}
              onClick={() => onChange({ ...label, done: true })}>
              Etiketi onayla
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onNext}>Sonraki fotoğraf</button>
          {gap && <span className="small console-err">{gap}</span>}
        </div>
      </fieldset>
    </div>
  );
}
