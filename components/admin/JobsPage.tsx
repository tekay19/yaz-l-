'use client';

import Link from 'next/link';
import { adminUrl, type JobRow, type Paged } from './api';
import { FAIL_REASON, JOB_STATUS, MODE_LABEL, dt, num } from './format';
import { Card, Chips, Empty, ErrorBox, Header, Loading, Pager, SearchBox, StateBadge, useLoad, useQueryState, useRowNav } from './ui';

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'open', label: 'Açık' },
  { id: 'stuck', label: 'Takılı' },
  { id: 'review', label: 'Kontrolde' },
  { id: 'done', label: 'Tamamlanan' },
  { id: 'failed', label: 'Başarısız' },
  { id: 'draft', label: 'Taslak' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

export default function JobsPage() {
  const { get, set } = useQueryState();
  const q = get('q');
  const filtre = (FILTERS.some((f) => f.id === get('filtre')) ? get('filtre') : 'all') as Filter;
  const mod = get('mod') === 'optik' || get('mod') === 'klasik' ? get('mod') : '';
  const sayfa = Math.max(1, Number(get('sayfa')) || 1);
  const { data, error, loading, reload } = useLoad<Paged<JobRow>>(adminUrl.jobs({ q, filtre, mod, sayfa }));
  const row = useRowNav();

  return (
    <>
      <Header title="Sınavlar" sub={data ? `${num(data.total)} sınav${filtre === 'stuck' ? ', 2 saatten uzun süredir ilerlemeyenler' : ''}` : undefined} />
      <Card flush>
        <div className="adm-toolbar">
          <SearchBox value={q} onChange={(v) => set({ q: v, sayfa: null })} placeholder="Başlık ya da e-posta ara" label="Sınav ara" />
          <label className="adm-select">
            <span className="sr-only">Mod</span>
            <select value={mod} onChange={(e) => set({ mod: e.target.value, sayfa: null })}>
              <option value="">Tüm modlar</option>
              <option value="optik">Optik</option>
              <option value="klasik">Klasik</option>
            </select>
          </label>
          <Chips label="Durum" options={[...FILTERS]} value={filtre} onChange={(v) => set({ filtre: v, sayfa: null })} />
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (data.rows.length === 0 ? (
          <Empty title={filtre === 'stuck' ? 'Takılı sınav yok' : 'Eşleşen sınav yok'}>
            {filtre === 'stuck' ? 'Gönderilen tüm sınavlar ilerliyor.' : q ? `“${q}” için sonuç bulunamadı.` : 'Bu filtrede sınav yok.'}
          </Empty>
        ) : (
          <div className={`adm-table-wrap${loading ? ' adm-stale' : ''}`}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Başlık</th>
                  <th scope="col">Öğretmen</th>
                  <th scope="col">Mod</th>
                  <th scope="col">Durum</th>
                  <th scope="col" className="num">Okunan sayfa</th>
                  <th scope="col" className="num">Ayrılan hak</th>
                  <th scope="col">Gönderim</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((j) => (
                  <tr key={j.id} {...row(`/admin/sinavlar/${j.id}`)}>
                    <td className="adm-cell-main">
                      <Link href={`/admin/sinavlar/${j.id}`} className="adm-row-title">{j.title || 'Adsız sınav'}</Link>
                      {j.failReason && <div className="adm-row-sub">{FAIL_REASON[j.failReason] ?? j.failReason}</div>}
                    </td>
                    <td><Link href={`/admin/ogretmenler/${j.userId}`} className="adm-link">{j.email}</Link></td>
                    <td>{MODE_LABEL[j.mode] ?? j.mode}</td>
                    <td><StateBadge map={JOB_STATUS} value={j.status} /></td>
                    <td className="num nowrap">
                      {num(j.readPages)}<span className="adm-muted"> / {num(j.pages)}</span>
                      {j.failedPages > 0 && <div className="adm-cell-note adm-red">{num(j.failedPages)} okunamadı</div>}
                    </td>
                    <td className="num">{num(j.reservedPages)}</td>
                    <td className="nowrap">{j.submittedAt ? dt(j.submittedAt) : <span className="adm-muted">Gönderilmedi</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {data && data.total > data.size && <Pager page={data.page} size={data.size} total={data.total} onPage={(p) => set({ sayfa: p })} />}
      </Card>
    </>
  );
}
