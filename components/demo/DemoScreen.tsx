'use client';

// The live demo of klasik grading: drop exam photos, the system reads each
// page, joins front and back sides into one student's paper, grades every
// answer against the rubric and shows why each point was or was not given.
// Every page and every paper is a real, paid API call.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Rubric, KlasikRead } from '@/lib/types';
import type { DemoQuestion, DemoSheet } from '@/lib/demo/grade';

type Item = {
  key: string; file: File; url: string;
  status: 'wait' | 'reading' | 'read' | 'error';
  read?: KlasikRead; error?: string; ms?: number; tokens?: number;
};
type Group = { keys: string[]; status: 'wait' | 'grading' | 'done' | 'error'; sheets?: DemoSheet[]; error?: string };

const opts = { credentials: 'same-origin', cache: 'no-store' } as const;
const VERDICT = { met: 'karşılıyor', partial: 'kısmen', not_met: 'karşılamıyor' } as const;
const STATUS: Record<string, string> = { blank: 'boş', missing: 'cevap yok', failed: 'puanlanamadı', pending: 'bekliyor' };
const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });

async function call<T>(url: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { ...opts, ...init });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    if (res.status === 401) return { ok: false, error: 'Yönetici oturumu kapanmış. /panel sayfasından yeniden giriş yapın.' };
    return { ok: false, error: (typeof body?.error === 'string' && body.error) || `İstek başarısız (${res.status}).` };
  } catch {
    return { ok: false, error: 'Sunucuya ulaşılamadı.' };
  }
}

// run fn over items, at most `n` at a time
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x);
  }));
}

// A back side belongs to the page just before it, as in the product.
function groupPages(items: Item[]): string[][] {
  const groups: string[][] = [];
  let open = false;
  for (const it of items) {
    if (it.status !== 'read' || !it.read) { open = false; continue; }
    if (it.read.isBackSide && open && groups.length) groups[groups.length - 1].push(it.key);
    else groups.push([it.key]);
    open = true;
  }
  return groups;
}

