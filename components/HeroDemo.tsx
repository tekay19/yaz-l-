'use client';

// The sample paper on the landing page. It replays a scripted read of one
// sheet — the numbers are fixed sample data, not a computed result, which is
// why the table values live in the markup rather than coming from anywhere.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const ROWS = [
  { name: 'Elif Yılmaz', right: 17, wrong: 3, score: 84 },
  { name: 'Mert Kaya', right: 14, wrong: 6, score: 70 },
  { name: 'Zeynep Demir', right: 19, wrong: 1, score: 95 },
  { name: 'Ahmet Şahin', right: 12, wrong: 8, score: 60 },
];

const QUESTIONS = [
  { no: 1, marked: 0, correct: true },
  { no: 2, marked: 2, correct: true },
  { no: 3, marked: 1, correct: false },
  { no: 4, marked: 3, correct: true },
];

export default function HeroDemo() {
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const [marks, setMarks] = useState(0); // how many question marks are drawn
  const [scoreOn, setScoreOn] = useState(false);
  const [rows, setRows] = useState(0); // how many result rows are filled
  const [footOn, setFootOn] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const play = useCallback(() => {
    clearTimers();
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const at = (ms: number, fn: () => void) =>
      timers.current.push(setTimeout(fn, reduced ? 0 : ms));

    setPlaying(true);
    setMarks(0);
    setScoreOn(false);
    setRows(0);
    setFootOn(false);

    const total = QUESTIONS.length + 1; // 4 multiple choice + 1 open answer
    for (let i = 0; i < total; i += 1) at(120 + i * 170, () => setMarks(i + 1));
    at(120 + total * 170 + 120, () => setScoreOn(true));
    for (let i = 0; i < ROWS.length; i += 1) at(1150 + i * 150, () => setRows(i + 1));
    at(1150 + ROWS.length * 150 + 150, () => {
      setFootOn(true);
      setPlaying(false);
      setPlayed(true);
    });
  }, [clearTimers]);

  const hint = playing
    ? 'Yapay zeka şıkları ve el yazısını anahtarla karşılaştırıyor…'
    : played
      ? 'Klasik soruya 5 üzerinden 4 verdi. Son söz sizde.'
      : "Elif'in kâğıdı okunmayı bekliyor.";

  return (
    <div className="demo">
      <div className="demo-stage">
        <div className="sheet">
          <div className="sheet-head" style={{ paddingRight: 58 }}>
            <span>9-B Matematik</span>
          </div>
          <div className="sheet-name">
            <span>Ad Soyad</span>
            <span className="hand">Elif Yılmaz</span>
          </div>

          <div className="qs">
            {QUESTIONS.map((q, i) => (
              <div className="q" key={q.no}>
                <span className="q-no">{q.no}</span>
                <span className="bubbles">
                  {[0, 1, 2, 3].map((b) => (
                    <i key={b} className={`bubble${b === q.marked ? ' on' : ''}`} />
                  ))}
                </span>
                <svg
                  className={`q-mark${marks > i ? ' on' : ''}`}
                  viewBox="0 0 22 22"
                  aria-hidden="true"
                >
                  {q.correct ? (
                    <path d="M4 11.5l4.5 4.5L18 6" style={{ ['--len' as string]: 40 }} />
                  ) : (
                    <>
                      <path d="M5 5l12 12" style={{ ['--len' as string]: 26 }} />
                      <path d="M17 5L5 17" style={{ ['--len' as string]: 26 }} />
                    </>
                  )}
                </svg>
              </div>
            ))}
          </div>

          <div className="sheet-divider">Klasik soru</div>
          <div className="qs">
            <div className="q q-open">
              <span className="q-no">5</span>
              <span className="open-answer">
                <span className="hand-answer">2x + 6 = 14 → x = 4</span>
              </span>
              <span className={`q-partial${marks > QUESTIONS.length ? ' on' : ''}`}>4/5</span>
            </div>
          </div>

          <div className={`sheet-score${scoreOn ? ' on' : ''}`}>
            <svg viewBox="0 0 58 46" fill="none" aria-hidden="true">
              <ellipse
                cx="29"
                cy="23"
                rx="25"
                ry="19"
                stroke="currentColor"
                strokeWidth="2.4"
                style={{ ['--len' as string]: 150 }}
              />
            </svg>
            <span>84</span>
          </div>
        </div>

        <span className="demo-arrow" aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </span>

        <div className="result">
          <div className="result-bar">
            <span>9-B Matematik sonuçları</span>
            <span className="file">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              .xlsx
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th className="r">Doğru</th>
                <th className="r">Yanlış</th>
                <th className="r">Puan</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => {
                const on = rows > i;
                return (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className={`r val${on ? ' in' : ''}`}>{on ? row.right : '—'}</td>
                    <td className={`r val${on ? ' in' : ''}`}>{on ? row.wrong : '—'}</td>
                    <td className={`r val score${on ? ' in' : ''}`}>{on ? row.score : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {footOn && (
            <div className="result-foot">
              <span>
                Sınıf ortalaması <b>77,2</b>
              </span>
              <span>
                En zor soru <b>3. soru</b>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="play-row">
        <button
          type="button"
          className={`btn btn-play ${played && !playing ? 'btn-ghost' : 'btn-primary'}`}
          onClick={play}
          disabled={playing}
        >
          {played && !playing ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          <span>{playing ? 'Okunuyor…' : played ? 'Tekrar oynat' : 'Bu kâğıdı oku'}</span>
        </button>

        <p className="demo-hint">{hint}</p>

        {played && !playing && (
          <div className="after-demo">
            <p>Sıra sizin sınıfınızda.</p>
            <Link href="/paket" className="btn btn-primary">
              Kendi kâğıtlarınızı yükleyin
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
