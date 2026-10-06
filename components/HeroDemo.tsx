'use client';

// The landing page's opening picture: a teacher's desk after SınavOku has
// read the class. Elif's sheet lies on top of the graded pile with the red
// pen marks on it, and the e-mailed result list sits beside it. The numbers
// are fixed sample data, not a computed result, which is why they live in
// the markup. The page loads in the finished state; the replay button is
// the only thing that moves, and only when the visitor asks for it.

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

export default function HeroDemo() {
  const [live, setLive] = useState(false); // marks animate only after a replay is asked for
  const [playing, setPlaying] = useState(false);
  const [marks, setMarks] = useState(MARKS);
  const [rows, setRows] = useState(ROWS.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const play = useCallback(() => {
    clearTimers();
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, reduced ? 0 : ms));

    setLive(!reduced);
    setPlaying(true);
    setMarks(0);
    setRows(0);

    for (let i = 0; i < MARKS; i += 1) at(260 + i * 150, () => setMarks(i + 1));
    const tableAt = 260 + MARKS * 150 + 200;
    for (let i = 0; i < ROWS.length; i += 1) at(tableAt + i * 160, () => setRows(i + 1));
    at(tableAt + ROWS.length * 160 + 100, () => setPlaying(false));
  }, [clearTimers]);

  const openOn = marks > OPTIK.length;
  const scoreOn = marks >= MARKS;
  const rightCount = OPTIK.filter((q) => q.key === q.marked).length;

  return (
    <div className={`desk${live ? ' is-live' : ''}`}>
      <div className="desk-stage">
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
                        <i
                          key={l}
                          className={`bubble${b === q.marked ? ' on' : ''}${!ok && on && b === q.key ? ' key' : ''}`}
                        >
                          {l}
                        </i>
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
              <span className={`open-note${openOn ? ' on' : ''}`}>
                <b>4/5</b> ilk adım eksik
              </span>
            </div>

            <div className={`sheet-score${scoreOn ? ' on' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 64 50" fill="none">
                <path
                  d="M40 6C24 2 6 10 5 25s16 22 30 21 26-9 25-22S47 4 31 6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  style={{ ['--len' as string]: 170 }}
                />
              </svg>
              <span>80</span>
            </div>

            <div className="sheet-foot" aria-hidden="true">
              <span>Öğretmen</span>
              <span className="sign" />
            </div>
          </figure>
        </div>

        <div className="desk-report">
          <div className="report-bar">
            <span className="report-from">SınavOku sonuç e-postası</span>
            <span className="report-title">9-B Matematik sonuçları</span>
            <span className="report-files">Excel ve PDF ekli</span>
          </div>
          <table>
            <caption className="visually-hidden">Örnek sınıf sonuç listesi</caption>
            <thead>
              <tr>
                <th scope="col">Öğrenci</th>
                <th scope="col" className="r">Doğru</th>
                <th scope="col" className="r col-wrong">Yanlış</th>
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
                    <td className="r col-wrong">{on ? row.wrong : '–'}</td>
                    <td className="r score">{on ? row.score : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="report-foot">
            <span>Sınıf ortalaması <b>77,2</b></span>
            <span>En zor soru <b>3. soru</b></span>
          </p>
        </div>
      </div>

      <div className="desk-controls">
        <button type="button" className="desk-replay" onClick={play} disabled={playing} data-track="hero_replay">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          {playing ? 'Okunuyor…' : 'Okumayı baştan izleyin'}
        </button>
        <p className="desk-hint" aria-live="polite">
          {playing
            ? 'Şıklar anahtarla, el yazısı ölçütlerle karşılaştırılıyor.'
            : 'Klasik soruya 5 üzerinden 4 önerildi. Son söz sizde.'}
        </p>
      </div>
    </div>
  );
}
