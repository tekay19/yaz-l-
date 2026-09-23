'use client';

// The admin panel.
//
// It holds no secret of its own: it asks /api/admin to sign it in and then
// relies on the HttpOnly session cookie, which this code cannot read. Every
// value below is rendered as text by React, never as HTML, so a label
// captured from the site can never execute in here.

import { useCallback, useEffect, useState } from 'react';

type Row = { name: string; count: number };
type Avg = { name: string; value: number };
type Lead = { email: string; source: string; ts: string };

type Stats = {
  range: string;
  storage: 'kv' | 'memory';
  storeError: string | null;
  totals: Record<string, number>;
  pageViews: Row[];
  funnel: { key: string; label: string; sessions: number; share: number }[];
  ctas: Row[];
  packs: Row[];
  referrers: Row[];
  byDay: Row[];
  devices: { mobile: number; desktop: number };
  avgScroll: Avg[];
  avgSeconds: Avg[];
  leads: Lead[];
  recent: { ts: string; event: string; page: string; label: string; value: number | null }[];
};

const RANGES: [string, string][] = [
  ['24h', '24 saat'],
  ['7d', '7 gün'],
  ['30d', '30 gün'],
  ['all', 'Tümü'],
];

const nf = new Intl.NumberFormat('tr-TR');
const num = (n: number | undefined) => nf.format(n || 0);

function Bars({ items, unit }: { items: { name: string; n: number }[]; unit?: string }) {
  if (!items.length) return <p className="empty">Bu aralıkta veri yok.</p>;
  const max = Math.max(...items.map((i) => i.n));
  return (
    <div className="rows">
      {items.map((item) => (
        <div className="row-bar" key={item.name}>
          <div className="lbl">
            <span>{item.name || '—'}</span>
            <div className="track">
              <span
                className="fill"
                style={{ width: max ? `${Math.max(2, (item.n / max) * 100)}%` : '2px' }}
              />
            </div>
          </div>
          <div className="n">{unit ? `${item.n}${unit}` : num(item.n)}</div>
        </div>
      ))}
    </div>
  );
}

