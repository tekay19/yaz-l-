'use client';

import { useState } from 'react';
import { adminUrl, clearAnalytics, type Analytics } from './api';
import { SmallMultiples } from './Chart';
import { dt, num, shortDay } from './format';
import { BarList, Card, Chips, Confirm, Empty, ErrorBox, Header, Loading, Notice, StatStrip, Tabs, useLoad, useQueryState } from './ui';

const RANGES = [
  { id: '24h', label: 'Son 24 saat' },
  { id: '7d', label: '7 gün' },
  { id: '30d', label: '30 gün' },
  { id: 'all', label: 'Tümü' },
] as const;
type Range = (typeof RANGES)[number]['id'];

const pageName = (p: string) => (p === 'index' ? '/' : p.startsWith('/') ? p : `/${p}`);
const EVENT: Record<string, string> = {
  page_view: 'Sayfa görüntüleme', scroll_depth: 'Kaydırma', cta_click: 'Buton tıklaması', pack_click: 'Paket tıklaması',
  card_start: 'Kart girişi', buy_submit: 'Satın alma denemesi', error_view: 'Hata sayfası', waitlist_submit: 'Bekleme listesi',
  exit: 'Çıkış', lead: 'E-posta bırakıldı',
};

function csvCell(v: string) {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function downloadLeads(rows: Analytics['leads']) {
  const lines = ['email,kaynak,tarih', ...rows.map((r) => [r.email, r.source, r.ts].map((v) => csvCell(String(v ?? ''))).join(','))];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sinavoku-adaylar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AnalyticsPage() {
  const { get, set } = useQueryState();
  const range = (RANGES.some((r) => r.id === get('aralik')) ? get('aralik') : '7d') as Range;
  const { data, error, loading, reload } = useLoad<Analytics>(adminUrl.analytics(range));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function clear() {
    const r = await clearAnalytics();
    setMsg(r.ok ? { kind: 'ok', text: 'Ziyaretçi verileri silindi.' } : { kind: 'err', text: r.error });
    if (r.ok) reload();
  }

  return (
    <>
      <Header title="Ziyaretçi analitiği" sub="Tanıtım sitesindeki ziyaretler ve satın alma hunisi."
        actions={<Confirm label="Verileri temizle" question="Tüm ziyaretçi olayları kalıcı olarak silinsin mi?" confirmLabel="Evet, sil" danger onConfirm={clear} />} />
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      <div className="adm-toolbar bare">
        <Chips label="Zaman aralığı" options={[...RANGES]} value={range} onChange={(v) => set({ aralik: v === '7d' ? null : v })} />
        {loading && data && <span className="adm-muted">Yenileniyor…</span>}
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && loading && <Loading rows={8} />}
      {data && <Body d={data} />}
    </>
  );
}

type Tab = 'huni' | 'gun' | 'kaynak' | 'eposta' | 'olay';

// The figures stay on top; everything below is one tab at a time.
function Body({ d }: { d: Analytics }) {
  const q = useQueryState();
  const tab = (['huni', 'gun', 'kaynak', 'eposta', 'olay'] as const).find((x) => x === q.get('sekme')) ?? 'huni';
  const t = d.totals;
  const dev = d.devices.mobile + d.devices.desktop;
  if (!t.events) return <Card><Empty title="Bu aralıkta olay yok">Ziyaretçi geldikçe veriler burada görünür.</Empty></Card>;
  const maxFunnel = Math.max(...d.funnel.map((f) => f.sessions), 1);

  return (
    <>
      <StatStrip label="Ziyaret özeti" items={[
        { label: 'Ziyaretçi', value: num(t.visitors), hint: `${num(t.sessions)} oturum` },
        { label: 'Sayfa görüntüleme', value: num(t.page_view), hint: t.sessions ? `oturum başına ${num(t.page_view / t.sessions, 1)}` : undefined },
        { label: 'Buton tıklaması', value: num(t.cta_click), hint: `${num(t.pack_click)} paket tıklaması` },
        { label: 'Satın alma denemesi', value: num(t.buy_submit), hint: `${num(t.card_start)} kart girişi` },
        { label: 'E-posta bırakan', value: num(d.leads.length), hint: `${num(t.waitlist_submit)} bekleme listesi` },
        { label: 'Hata sayfası', value: num(t.error_view), tone: t.error_view ? 'mark' : undefined, hint: t.error_view ? 'görüntülendi' : 'Görüntülenmedi' },
      ]} />

      <Tabs<Tab> value={tab} onChange={(x) => q.set({ sekme: x === 'huni' ? null : x })} tabs={[
        { id: 'huni', label: 'Huni' },
        { id: 'gun', label: 'Günlük' },
        { id: 'kaynak', label: 'Nereden, ne yaptılar' },
        { id: 'eposta', label: 'E-posta bırakanlar', count: d.leads.length },
        { id: 'olay', label: 'Son olaylar' },
      ]} />

      {tab === 'huni' && <Card title="Huni" aside={<span className="adm-muted">Vitrine gelen oturumlara göre</span>}>
          <ol className="adm-funnel">
            {d.funnel.map((f) => (
              <li key={f.key}>
                <span className="name">{f.label}</span>
                <span className="track"><span style={{ width: `${Math.max(1.5, (f.sessions / maxFunnel) * 100)}%` }} /></span>
                <span className="val">{num(f.sessions)} <small>%{num(f.share, 1)}</small></span>
              </li>
            ))}
          </ol>
        </Card>}
      {tab === 'gun' && <Card title="Günlük görüntüleme">
          {d.byDay.length ? (
            <SmallMultiples labels={d.byDay.map((b) => shortDay(b.name))}
              series={[{ id: 'pv', title: 'Sayfa görüntüleme', kind: 'bar', values: d.byDay.map((b) => b.count), format: (n) => num(n), total: num(t.page_view), minStep: 1 }]}
              heights={[150]} />
          ) : <p className="adm-muted adm-pad">Bu aralıkta görüntüleme yok.</p>}
        </Card>}

      {tab === 'kaynak' && <Card title="Nereden gelip ne yaptılar" flush>
        <div className="adm-breakdown">
          <section><h3>Sayfalar</h3><BarList rows={d.pageViews.slice(0, 10).map((r) => ({ name: pageName(r.name), value: r.count }))} /></section>
          <section><h3>Kaynaklar</h3><BarList rows={d.referrers.map((r) => ({ name: r.name, value: r.count }))} /></section>
          <section>
            <h3>Cihaz</h3>
            <BarList rows={[
              { name: 'Mobil', value: d.devices.mobile, hint: dev ? `%${num((d.devices.mobile / dev) * 100)}` : undefined },
              { name: 'Masaüstü', value: d.devices.desktop, hint: dev ? `%${num((d.devices.desktop / dev) * 100)}` : undefined },
            ]} />
          </section>
          <section><h3>Buton tıklamaları</h3><BarList rows={d.ctas.map((r) => ({ name: r.name, value: r.count }))} empty="Tıklama yok." /></section>
          <section><h3>Paket tıklamaları</h3><BarList rows={d.packs.map((r) => ({ name: r.name, value: r.count }))} empty="Tıklama yok." /></section>
          <section>
            <h3>Sayfada kalma</h3>
            <BarList rows={d.avgSeconds.slice(0, 8).map((r) => ({ name: pageName(r.name), value: r.value }))} format={(n) => `${num(n)} sn`} />
            {d.avgScroll.length > 0 && (
              <p className="adm-hint">Ortalama kaydırma: {d.avgScroll.slice(0, 4).map((r) => `${pageName(r.name)} %${num(r.value)}`).join(', ')}</p>
            )}
          </section>
        </div>
      </Card>}

      {tab === 'eposta' && <Card title="E-posta bırakanlar" flush aside={d.leads.length > 0 && (
        <button type="button" className="adm-btn sm" onClick={() => downloadLeads(d.leads)}>CSV indir</button>
      )}>
        {d.leads.length === 0 ? <Empty title="Bu aralıkta e-posta bırakan yok" /> : (
          <div className="adm-table-wrap adm-scroll-y">
            <table className="adm-table compact">
              <thead><tr><th scope="col">E-posta</th><th scope="col">Kaynak</th><th scope="col">Tarih</th></tr></thead>
              <tbody>
                {d.leads.map((l) => (
                  <tr key={l.email + l.ts}><td className="strong">{l.email}</td><td>{l.source || '—'}</td><td className="nowrap">{dt(l.ts)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>}

      {tab === 'olay' && <Card title="Son olaylar" flush>
        <div className="adm-table-wrap adm-scroll-y">
          <table className="adm-table compact">
            <thead><tr><th scope="col">Zaman</th><th scope="col">Olay</th><th scope="col">Sayfa</th><th scope="col">Etiket</th><th scope="col" className="num">Değer</th></tr></thead>
            <tbody>
              {d.recent.map((e, i) => (
                <tr key={i}>
                  <td className="nowrap">{dt(e.ts)}</td>
                  <td className="nowrap">{EVENT[e.event] ?? e.event}</td>
                  <td>{pageName(e.page)}</td>
                  <td className="adm-detail">{e.label || <span className="adm-muted">—</span>}</td>
                  <td className="num">{e.value ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>}
    </>
  );
}
