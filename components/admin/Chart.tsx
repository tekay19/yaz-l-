'use client';

// Day-by-day charts drawn as plain SVG. Different measures never share an
// axis: each gets its own panel (small multiples) on one shared time axis,
// and hovering a day highlights it in every panel at once.

import { useEffect, useRef, useState } from 'react';

export type Series = {
  id: string;
  title: string;
  kind: 'bar' | 'line';
  values: number[];
  format: (n: number) => string;
  total?: string;
  /** smallest axis step, in the series' own units (1 for counts, 100 for kuruş) */
  minStep?: number;
  /** shown on the empty plot when every value is zero */
  emptyNote?: string;
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// Round axis ticks: 0, then even steps up to a round top. `minStep` keeps the
// step from dropping below one unit (1 for counts, 100 kuruş for lira), so an
// all-small series never shows "₺0,01" or "0,5 kayıt". An all-zero series gets
// a lone 0 baseline.
export function niceTicks(max: number, minStep = 0): number[] {
  if (!(max > 0)) return [0];
  const raw = Math.max(max / 3, minStep);
  const fits = (c: number) => c >= raw - 1e-9 && (!minStep || Math.abs(c / minStep - Math.round(c / minStep)) < 1e-9);
  let step = 0;
  for (let p = 10 ** Math.floor(Math.log10(raw)); !step; p *= 10) {
    for (const m of [1, 2, 2.5, 5]) if (fits(m * p)) { step = m * p; break; }
  }
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => +(i * step).toFixed(6));
}

const PAD_L = 52;
const PAD_R = 8;

function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(3, w / 2, h);
  const b = y + h;
  return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`;
}

function Panel({ s, width, height, labels, hover, setHover, showX }: {
  s: Series; width: number; height: number; labels: string[]; hover: number | null; setHover: (i: number | null) => void; showX: boolean;
}) {
  const n = s.values.length;
  const top = 10;
  const bottom = showX ? 22 : 6;
  const plotW = Math.max(10, width - PAD_L - PAD_R);
  const plotH = height - top - bottom;
  const step = plotW / Math.max(1, n);
  const ticks = niceTicks(Math.max(...s.values, 0), s.minStep);
  const max = ticks[ticks.length - 1] || 1;
  const empty = ticks.length === 1;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const cx = (i: number) => PAD_L + step * i + step / 2;
  const barW = Math.max(2, Math.min(18, step * 0.62));
  const xEvery = n > 20 ? 7 : n > 10 ? 3 : 1;
  const line = s.values.map((v, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  return (
    <svg width={width} height={height} role="img" aria-label={`${s.title}, günlük`} className="adm-chart-svg">
      {/* grid: a rule per round tick; the baseline is the strongest */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
          <text x={PAD_L - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">{s.format(t)}</text>
        </g>
      ))}
      {empty && (
        <text x={PAD_L + plotW / 2} y={top + plotH / 2} dy="0.32em" textAnchor="middle" className="empty-note">
          {s.emptyNote ?? 'Bu dönemde veri yok'}
        </text>
      )}
      {hover !== null && <rect x={PAD_L + step * hover} y={top} width={step} height={plotH} className="hoverband" />}
      {s.kind === 'bar'
        ? s.values.map((v, i) => v > 0 && (
          <path key={i} d={barPath(cx(i) - barW / 2, y(v), barW, top + plotH - y(v))} className={`bar${hover === i ? ' on' : ''}`} />
        ))
        : (
          <>
            <path d={line} className="line" />
            {hover !== null && <circle cx={cx(hover)} cy={y(s.values[hover])} r={4} className="dot" />}
          </>
        )}
      {showX && labels.map((l, i) => ((n - 1 - i) % xEvery === 0) && (
        <text key={i} x={cx(i)} y={height - 6} textAnchor="middle" className="tick">{l}</text>
      ))}
      {/* hit targets: a full-height column per day, wider than any mark */}
      {s.values.map((v, i) => (
        <rect key={i} x={PAD_L + step * i} y={0} width={step} height={height} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <title>{`${labels[i]}: ${s.format(v)}`}</title>
        </rect>
      ))}
    </svg>
  );
}

export function SmallMultiples({ labels, series, heights }: { labels: string[]; series: Series[]; heights?: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  return (
    <div className="adm-chart" ref={ref}>
      {series.map((s, k) => (
        <figure key={s.id} className="adm-chart-panel">
          <figcaption>
            <span className="t">{s.title}</span>
            <span className="v" aria-live="polite">
              {hover !== null
                ? <><b>{s.format(s.values[hover])}</b> <span className="adm-muted">{labels[hover]}</span></>
                : s.total && <><b>{s.total}</b> <span className="adm-muted">toplam</span></>}
            </span>
          </figcaption>
          {width > 0 && (
            <Panel s={s} width={width} height={heights?.[k] ?? 110} labels={labels} hover={hover} setHover={setHover} showX={k === series.length - 1} />
          )}
        </figure>
      ))}
      <button type="button" className="adm-linkbtn" onClick={() => setTable((t) => !t)} aria-expanded={table}>
        {table ? 'Tabloyu gizle' : 'Tablo olarak göster'}
      </button>
      {table && (
        <div className="adm-table-wrap adm-chart-table">
          <table className="adm-table compact">
            <thead>
              <tr><th scope="col">Gün</th>{series.map((s) => <th key={s.id} scope="col" className="num">{s.title}</th>)}</tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i}><th scope="row">{l}</th>{series.map((s) => <td key={s.id} className="num">{s.format(s.values[i])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
