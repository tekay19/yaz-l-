'use client';

import Link from 'next/link';
import { adminUrl, type Paged, type UserRow } from './api';
import { ago, day, num, tlKurus } from './format';
import { Badge, Card, Chips, Empty, ErrorBox, Header, Loading, Pager, SearchBox, useLoad, useQueryState, useRowNav } from './ui';

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'paying', label: 'Ödeme yapan' },
  { id: 'unverified', label: 'Doğrulanmamış' },
  { id: 'suspended', label: 'Askıda' },
  { id: 'admin', label: 'Yönetici' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

export function UserBadges({ u }: { u: { verified: boolean; suspended: boolean; role: string; hasPassword: boolean } }) {
  return (
    <span className="adm-badges">
      {u.suspended && <Badge tone="red">Askıda</Badge>}
      {!u.verified && <Badge tone="amber">Doğrulanmadı</Badge>}
      {u.role === 'admin' && <Badge tone="violet">Yönetici</Badge>}
      {!u.hasPassword && <Badge tone="grey" title="Yalnızca e-posta bağlantısıyla giriş yapıyor">Şifresiz</Badge>}
    </span>
  );
}

export default function UsersPage() {
  const { get, set } = useQueryState();
  const q = get('q');
  const filtre = (FILTERS.some((f) => f.id === get('filtre')) ? get('filtre') : 'all') as Filter;
  const sayfa = Math.max(1, Number(get('sayfa')) || 1);
  const { data, error, loading, reload } = useLoad<Paged<UserRow>>(adminUrl.users({ q, filtre, sayfa }));
  const row = useRowNav();

  return (
    <>
      <Header title="Öğretmenler" sub={data ? `${num(data.total)} hesap` : undefined} />
      <Card flush>
        <div className="adm-toolbar">
          <SearchBox value={q} onChange={(v) => set({ q: v, sayfa: null })} placeholder="Ad ya da e-posta ara" label="Öğretmen ara" />
          <Chips label="Filtre" options={[...FILTERS]} value={filtre} onChange={(v) => set({ filtre: v, sayfa: null })} />
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (data.rows.length === 0 ? (
          <Empty title="Eşleşen öğretmen yok">{q ? `“${q}” için sonuç bulunamadı.` : 'Bu filtrede hesap yok.'}</Empty>
        ) : (
          <div className={`adm-table-wrap${loading ? ' adm-stale' : ''}`}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Öğretmen</th>
                  <th scope="col">Durum</th>
                  <th scope="col" className="num">Bakiye</th>
                  <th scope="col" className="num">Ödenen</th>
                  <th scope="col" className="num">Sınav</th>
                  <th scope="col">Kayıt</th>
                  <th scope="col">Son giriş</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((u) => (
                  <tr key={u.id} {...row(`/admin/ogretmenler/${u.id}`)}>
                    <td className="adm-cell-main">
                      <Link href={`/admin/ogretmenler/${u.id}`} className="adm-row-title">{u.name || u.email}</Link>
                      {u.name && <div className="adm-row-sub">{u.email}</div>}
                    </td>
                    <td><UserBadges u={u} /></td>
                    <td className={`num${u.pageBalance ? '' : ' adm-muted'}`}>{num(u.pageBalance)}</td>
                    <td className="num">{u.paidKurus ? tlKurus(u.paidKurus) : <span className="adm-muted">0 TL</span>}</td>
                    <td className={`num${u.jobs ? '' : ' adm-muted'}`}>{num(u.jobs)}</td>
                    <td className="nowrap">{day(u.createdAt)}</td>
                    <td className="nowrap" title={u.lastLoginAt ?? undefined}>{u.lastLoginAt ? ago(u.lastLoginAt) : <span className="adm-muted">Hiç</span>}</td>
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
