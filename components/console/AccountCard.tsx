'use client';

import { useState } from 'react';
import { PAID_PACKS, tl } from '@/lib/packs';
import type { Api, Me } from './api';

type Props = { api: Api; me: Me; onChange: () => void; onSignedOut: () => void };

export default function AccountCard({ api, me, onChange, onSignedOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy(pack: string) {
    setBusy(true);
    setError(null);
    const r = await api.checkout(pack);
    if (r.ok) {
      window.location.href = r.data.paymentPageUrl; // iyzico's hosted form; it posts back to /api/pay/callback
      return;
    }
    setBusy(false);
    setError(r.error);
  }

  async function logout() {
    await api.logout();
    onSignedOut();
  }

  async function remove() {
    const sure = window.confirm(
      'Hesabınız, sınavlarınız ve fotoğraflarınız kalıcı olarak silinecek. Ödeme kayıtları yasal süre boyunca, hesabınızla bağı kopartılarak saklanır. Devam edilsin mi?',
    );
    if (!sure) return;
    const r = await api.deleteAccount();
    if (r.ok) onSignedOut();
    else setError(r.error);
  }

  return (
    <section className="panel-card">
      <div className="console-row between">
        <div>
          <h2>Hesap</h2>
          <p className="small muted">{me.email}</p>
        </div>
        <div className="console-balance">
          <span className="k">Sayfa hakkı</span>
          <span className="v">{me.pageBalance}</span>
        </div>
      </div>

      <h3 className="console-sub">Paket satın al (iyzico)</h3>
      <div className="console-row">
        {PAID_PACKS.map((p) => (
          <button key={p.name} type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => buy(p.name)}>
            {p.short}: {p.pages} sayfa, {tl(p.price)}
          </button>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        iyzico&apos;nun güvenli ödeme sayfasına gidersiniz; dönüşte sonuç bu sayfanın üstünde görünür.
      </p>
      {error && <p className="console-banner err">{error}</p>}

      <div className="console-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onChange}>Yenile</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Çıkış</button>
        <button type="button" className="btn btn-ghost btn-sm console-danger" onClick={remove}>Hesabı sil</button>
      </div>
    </section>
  );
}