export default function DemoScreen() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    fetch('/api/admin?action=session', opts).then((r) => r.json()).then((b) => setAuthed(Boolean(b?.authed))).catch(() => setAuthed(false));
  }, []);
  useEffect(() => {
    if (!authed) return;
    call<{ rubric: Rubric }>('/api/admin/demo/grade', {}).then((r) => r.ok && setRubric(r.data.rubric));
  }, [authed]);
  // object URLs live as long as their item
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)), []);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));

  function add(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    setItems((cur) => [...cur, ...files.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file, url: URL.createObjectURL(file), status: 'wait' as const,
    }))]);
    setGroups([]);
  }
  function move(i: number, d: -1 | 1) {
    setItems((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setGroups([]);
  }
  function remove(key: string) {
    setItems((cur) => {
      const it = cur.find((x) => x.key === key);
      if (it) URL.revokeObjectURL(it.url);
      return cur.filter((x) => x.key !== key);
    });
    setGroups([]);
  }
  function clear() {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
    setGroups([]);
  }

  async function run() {
    setRunning(true);
    setGroups([]);
    // the order and the reads of this run, kept here rather than read back
    // from state, which only catches up on the next render
    const order = itemsRef.current;
    const reads = new Map(order.filter((it) => it.read).map((it) => [it.key, it.read!]));
    // 1. read every page not read yet
    await pool(order.filter((it) => !it.read), 3, async (it) => {
      patch(it.key, { status: 'reading', error: undefined });
      const form = new FormData();
      form.set('file', it.file);
      const r = await call<{ read: KlasikRead; ms: number; usage: { inputTokens: number; outputTokens: number } }>(
        '/api/admin/demo/read', { method: 'POST', body: form });
      if (r.ok) {
        reads.set(it.key, r.data.read);
        patch(it.key, { status: 'read', read: r.data.read, ms: r.data.ms, tokens: r.data.usage.inputTokens + r.data.usage.outputTokens });
      } else patch(it.key, { status: 'error', error: r.error });
    });
    // 2. join pages into papers, 3. grade each paper
    const planned: Group[] = groupPages(order.map((it) => ({ ...it, status: reads.has(it.key) ? 'read' : 'error', read: reads.get(it.key) })))
      .map((keys) => ({ keys, status: 'wait' }));
    setGroups(planned);
    const setGroup = (i: number, p: Partial<Group>) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...p } : g)));
    await pool(planned.map((_, i) => i), 2, async (i) => {
      setGroup(i, { status: 'grading' });
      const pages = planned[i].keys.map((k) => reads.get(k)!);
      const r = await call<{ sheets: DemoSheet[] }>('/api/admin/demo/grade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pages }),
      });
      setGroup(i, r.ok ? { status: 'done', sheets: r.data.sheets } : { status: 'error', error: r.error });
    });
    setRunning(false);
  }

  const sheets = groups.flatMap((g) => g.sheets ?? []);
  const totals = useMemo(() => ({
    readTokens: items.reduce((s, it) => s + (it.tokens ?? 0), 0),
    gradeTokens: sheets.reduce((s, x) => s + x.usage.inputTokens + x.usage.outputTokens, 0),
  }), [items, sheets]);
  const pageNo = (key: string) => items.findIndex((it) => it.key === key) + 1;

  if (authed === null) return <div className="panel-login" />;
  if (!authed) {
    return (
      <div className="panel-login">
        <div className="card panel-login-card">
          <h1>Demo</h1>
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
            SınavOku <span className="panel-badge">demo</span>
          </a>
          <div className="panel-actions">
            <a href="/panel" className="btn btn-ghost btn-sm">Panel</a>
          </div>
        </div>
      </header>

      <main className="panel-wrap panel-main">
        <p className="panel-note">
          Klasik sınav puanlaması, canlı. Fotoğraflar okunur, ön ve arka yüz aynı öğrencide birleşir, her cevap rubriğin
          ölçütlerine göre puanlanır. Her sayfa ve her kâğıt gerçek bir API isteğidir ve ücretlidir; fotoğraflar sunucuda saklanmaz.
        </p>

        <section className="panel-card">
          <h2>Sınav ve rubrik</h2>
          <p className="small muted">
            9. sınıf karma yazılı, 6 soru, 100 puan. Puanı kod hesaplar: model her ölçüt için karar ve kâğıttan alıntı verir,
            kâğıtta bulunmayan alıntı puan getirmez.
          </p>
          {rubric && (
            <details style={{ marginTop: 10 }}>
              <summary className="small">Rubriği göster</summary>
              {rubric.questions.map((q) => (
                <div key={q.q} className="klasik-q">
                  <strong className="small">{q.q}. {q.prompt}</strong>
                  <p className="tiny muted">Anahtar: {q.answer}</p>
                  <ul className="small console-list">
                    {q.criteria.map((c) => (
                      <li key={c.id}>{c.text} — {c.points} puan{c.role === 'result' ? ' (sonuç)' : ''}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          )}
        </section>

        <section className="panel-card">
          <div className="console-row between">
            <div>
              <h2>Kâğıtlar</h2>
              <p className="small muted">Her öğrencinin önce ön yüzünü, hemen ardından arka yüzünü koyun. Sırayı oklarla düzeltebilirsiniz.</p>
            </div>
            <div className="console-row">
              <button type="button" className="btn btn-ghost btn-sm" disabled={running || !items.length} onClick={clear}>Temizle</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={running || !items.length} onClick={run}>
                {running ? 'Çalışıyor…' : 'Oku ve puanla'}
              </button>
            </div>
          </div>

          <div
            className={`drop${dragging ? ' over' : ''}`}
            style={{ marginTop: 14 }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!running) add(e.dataTransfer.files); }}
          >
            <span className="drop-title">Fotoğrafları buraya bırakın</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={running} onClick={() => input.current?.click()}>Fotoğraf seç</button>
            <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </div>

          {items.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="panel-table">
                <thead><tr><th>#</th><th>Fotoğraf</th><th>Durum</th><th>Okunan</th><th /></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.key}>
                      <td>{i + 1}</td>
                      <td>
                        <a href={it.url} target="_blank" rel="noreferrer">
                          <img src={it.url} alt={it.file.name} style={{ width: 56, height: 72, objectFit: 'cover', borderRadius: 4, verticalAlign: 'middle', marginRight: 10 }} />
                        </a>
                        <span className="small">{it.file.name}</span>
                      </td>
                      <td className="small">
                        {it.status === 'wait' && 'sırada'}
                        {it.status === 'reading' && 'okunuyor…'}
                        {it.status === 'read' && `okundu (${fmt((it.ms ?? 0) / 1000)} sn)`}
                        {it.status === 'error' && <span className="console-err">{it.error}</span>}
                      </td>
                      <td className="small">
                        {it.read && (it.read.unreadable ? 'okunamadı'
                          : it.read.isBackSide ? `arka yüz · ${it.read.answers.length} soru`
                            : `${it.read.studentName ?? 'isim yok'} · ${it.read.answers.length} soru`)}
                      </td>
                      <td className="nowrap">
                        <button type="button" className="console-link" disabled={running || i === 0} onClick={() => move(i, -1)} aria-label="Yukarı">↑</button>{' '}
                        <button type="button" className="console-link" disabled={running || i === items.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı">↓</button>{' '}
                        <button type="button" className="console-link" disabled={running} onClick={() => remove(it.key)} aria-label="Kaldır">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {groups.length > 0 && (
          <section className="panel-card">
            <h2>Sonuçlar</h2>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="panel-table">
                <thead><tr><th>Sayfalar</th><th>Öğrenci</th><th>Puan</th><th>Beklenen</th><th>Kontrol</th></tr></thead>
                <tbody>
                  {groups.map((g, i) => {
                    const pages = g.keys.map(pageNo).join(' + ');
                    if (g.status !== 'done') {
                      return (
                        <tr key={i}>
                          <td>{pages}</td>
                          <td colSpan={4} className="small">{g.status === 'error' ? <span className="console-err">{g.error}</span> : g.status === 'grading' ? 'puanlanıyor…' : 'sırada'}</td>
                        </tr>
                      );
                    }
                    return g.sheets!.map((s, k) => {
                      const flagged = s.questions.filter((q) => q.attention.length).length;
                      const diff = s.expected ? s.total - s.expected.total : null;
                      return (
                        <tr key={`${i}-${k}`}>
                          <td>{pages}</td>
                          <td><a href={`#ogrenci-${i}-${k}`}>{s.student ?? 'İsimsiz'}</a></td>
                          <td><strong>{fmt(s.total)}</strong> / {s.max}</td>
                          <td className="small">
                            {s.expected ? <>{fmt(s.expected.total)} {diff === 0 ? <span style={{ color: 'var(--board)' }}>✓ aynı</span>
                              : <span className="console-err">({diff! > 0 ? '+' : ''}{fmt(diff!)})</span>}</> : '—'}
                          </td>
                          <td className="small">{flagged ? <span className="console-err">{flagged} soru</span> : 'yok'}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              Token: okuma {totals.readTokens.toLocaleString('tr-TR')}, puanlama {totals.gradeTokens.toLocaleString('tr-TR')}.
              &quot;Beklenen&quot;, örnek setteki öğrenciler için önceden belirlenen öğretmen puanıdır.
            </p>
          </section>
        )}

        {groups.map((g, i) => (g.sheets ?? []).map((s, k) => (
          <section key={`${i}-${k}`} id={`ogrenci-${i}-${k}`} className="panel-card">
            <div className="console-row between">
              <div>
                <h2>{s.student ?? 'İsimsiz kâğıt'}</h2>
                <p className="tiny muted">{s.pages} sayfa · puanlama {fmt(s.ms / 1000)} sn</p>
              </div>
              <span className="console-status">{fmt(s.total)} / {s.max}{s.expected ? ` · beklenen ${fmt(s.expected.total)}` : ''}</span>
            </div>
            {s.questions.map((q) => <QuestionView key={q.q} q={q} prompt={rubric?.questions.find((x) => x.q === q.q)?.prompt ?? null}
              expected={s.expected?.questions.find((x) => x.q === q.q)?.points} />)}
          </section>
        )))}
      </main>
    </div>
  );
}

function QuestionView({ q, prompt, expected }: { q: DemoQuestion; prompt: string | null; expected?: number }) {
  const off = expected !== undefined && expected !== q.points;
  return (
    <div className={`klasik-q${q.attention.length ? ' flagged' : ''}`}>
      <div className="console-row between">
        <strong className="small">{q.q}. soru — {fmt(q.points)} / {q.max}</strong>
        <span className="tiny muted">
          {STATUS[q.status] ?? ''}
          {expected !== undefined && <span className={off ? 'console-err' : ''}>{STATUS[q.status] ? ' · ' : ''}beklenen {fmt(expected)}</span>}
        </span>
      </div>
      {prompt && <p className="tiny muted">{prompt}</p>}
      {q.attention.length > 0 && <ul className="small console-list console-err">{q.attention.map((t) => <li key={t}>{t}</li>)}</ul>}
      {q.info.length > 0 && <p className="tiny muted">{q.info.join(' · ')}</p>}
      {q.grade?.note && <p className="small">{q.grade.note}</p>}
      {q.grade?.firstError && <p className="tiny muted">İlk hatalı adım: {q.grade.firstError}</p>}
      <div className="klasik-answer">
        {q.lines.length ? q.lines.map((l, i) => (
          <div key={i} className={l.crossed ? 'klasik-line crossed' : 'klasik-line'}>{l.text}</div>
        )) : <div className="klasik-line muted">(cevap yok)</div>}
      </div>
      {q.criteria.some((c) => c.verdict) && (
        <table className="klasik-crit">
          <tbody>
            {q.criteria.map((c) => (
              <tr key={c.id}>
                <td>{c.text}{c.role === 'result' ? ' (sonuç)' : ''}</td>
                <td className="nowrap">{c.verdict ? VERDICT[c.verdict] : '—'}</td>
                <td className="nowrap">{fmt(c.earned)} / {c.points}</td>
                <td className="tiny muted">
                  {c.evidence && <>“{c.evidence}”</>}
                  {c.verdict && c.verdict !== 'not_met' && !c.counted && <> — sayılmadı</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
