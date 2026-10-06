'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminUrl, reconcilePayment, type AdminPaymentRow, type Paged } from './api';
import { PAY_STATUS, dt, num, packLabel, tlKurus } from './format';
import { Card, Chips, Empty, ErrorBox, Header, Loading, Notice, Pager, SearchBox, StateBadge, useLoad, useQueryState } from './ui';

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'paid', label: 'Ödendi' },
  { id: 'pending', label: 'Bekliyor' },
  { id: 'failed', label: 'Başarısız' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

const RESULT: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  paid: { kind: 'ok', text: 'iyzico ödemeyi onayladı; sayfa hakkı öğretmene eklendi.' },
  failed: { kind: 'err', text: 'iyzico ödemenin başarısız olduğunu bildirdi; kayıt başarısız olarak işaretlendi.' },
  unknown: { kind: 'err', text: 'iyzico henüz kesin bir sonuç vermedi; ödeme bekliyor olarak kaldı.' },
};

export default function PaymentsPage() {
  const { get, set } = useQueryState();
  const q = get('q');
  const filtre = (FILTERS.some((f) => f.id === get('filtre')) ? get('filtre') : 'all') as Filter;
  const sayfa = Math.max(1, Number(get('sayfa')) || 1);
  const { data, error, loading, reload } = useLoad<Paged<AdminPaymentRow> & { paidKurus: number }>(adminUrl.payments({ q, filtre, sayfa }));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function ask(id: string) {
    setBusy(id);
    setMsg(null);
    const r = await reconcilePayment(id);
    setBusy(null);
    if (!r.ok) { setMsg({ kind: 'err', text: r.error }); return; }
    setMsg(RESULT[r.data.result] ?? { kind: 'err', text: `Sonuç: ${r.data.result}` });
    reload();
  }

  return (
    <>
      <Header title="Ödemeler" sub={data ? <>{num(data.total)} kayıt; bu filtrede ödenen toplam <b className="adm-strong-num">{tlKurus(data.paidKurus)}</b></> : undefined} />
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      <Card flush>
        <div className="adm-toolbar">
          <SearchBox value={q} onChange={(v) => set({ q: v, sayfa: null })} placeholder="E-posta ara" label="Ödeme ara" />
          <Chips label="Durum" options={[...FILTERS]} value={filtre} onChange={(v) => set({ filtre: v, sayfa: null })} />
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && (data.rows.length === 0 ? (
          <Empty title="Eşleşen ödeme yok">{q ? `“${q}” için sonuç bulunamadı.` : 'Bu filtrede ödeme yok.'}</Empty>
        ) : (
          <div className={`adm-table-wrap${loading ? ' adm-stale' : ''}`}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Tarih</th>
                  <th scope="col">Öğretmen</th>
                  <th scope="col">Paket</th>
                  <th scope="col" className="num">Sayfa</th>
                  <th scope="col" className="num">Tutar</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Ödeme tarihi</th>
                  <th scope="col"><span className="sr-only">İşlem</span></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{dt(p.createdAt)}</td>
                    <td>{p.userId ? <Link href={`/admin/ogretmenler/${p.userId}`} className="adm-link">{p.email ?? 'Öğretmen'}</Link> : <span className="adm-muted">Silinmiş hesap</span>}</td>
                    <td className="strong">{packLabel(p.pack)}</td>
                    <td className="num">{num(p.pages)}</td>
                    <td className="num strong">{tlKurus(p.amountKurus)}</td>
                    <td><StateBadge map={PAY_STATUS} value={p.status} /></td>
                    <td className="nowrap">{p.paidAt ? dt(p.paidAt) : <span className="adm-muted">—</span>}</td>
                    <td className="right">
                      {p.status === 'pending' && p.hasToken && (
                        <button type="button" className="adm-btn sm" disabled={busy !== null} onClick={() => ask(p.id)}>
                          {busy === p.id ? 'Soruluyor…' : "iyzico'ya sor"}
                        </button>
                      )}
                    </td>
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
