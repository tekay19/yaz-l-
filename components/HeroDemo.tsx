'use client';

// The hero's scene, on the board: the whole product in three moves a
// visitor can follow without reading. A phone photographs Elif's sheet, the
// sheet is scanned and marked by the red pen, and the class list arrives as
// an e-mail. The chalk labels beside each object light up as its turn comes.
// It plays once on load (the page's one orchestrated moment); with reduced
// motion the finished scene is shown at once. The numbers are fixed sample
// data, not a computed result.

import { useCallback, useEffect, useRef, useState } from 'react';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// answer key and Elif's marks: two wrong out of ten
const OPTIK = [
  { key: 1, marked: 1 },
  { key: 3, marked: 3 },
  { key: 0, marked: 2 },
  { key: 2, marked: 2 },
  { key: 4, marked: 4 },
  { key: 1, marked: 1 },
  { key: 0, marked: 0 },
  { key: 3, marked: 1 },
  { key: 2, marked: 2 },
  { key: 1, marked: 1 },
];

const ROWS = [
  // the same exam: ten bubbles and one open answer; Elif's 8/10 and 4/5 make 80
  { name: 'Elif Yılmaz', right: 8, wrong: 2, score: 80 },
  { name: 'Mert Kaya', right: 7, wrong: 3, score: 68 },
  { name: 'Zeynep Demir', right: 9, wrong: 1, score: 94 },
  { name: 'Ahmet Şahin', right: 6, wrong: 4, score: 60 },
];

const MARKS = OPTIK.length + 2; // ten bubbles, the open answer, the total

// 0 before, 1 photo, 2 scan, 3 red pen, 4 e-mail, 5 finished
type Phase = 0 | 1 | 2 | 3 | 4 | 5;
const STEPS = [
  { n: 1, text: 'Kâğıdı çekin', on: (p: Phase) => p === 1 },
  { n: 2, text: 'Okunur, puanlanır', on: (p: Phase) => p === 2 || p === 3 },
  { n: 3, text: 'Liste e‑postanızda', on: (p: Phase) => p === 4 },
];

function Tick({ on }: { on: boolean }) {
  return (
    <svg className={`pen-mark${on ? ' on' : ''}`} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M4 11.5l4.5 4.5L18 6" style={{ ['--len' as string]: 40 }} />
    </svg>
  );
}

function Cross({ on }: { on: boolean }) {
  return (
    <svg className={`pen-mark${on ? ' on' : ''}`} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M5 5l12 12" style={{ ['--len' as string]: 26 }} />
      <path d="M17 5L5 17" style={{ ['--len' as string]: 26 }} />
    </svg>
  );
}

function Phone() {
  return (
    <div className="scene-phone" aria-hidden="true">
      <div className="phone-screen">
        <span className="phone-sheet">
          <i /><i /><i /><i /><i /><i />
        </span>
        <span className="phone-frame" />
        <span className="phone-flash" />
      </div>
      <span className="phone-shutter" />
    </div>
  );
}

