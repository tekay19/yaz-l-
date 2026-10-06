'use client';

// The teacher's account at /hesap. A teacher signs in with the e-mailed link,
// buys pages through iyzico, follows each exam through the worker and, when
// it waits for them, approves its rubric and checks its grades. New exams
// are uploaded in the wizard at /yukle; sign-in and payment come back here
// first, and a wizard that sent the teacher away is reopened where it was.
// It reaches the backend only through ./api.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createApi, type Me } from './api';
import LoginForm from './LoginForm';
import AccountCard from './AccountCard';
import JobFlow from './JobFlow';
import { AdminHeader } from '@/components/admin/AdminShell';
import { takeReturn } from '@/lib/client/resume';

export default function Console({ loginError, payment, open }: { loginError: boolean; payment: 'ok' | 'hata' | null; open: string | null }) {
  const api = useMemo(() => createApi(), []);
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined while loading

  const refreshMe = useCallback(async () => {
    const r = await api.me();
    setMe(r.ok ? r.data : null);
  }, [api]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  // back from the sign-in link or the payment page to the wizard that sent us
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!me) return;
    const back = takeReturn();
    if (!back) return;
    setLeaving(true);
    window.location.replace(payment ? `${back}${back.includes('?') ? '&' : '?'}odeme=${payment}` : back);
  }, [me, payment]);

  return (
    <div className="panel-page console">
      <AdminHeader badge="hesabım">
          {me && <span className="small muted">{me.email}</span>}
          {me && <Link href="/yukle" className="btn btn-primary btn-sm">Yeni sınav yükleyin</Link>}
        </AdminHeader>

      <main className="panel-wrap panel-main">
        {payment === 'ok' && <p className="console-banner ok">Ödeme alındı; sayfa hakkı hesabınıza eklendi.</p>}
        {payment === 'hata' && <p className="console-banner err">Ödeme tamamlanamadı; sayfa hakkı eklenmedi.</p>}

        {(me === undefined || leaving) && <p className="empty">Yükleniyor…</p>}
        {me === null && <LoginForm api={api} linkFailed={loginError} />}
        {me && !leaving && (
          <>
            <AccountCard api={api} me={me} onChange={refreshMe} onSignedOut={() => setMe(null)} />
            <JobFlow api={api} open={open} onBalanceChange={refreshMe} />
          </>
        )}
      </main>
    </div>
  );
}