export default function Panel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState('7d');
  const [data, setData] = useState<Stats | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async (r: string) => {
    try {
      const res = await fetch(`/api/stats?range=${encodeURIComponent(r)}`, {
        credentials: 'same-origin',
      });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      setData((await res.json()) as Stats);
      setLoadError('');
    } catch {
      setLoadError('Veriler alınamadı. Bağlantınızı kontrol edin.');
    }
  }, []);

  useEffect(() => {
    fetch('/api/admin?action=session', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j) => setAuthed(Boolean(j.authed)))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) load(range);
  }, [authed, range, load]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      setPassword('');
      if (res.ok) {
        setAuthed(true);
        return;
      }
      const j = await res.json().catch(() => ({}) as { error?: string });
      setLoginError(
        j.error === 'too_many_attempts'
          ? 'Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.'
          : j.error === 'server_not_configured'
            ? 'Sunucu yapılandırılmamış: ADMIN_PASSWORD ve ADMIN_SECRET tanımlayın.'
            : 'Parola hatalı.',
      );
    } catch {
      setLoginError('Bağlanılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await fetch('/api/admin?action=logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {});
    setAuthed(false);
    setData(null);
  }

  function exportCsv() {
    if (!data) return;
    const rows: (string | number)[][] = [['zaman', 'olay', 'sayfa', 'etiket', 'deger']];
    data.recent.forEach((r) => rows.push([r.ts, r.event, r.page, r.label, r.value ?? '']));
    rows.push([], ['e-posta', 'kaynak', 'zaman']);
    data.leads.forEach((l) => rows.push([l.email, l.source, l.ts]));

    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sinavoku-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authed === null) return <div className="panel-login" />;

  if (!authed) {
    return (
      <div className="panel-login">
        <form className="card panel-login-card" onSubmit={onLogin} autoComplete="off">
          <span className="logo-mark" aria-hidden="true">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <h1>Yönetim paneli</h1>
          <p className="small muted">Bu sayfa yalnızca yetkili kullanıcılar içindir.</p>

          <div className="field" style={{ marginTop: 22 }}>
            <label htmlFor="pw">Parola</label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy}>
            {busy ? 'Kontrol ediliyor…' : 'Giriş yapın'}
          </button>

          {loginError && (
            <p className="status err" role="alert">
              {loginError}
            </p>
          )}
        </form>
      </div>
    );
  }

  const t = data?.totals ?? {};
  const kpis: [string, string, string][] = [
    ['Ziyaretçi', num(t.visitors), 'benzersiz tarayıcı'],
    ['Oturum', num(t.sessions), 'ayrı ziyaret'],
    ['Sayfa görüntüleme', num(t.page_view), ''],
    ['Paket tıklaması', num(t.pack_click), ''],
    ['Forma başlayan', num(t.card_start), 'gerçek niyet sinyali'],
    ['Sipariş veren', num(t.buy_submit), ''],
    ['E-posta bırakan', num((t.lead || 0) + (t.waitlist_submit || 0)), 'toplam lead'],
    ['Toplam olay', num(t.events), ''],
  ];

  const topFunnel = Math.max(...(data?.funnel.map((f) => f.sessions) ?? [1]), 1);

  return (
    <div>
      <header className="panel-head">
        <div className="panel-wrap">
          <a href="/" className="logo">
            <span className="logo-mark" aria-hidden="true">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            SınavOku <span className="panel-badge">panel</span>
          </a>

          <div className="panel-actions">
            <div className="seg" role="group" aria-label="Zaman aralığı">
              {RANGES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={range === key ? 'on' : undefined}
                  onClick={() => setRange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => load(range)}>
              Yenile
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
              CSV
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="panel-wrap panel-main">
        {loadError && <p className="panel-note">{loadError}</p>}
        {data?.storage === 'memory' && (
          <p className="panel-note">
            Kalıcı depolama bağlı değil: kayıtlar yalnızca sunucu ayakta kaldığı sürece tutulur.
            KV_REST_API_URL ve KV_REST_API_TOKEN tanımlayın.
          </p>
        )}
        {data?.storeError && (
          <p className="panel-note">Depolama okunamadı; gösterilen sayılar eksik olabilir.</p>
        )}

        <section className="kpi-grid">
          {kpis.map(([k, v, s]) => (
            <div className="kpi" key={k}>
              <div className="k">{k}</div>
              <div className="v">{v}</div>
              {s && <div className="s">{s}</div>}
            </div>
          ))}
        </section>

        <section className="panel-card">
          <h2>Huni — hangi adımda kaç kişi</h2>
          <p className="small muted">Vitrini gören oturumlara oranla.</p>
          <div className="funnel">
            {data?.funnel.map((step) => (
              <div className="fstep" key={step.key}>
                <div className="name">{step.label}</div>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: `${Math.max(1, (step.sessions / topFunnel) * 100)}%` }}
                  />
                </div>
                <div className="num">
                  <b>{num(step.sessions)}</b> · %{step.share}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="panel-cols">
          <section className="panel-card">
            <h2>En çok gidilen sayfalar</h2>
            <Bars items={(data?.pageViews ?? []).map((r) => ({ name: r.name, n: r.count }))} />
          </section>

          <section className="panel-card">
            <h2>Paket tıklamaları</h2>
            <p className="small muted">Hangi paket ilgi görüyor.</p>
            <Bars items={(data?.packs ?? []).map((r) => ({ name: r.name, n: r.count }))} />
          </section>
        </div>

        <section className="panel-card">
          <h2>Günlük sayfa görüntüleme</h2>
          {!data?.byDay.length ? (
            <p className="empty">Bu aralıkta veri yok.</p>
          ) : (
            <div className="spark">
              {data.byDay.slice(-30).map((day) => {
                const max = Math.max(...data.byDay.map((x) => x.count));
                return (
                  <div className="col" key={day.name}>
                    <div className="val">{num(day.count)}</div>
                    <div
                      className="bar"
                      style={{ height: `${Math.max(3, (day.count / max) * 100)}%` }}
                    />
                    <div className="cap">{day.name.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="panel-cols">
          <section className="panel-card">
            <h2>Tıklanan düğmeler</h2>
            <Bars items={(data?.ctas ?? []).map((r) => ({ name: r.name, n: r.count }))} />
          </section>

          <section className="panel-card">
            <h2>Nereden geldiler</h2>
            <Bars items={(data?.referrers ?? []).map((r) => ({ name: r.name, n: r.count }))} />
          </section>
        </div>

        <div className="panel-cols">
          <section className="panel-card">
            <h2>Cihaz</h2>
            <Bars
              items={[
                { name: 'Mobil', n: data?.devices.mobile ?? 0 },
                { name: 'Masaüstü', n: data?.devices.desktop ?? 0 },
              ]}
            />
          </section>

          <section className="panel-card">
            <h2>Sayfada kalma ve kaydırma</h2>
            <Bars
              items={(data?.avgScroll ?? []).map((s) => ({ name: `${s.name} — kaydırma`, n: s.value }))}
              unit="%"
            />
            <Bars
              items={(data?.avgSeconds ?? []).map((s) => ({ name: `${s.name} — süre`, n: s.value }))}
              unit=" sn"
            />
          </section>
        </div>

        <section className="panel-card">
          <h2>Bırakılan e-postalar</h2>
          <p className="small muted">Huninin asıl çıktısı.</p>
          <div className="table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>E-posta</th>
                  <th>Kaynak</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {!data?.leads.length ? (
                  <tr>
                    <td colSpan={3}>Bu aralıkta kayıt yok.</td>
                  </tr>
                ) : (
                  data.leads.map((l) => (
                    <tr key={l.email}>
                      <td>{l.email}</td>
                      <td>{l.source}</td>
                      <td>{new Date(l.ts).toLocaleString('tr-TR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card">
          <h2>Son hareketler</h2>
          <div className="table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Olay</th>
                  <th>Sayfa</th>
                  <th>Etiket</th>
                  <th>Değer</th>
                </tr>
              </thead>
              <tbody>
                {!data?.recent.length ? (
                  <tr>
                    <td colSpan={5}>Bu aralıkta kayıt yok.</td>
                  </tr>
                ) : (
                  data.recent.map((r, i) => (
                    <tr key={`${r.ts}-${i}`}>
                      <td>{new Date(r.ts).toLocaleString('tr-TR')}</td>
                      <td>
                        <span
                          className={`ev${r.event === 'buy_submit' ? ' buy' : r.event === 'error_view' ? ' err' : ''}`}
                        >
                          {r.event}
                        </span>
                      </td>
                      <td>{r.page || '—'}</td>
                      <td>{r.label || '—'}</td>
                      <td>{r.value ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="tiny muted panel-foot">
          Bu üründe hiçbir adımda kart bilgisi toplanmaz. Ziyaretçi kimliği tarayıcıda üretilen
          rastgele bir değerdir; IP adresi saklanmaz.
        </p>
      </main>
    </div>
  );
}
