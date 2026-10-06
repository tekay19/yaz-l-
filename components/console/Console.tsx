'use client';

// The backend test panel at /hesap. A teacher signs in with the e-mailed
// link, buys pages through iyzico, uploads and submits an exam, follows it
// through the worker and, when it lands in review, corrects and approves it.
// It reaches the backend only through ./api, exactly as a real front end would;
// the backend already sends people here after login and after payment.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApi, type Me } from './api';
import LoginForm from './LoginForm';
import AccountCard from './AccountCard';
import JobFlow from './JobFlow';
import { AdminHeader } from '@/components/admin/AdminShell';

export default function Console({ loginError, payment }: { loginError: boolean; payment: 'ok' | 'hata' | null }) {
  const api = useMemo(() => createApi(), []);
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined while loading

  const refreshMe = useCallback(async () => {
    const r = await api.me();
    setMe(r.ok ? r.data : null);
  }, [api]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  return (
    <div className="panel-page console">
      <AdminHeader badge="test paneli">
          {me && <span className="small muted">{me.email}</span>}
        </AdminHeader>

      <main className="panel-wrap panel-main">
        <p className="panel-note">
          Bu sayfa yeni backend&apos;i uçtan uca denemek içindir; siteden bağlantı verilmez. Asıl ön yüz ayrı bir planla yapılacak.
        </p>
        {payment === 'ok' && <p className="console-banner ok">Ödeme alındı; sayfa hakkı hesabınıza eklendi.</p>}
        {payment === 'hata' && <p className="console-banner err">Ödeme tamamlanamadı; sayfa hakkı eklenmedi.</p>}

        {me === undefined && <p className="empty">Yükleniyor…</p>}
        {me === null && <LoginForm api={api} linkFailed={loginError} />}
        {me && (
          <>
            <AccountCard api={api} me={me} onChange={refreshMe} onSignedOut={() => setMe(null)} />
            <JobFlow api={api} klasik={me.klasik} onBalanceChange={refreshMe} />
          </>
        )}
      </main>
    </div>
  );
}
