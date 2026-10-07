'use client';

// Paket ve ödemeler: the balance, buying pages, and where they went.

import { useEffect, useState } from 'react';
import type { HistoryEntry } from '@/components/console/api';
import PackageOptions from '@/components/PackageOptions';
import { useToast } from '@/components/Toast';
import type { PackName } from '@/lib/packs';
import { useTeacher } from './context';
import { Badge, Empty, PageHeader, Stat, dateTr, num } from './ui';

const KIND: Record<HistoryEntry['kind'], { label: string; tone: 'green' | 'grey' | 'blue' }> = {
  purchase: { label: 'Satın alma', tone: 'green' },
  admin_grant: { label: 'Tanımlama', tone: 'green' },
  admin_debit: { label: 'Düzeltme', tone: 'grey' },
  job_reserve: { label: 'Sınav', tone: 'grey' },
  job_refund: { label: 'İade', tone: 'blue' },
};

export default function BillingPage() {
  const { api, me } = useTeacher();
  const toast = useToast();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.history().then((r) => setHistory(r.ok ? r.data : [])); }, [api]);

  async function buy(name: PackName) {
    setBusy(true);
    const r = await api.checkout(name);
    if (!r.ok) { setBusy(false); toast(r.error, 'error'); return; }
    window.location.href = r.data.paymentPageUrl;
  }

  const used = (history ?? []).filter((h) => h.kind === 'job_reserve').reduce((s, h) => s - h.delta, 0)
    - (history ?? []).filter((h) => h.kind === 'job_refund').reduce((s, h) => s + h.delta, 0);
  const spent = (history ?? []).reduce((s, h) => s + (h.amountKurus ?? 0), 0);

  return (
    <>
      <PageHeader title="Paket ve ödemeler" sub="Sayfa hakkınız her okunan öğrenci sayfası için bir azalır; okunamayan sayfaların hakkı iade edilir." />
      <div className="app-stats">
        <Stat label="Kalan sayfa hakkı" value={num(me.pageBalance)} tone={me.pageBalance < 30 ? 'warn' : undefined} hint={me.pageBalance < 30 ? 'azaldı' : 'sayfa dolana kadar geçerli'} />
        <Stat label="Kullanılan sayfa" value={num(Math.max(0, used))} hint="iadeler düşülmüş" />
        <Stat label="Toplam ödeme" value={`${num(spent / 100, 2)} TL`} />
      </div>

      <section className="app-card">
        <h2>Sayfa hakkı alın</h2>
        <p className="app-section-sub">iyzico&apos;nun güvenli ödeme sayfasına gidersiniz; ödeme sonrası bu sayfaya dönersiniz. Sayfalar dolana kadar geçerlidir, abonelik yoktur.</p>
        <div className={busy ? 'app-busy' : undefined}>
          <PackageOptions onSelect={buy} />
        </div>
      </section>

      <section className="app-card app-flush">
        <div className="app-toolbar"><h2>Hareketler</h2></div>
        {history === null ? <div className="app-skeleton" /> : history.length === 0 ? (
          <Empty title="Henüz hareket yok">Paket aldığınızda ve sınav gönderdiğinizde burada görünür.</Empty>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th><th className="num">Tutar</th><th className="num">Sayfa</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="app-date">{dateTr(h.at, true)}</td>
                    <td><Badge tone={KIND[h.kind].tone}>{KIND[h.kind].label}</Badge></td>
                    <td>{h.label}</td>
                    <td className="num">{h.amountKurus ? `${num(h.amountKurus / 100, 2)} TL` : '—'}</td>
                    <td className={`num strong ${h.delta > 0 ? 'plus' : ''}`}>{h.delta > 0 ? '+' : ''}{num(h.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