export default function HeroDemo({ autoPlay = false }: { autoPlay?: boolean }) {
  const [phase, setPhase] = useState<Phase>(autoPlay ? 0 : 5);
  const [live, setLive] = useState(autoPlay);
  const [marks, setMarks] = useState(autoPlay ? 0 : MARKS);
  const [rows, setRows] = useState(autoPlay ? 0 : ROWS.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const play = useCallback(() => {
    clearTimers();
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setLive(false);
      setMarks(MARKS);
      setRows(ROWS.length);
      setPhase(5);
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    setLive(true);
    setMarks(0);
    setRows(0);
    setPhase(0);
    at(450, () => setPhase(1)); // the shutter
    at(1250, () => setPhase(2)); // the scan
    const penAt = 2150;
    at(penAt, () => setPhase(3));
    for (let i = 0; i < MARKS; i += 1) at(penAt + i * 140, () => setMarks(i + 1));
    const mailAt = penAt + MARKS * 140 + 250;
    at(mailAt, () => setPhase(4));
    for (let i = 0; i < ROWS.length; i += 1) at(mailAt + 350 + i * 170, () => setRows(i + 1));
    at(mailAt + 350 + ROWS.length * 170 + 400, () => setPhase(5));
  }, [clearTimers]);

  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);

  const openOn = marks > OPTIK.length;
  const scoreOn = marks >= MARKS;
  const rightCount = OPTIK.filter((q) => q.key === q.marked).length;
  const playing = phase > 0 && phase < 5;

  return (
    <div className={`desk scene phase-${phase}${live ? ' is-live' : ''}`}>
      <div className="scene-stage">
        <ol className="scene-steps" aria-label="Nasıl çalışır">
          {STEPS.map((s) => (
            <li key={s.n} className={`scene-step s${s.n}${s.on(phase) || phase === 5 ? ' on' : ''}`}>
              <span className="scene-n chalk" aria-hidden="true">{s.n}</span>
              <span className="scene-t chalk">{s.text}</span>
            </li>
          ))}
        </ol>

        <Phone />

        <div className="desk-paper">
          <div className="desk-pile" aria-hidden="true">
            <div className="pile-sheet pile-1">
              <span className="pile-name">Zeynep Demir</span>
              <span className="pile-score">95</span>
            </div>
            <div className="pile-sheet pile-2">
              <span className="pile-name">Mert Kaya</span>
              <span className="pile-score">70</span>
            </div>
          </div>

          <figure
            className="sheet"
            aria-label={`Örnek okunmuş kâğıt: Elif Yılmaz, ${rightCount} doğru, klasik soruda 5 üzerinden 4, toplam 80 puan`}
          >
            <i className="sheet-scan" aria-hidden="true" />
            <div className="sheet-head" aria-hidden="true">
              <span>9-B Matematik</span>
              <span>1. Yazılı</span>
            </div>
            <div className="sheet-name" aria-hidden="true">
              <span>Adı Soyadı</span>
              <span className="hand">Elif Yılmaz</span>
            </div>

            <ol className="optik" aria-hidden="true">
              {OPTIK.map((q, i) => {
                const ok = q.key === q.marked;
                const on = marks > i;
                return (
                  <li key={i} className="optik-row">
                    <span className="q-no">{i + 1}</span>
                    <span className="bubbles">
                      {LETTERS.map((l, b) => (
                        <i key={l} className={`bubble${b === q.marked ? ' on' : ''}${!ok && on && b === q.key ? ' key' : ''}`}>{l}</i>
                      ))}
                    </span>
                    {ok ? <Tick on={on} /> : <Cross on={on} />}
                  </li>
                );
              })}
            </ol>

            <div className="sheet-open" aria-hidden="true">
              <p className="open-q"><b>11.</b> 2x + 6 = 14 denklemini çözünüz. <span>(5 puan)</span></p>
              <p className="hand-answer">2x = 8<br />x = 4</p>
              <span className={`open-note${openOn ? ' on' : ''}`}><b>4/5</b> ilk adım eksik</span>
            </div>

            <div className={`sheet-score${scoreOn ? ' on' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 64 50" fill="none">
                <path d="M40 6C24 2 6 10 5 25s16 22 30 21 26-9 25-22S47 4 31 6" stroke="currentColor" strokeWidth="2.4"
                  strokeLinecap="round" style={{ ['--len' as string]: 170 }} />
              </svg>
              <span>80</span>
            </div>
          </figure>
        </div>

        <div className={`desk-report${rows > 0 ? ' in' : ''}`}>
          <div className="report-bar">
            <span className="report-from">SınavOku’dan e‑posta</span>
            <span className="report-title">9-B Matematik sonuçları</span>
            <span className="report-files">
              <i className="file xls">XLSX</i>
              <i className="file pdf">PDF</i>
            </span>
          </div>
          <table>
            <caption className="visually-hidden">Örnek sınıf sonuç listesi</caption>
            <thead>
              <tr>
                <th scope="col">Öğrenci</th>
                <th scope="col" className="r">Doğru</th>
                <th scope="col" className="r">Puan</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => {
                const on = rows > i;
                return (
                  <tr key={row.name} className={on ? 'in' : undefined}>
                    <th scope="row">{row.name}</th>
                    <td className="r">{on ? row.right : '–'}</td>
                    <td className="r score">{on ? row.score : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="desk-controls">
        <button type="button" className="desk-replay" onClick={play} disabled={playing} data-track="hero_replay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          {playing ? 'Okunuyor…' : 'Baştan izleyin'}
        </button>
      </div>
    </div>
  );
}
