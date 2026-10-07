'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminUrl, type Overview as Data } from './api';
import { SmallMultiples } from './Chart';
import { JOB_STATUS, num, shortDay, tlKurus } from './format';
import { Card, Chips, ErrorBox, Header, Loading, StatLedger, Tabs, useLoad, useNarrow, useQueryState } from './ui';

// a phone shows one group of the ledger at a time
function pick<G extends { title: string }>(phone: boolean, title: string, groups: G[]): G[] {
  return phone ? groups.filter((g) => g.title === title) : groups;
}

const compact = (n: number) => n.toLocaleString('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });

export default function Overview() {
  const { data, error, loading, reload } = useLoad<Data>(adminUrl.overview());

  return (
    <>
      <Header title="Genel bakış" sub="Gelir, öğretmenler ve sınavların bugünkü durumu." actions={
        <button type="button" className="adm-btn" onClick={reload} disabled={loading}>{loading && data ? 'Yenileniyor…' : 'Yenile'}</button>
      } />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && loading && <Loading rows={8} />}
      {data && <Body d={data} />}
    </>
  );
}

type Tab = 'ozet' | 'grafik' | 'durum';
type Metric = 'rev' | 'sign' | 'jobs';

// One screen, never a long scroll: the figures, the 30-day chart and the
// exams by status are three tabs; the chart shows one series at a time.
function Body({ d }: { d: Data }) {
  const q = useQueryState();
  const tab = (['ozet', 'grafik', 'durum'] as const).find((t) => t === q.get('sekme')) ?? 'ozet';
  const metric = (['rev', 'sign', 'jobs'] as const).find((m) => m === q.get('seri')) ?? 'rev';
  const phone = useNarrow(640);
  const [group, setGroup] = useState('Gelir');
  const pagesTotal = d.pages30.read + d.pages30.failed;
  const errRate = pagesTotal ? (d.pages30.failed / pagesTotal) * 100 : 0;
  const unverified = Math.max(0, d.users.total - d.users.verified);
  const series = d.series;
  const sum = (k: 'revenueKurus' | 'signups' | 'jobs') => series.reduce((n, p) => n + p[k], 0);
  const payments = (n: number) => (n ? `${num(n)} ödeme` : 'Ödeme yok');

  const all = {
    rev: { id: 'rev', title: 'Gelir', kind: 'bar' as const, values: series.map((p) => p.revenueKurus), format: tlKurus, total: tlKurus(sum('revenueKurus')), minStep: 100, emptyNote: 'Bu dönemde gelir yok' },
    sign: { id: 'sign', title: 'Yeni kayıt', kind: 'line' as const, values: series.map((p) => p.signups), format: (n: number) => num(n), total: num(sum('signups')), minStep: 1, emptyNote: 'Bu dönemde kayıt yok' },
    jobs: { id: 'jobs', title: 'Gönderilen sınav', kind: 'line' as const, values: series.map((p) => p.jobs), format: (n: number) => num(n), total: num(sum('jobs')), minStep: 1, emptyNote: 'Bu dönemde sınav gönderilmedi' },
  };

  return (
    <>
      <Tabs<Tab> value={tab} onChange={(t) => q.set({ sekme: t === 'ozet' ? null : t })} tabs={[
        { id: 'ozet', label: 'Özet' },
        { id: 'grafik', label: 'Son 30 gün' },
        { id: 'durum', label: 'Sınav durumları', count: d.jobs.open },
      ]} />
      {tab === 'ozet' && phone && (
        <Chips label="Grup" value={group} onChange={setGroup} options={['Gelir', 'Öğretmenler', 'Sınavlar', 'Okuma'].map((g) => ({ id: g, label: g }))} />
      )}
      {tab === 'ozet' && (
      <StatLedger label="Özet" groups={pick(phone, group, [
          {
            title: 'Gelir', href: '/admin/odemeler?filtre=paid', items: [
              { label: 'Bugün', value: tlKurus(d.revenue.today.kurus), hint: payments(d.revenue.today.payments) },
              { label: 'Son 7 gün', value: tlKurus(d.revenue.d7.kurus), hint: payments(d.revenue.d7.payments) },
              { label: 'Son 30 gün', value: tlKurus(d.revenue.d30.kurus), hint: payments(d.revenue.d30.payments) },
              { label: 'Kullanılmamış hak', value: num(d.users.outstandingPages), hint: 'sayfa, bakiyelerde' },
            ],
          },
          {
            title: 'Öğretmenler', href: '/admin/ogretmenler', items: [
              { label: 'Toplam', value: num(d.users.total), hint: <>bugün {num(d.signups.today)}, 7 günde {num(d.signups.d7)} yeni</> },
              { label: 'Doğrulanmış', value: num(d.users.verified),
                hint: unverified ? `${num(unverified)} doğrulanmadı` : 'Tümü doğrulandı',
                tone: unverified ? 'warn' : undefined, href: unverified ? '/admin/ogretmenler?filtre=unverified' : undefined },
              { label: 'Ödeme yapan', value: num(d.users.paying),
                hint: d.users.total ? `%${num((d.users.paying / d.users.total) * 100)}` : undefined, href: '/admin/ogretmenler?filtre=paying' },
              { label: 'Askıda', value: num(d.users.suspended), href: d.users.suspended ? '/admin/ogretmenler?filtre=suspended' : undefined },
            ],
          },
          {
            title: 'Sınavlar', href: '/admin/sinavlar', items: [
              { label: 'Açık', value: num(d.jobs.open), hint: 'okunuyor ya da kontrolde', href: '/admin/sinavlar?filtre=open' },
              { label: 'Takılı', value: num(d.jobs.stuck), tone: d.jobs.stuck > 0 ? 'mark' : undefined,
                hint: d.jobs.stuck > 0 ? '2 saattir ilerlemiyor' : 'Takılan yok', href: '/admin/sinavlar?filtre=stuck' },
              { label: 'Başarısız', value: num(d.jobs.failed30), hint: 'son 30 gün', href: '/admin/sinavlar?filtre=failed' },
              { label: 'Gönderilen', value: num(sum('jobs')), hint: 'son 30 gün' },
            ],
          },
          {
            title: 'Okuma', items: [
              { label: 'Okunan sayfa', value: num(d.pages30.read), hint: 'son 30 gün' },
              { label: 'Okunamayan', value: num(d.pages30.failed), tone: d.pages30.failed > 0 && errRate >= 5 ? 'mark' : undefined },
              { label: 'Hata oranı', value: `%${num(errRate, 1)}`, tone: errRate >= 5 ? 'mark' : undefined,
                hint: errRate >= 5 ? '%5 sınırının üstünde' : '%5 sınırının altında' },
              { label: 'AI token', value: compact(d.pages30.inputTokens + d.pages30.outputTokens),
                hint: <>girdi {compact(d.pages30.inputTokens)}, çıktı {compact(d.pages30.outputTokens)}</> },
            ],
          },
        ])} />
      )}
      {tab === 'grafik' && (
        <Card title="Son 30 gün" aside={
          <Chips<Metric> label="Seri" value={metric} onChange={(m) => q.set({ seri: m === 'rev' ? null : m })} options={[
            { id: 'rev', label: 'Gelir' }, { id: 'sign', label: 'Kayıt' }, { id: 'jobs', label: 'Sınav' },
          ]} />
        }>
          <SmallMultiples labels={series.map((p) => shortDay(p.day))} heights={[220]} series={[all[metric]]} />
          <p className="adm-muted adm-chart-note">Günlük, Türkiye saati</p>
        </Card>
      )}
      {tab === 'durum' && (
      <Card title="Durumlara göre sınavlar" flush>
          <ul className="adm-status-strip">
            {Object.entries(JOB_STATUS).map(([k, m]) => {
              const n = d.jobs.byStatus[k] ?? 0;
              return (
                <li key={k}>
                  <Link href={`/admin/sinavlar?filtre=${k === 'done' || k === 'failed' || k === 'draft' ? k : k === 'rubric' || k === 'review' ? 'review' : 'open'}`}>
                    <span className="k"><span className={`adm-dot ${m.tone}`} aria-hidden="true" />{m.label}</span>
                    <span className={`v${n ? '' : ' zero'}`}>{num(n)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
