'use client';

// The class's results: the numbers, how they spread, which questions were
// hard, and every student — the same figures as the downloadable report.

import { useMemo, useState } from 'react';
import type { ExamResults } from '@/components/console/api';
import { Stat, num } from './ui';

type Sort = 'name' | 'score-desc' | 'score-asc';

export default function ResultsView({ r }: { r: ExamResults }) {
  const [sort, setSort] = useState<Sort>('name');
  const klasik = r.mode === 'klasik';
  const pct = (x: ExamResults['rows'][number]) => x.score; // a percentage for both kinds
  const rows = useMemo(() => {
    const out = [...r.rows];
    if (sort === 'score-desc') out.sort((a, b) => pct(b) - pct(a));
    if (sort === 'score-asc') out.sort((a, b) => pct(a) - pct(b));
    return out;
  }, [r.rows, sort]);
  const peak = Math.max(1, ...r.stats.buckets.map((b) => b.count));
  const hardest = [...r.questions].sort((a, b) => a.rate - b.rate).slice(0, 3).filter((q) => q.rate < 0.6);

  if (!r.rows.length) {
    return <p className="muted">Puanlanmış kâğıt yok.{r.failed.length ? ` ${r.failed.length} kâğıt okunamadı.` : ''}</p>;
  }
  return (
    <div className="app-results">
      <div className="app-stats">
        <Stat label="Öğrenci" value={r.stats.count} />
        <Stat label="Sınıf ortalaması" value={`${klasik ? '%' : ''}${num(r.stats.average, 1)}`} hint={klasik ? '100 üzerinden' : 'puan'} />
        <Stat label="En yüksek" value={num(r.stats.max, 1)} tone="good" />
        <Stat label="En düşük" value={num(r.stats.min, 1)} />
      </div>

      <div className="app-grid-2">
        <section className="app-card">
          <h2>Puan dağılımı</h2>
          <div className="app-bars">
            {r.stats.buckets.map((b) => (
              <div key={b.label} className="app-bar">
                <span className="k">{b.label}</span>
                <span className="track"><span style={{ width: `${(b.count / peak) * 100}%` }} /></span>
                <span className="v">{b.count}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="app-card">
          <h2>Soru başarısı</h2>
          <div className="app-bars">
            {r.questions.map((q) => (
              <div key={q.q} className={`app-bar${q.rate < 0.5 ? ' low' : ''}`}>
                <span className="k">{q.q}. soru</span>
                <span className="track"><span style={{ width: `${Math.round(q.rate * 100)}%` }} /></span>
                <span className="v">%{Math.round(q.rate * 100)}</span>
              </div>
            ))}
          </div>
          {hardest.length > 0 && (
            <p className="small muted" style={{ marginTop: 12 }}>
              En zorlanılan: {hardest.map((q) => `${q.q}. soru`).join(', ')}. Bu konuları sınıfla yeniden ele almak isteyebilirsiniz.
            </p>
          )}
        </section>
      </div>

      <section className="app-card app-flush">
        <div className="app-toolbar">
          <h2>Öğrenciler</h2>
          <label className="app-select">
            <span className="sr-only">Sırala</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="name">Ada göre</option>
              <option value="score-desc">Puan: yüksekten düşüğe</option>
              <option value="score-asc">Puan: düşükten yükseğe</option>
            </select>
          </label>
        </div>
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Öğrenci</th>
                {klasik
                  ? r.questions.map((q) => <th key={q.q} className="num">{q.q}</th>)
                  : <><th className="num">Doğru</th><th className="num">Yanlış</th><th className="num">Boş</th></>}
                <th className="num">{klasik ? 'Toplam' : 'Puan'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.pageId}>
                  <td>
                    {x.student}
                    {x.flags > 0 && <span className="app-dot" title={`${x.flags} yer kontrol edilmeli`} aria-label="kontrol edilmeli" />}
                  </td>
                  {klasik
                    ? r.questions.map((q) => {
                      const p = x.points?.find((y) => y.q === q.q);
                      return <td key={q.q} className={`num${p && p.points === p.max ? ' full' : p && p.points === 0 ? ' zero' : ''}`}>{p ? num(p.points, 1) : '—'}</td>;
                    })
                    : <><td className="num">{x.correct}</td><td className="num">{x.wrong}</td><td className="num">{x.blank}</td></>}
                  <td className="num strong">{klasik ? `${num(x.total ?? 0, 1)} / ${x.max}` : num(x.score, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {r.failed.length > 0 && (
        <p className="console-banner warn">
          {r.failed.length} kâğıt okunamadı ({r.failed.map((f) => `kâğıt ${f.seq}`).join(', ')}); bu sayfaların hakkı iade edildi.
        </p>
      )}
    </div>
  );
}
