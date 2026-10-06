'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { adminUrl, userAction, type UserDetail as Data } from './api';
import AuditTable from './AuditTable';
import { FAIL_REASON, JOB_STATUS, LEDGER_REASON, MODE_LABEL, PAY_STATUS, ago, day, dt, num, packLabel, tlKurus } from './format';
import { Card, Confirm, Dl, Empty, ErrorBox, Header, Loading, Notice, StatStrip, StateBadge, Tabs, useLoad } from './ui';
import { UserBadges } from './UsersPage';

type Tab = 'jobs' | 'payments' | 'ledger' | 'actions';

export default function UserDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad<Data>(adminUrl.user(id));
  const [tab, setTab] = useState<Tab>('jobs');

  if (!data) {
    return (
      <>
        <Header title="Öğretmen" back={{ href: '/admin/ogretmenler', label: 'Öğretmenler' }} />
        {error ? <ErrorBox error={error} onRetry={reload} /> : loading && <Loading rows={8} />}
      </>
    );
  }
  const u = data.user;
  const flags = { verified: !!u.emailVerifiedAt, suspended: !!u.suspendedAt, role: u.role, hasPassword: u.hasPassword };

  return (
    <>
      <Header
        back={{ href: '/admin/ogretmenler', label: 'Öğretmenler' }}
        title={u.name || u.email}
        sub={<>{u.name && <a href={`mailto:${u.email}`} className="adm-link">{u.email}</a>}<UserBadges u={flags} /></>}
      />
      {error && <ErrorBox error={error} onRetry={reload} />}

      <StatStrip label="Hesap özeti" items={[
        { label: 'Bakiye', value: num(u.pageBalance), hint: 'sayfa hakkı' },
        { label: 'Ödenen toplam', value: tlKurus(u.paidKurus), hint: `${num(data.payments.filter((p) => p.status === 'paid').length)} ödeme` },
        { label: 'Sınıf', value: num(data.classes), hint: `${num(data.jobs.length)} sınav` },
        { label: 'Kayıt', value: day(u.createdAt), hint: u.lastLoginAt ? <>son giriş {ago(u.lastLoginAt)}</> : 'hiç giriş yapmadı' },
      ]} />

      <div className="adm-detail-grid">
        <div className="adm-detail-main">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'jobs', label: 'Sınavlar', count: data.jobs.length },
              { id: 'payments', label: 'Ödemeler', count: data.payments.length },
              { id: 'ledger', label: 'Bakiye hareketleri', count: data.ledger.length },
              { id: 'actions', label: 'Yönetici işlemleri', count: data.actions.length },
            ]}
          />
          <Card flush>
            {tab === 'jobs' && <JobsTab data={data} />}
            {tab === 'payments' && <PaymentsTab data={data} />}
            {tab === 'ledger' && <LedgerTab data={data} />}
            {tab === 'actions' && <AuditTable rows={data.actions} showTarget={false} empty="Bu öğretmende yönetici işlemi yok." />}
          </Card>
        </div>
        <aside className="adm-detail-side" aria-label="İşlemler">
          <Actions data={data} reload={reload} />
          <Card title="Hesap">
            <Dl items={[
              ['Rol', u.role === 'admin' ? 'Yönetici' : 'Öğretmen'],
              ['E-posta doğrulama', u.emailVerifiedAt ? dt(u.emailVerifiedAt) : 'Doğrulanmadı'],
              ['Şifre', u.hasPassword ? 'Var' : 'Yok (bağlantıyla giriş)'],
              ['Askı', u.suspendedAt ? dt(u.suspendedAt) : 'Yok'],
              ['Son giriş', dt(u.lastLoginAt)],
              ['Kayıt', dt(u.createdAt)],
            ]} />
          </Card>
        </aside>
      </div>
    </>
  );
}

function Actions({ data, reload }: { data: Data; reload: () => void }) {
  const u = data.user;
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, unknown>, ok: string) {
    setMsg(null);
    const r = await userAction(u.id, body);
    if (!r.ok) { setMsg({ kind: 'err', text: r.error }); return false; }
    setMsg({ kind: 'ok', text: ok + (typeof r.data.balance === 'number' ? ` Yeni bakiye: ${num(r.data.balance)} sayfa.` : '') });
    reload();
    return true;
  }

  async function pages(e: FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(amount));
    if (!n || n < 1) { setMsg({ kind: 'err', text: 'Geçerli bir sayfa sayısı girin.' }); return; }
    if (note.trim().length < 3) { setMsg({ kind: 'err', text: 'Gerekçe yazın.' }); return; }
    setBusy(true);
    const done = await run({ action: 'pages', delta: sign * n, note: note.trim() },
      sign > 0 ? `${num(n)} sayfa eklendi.` : `${num(n)} sayfa düşüldü.`);
    setBusy(false);
    if (done) { setAmount(''); setNote(''); }
  }

  return (
    <Card title="İşlemler" className="adm-actions">
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}

      <form className="adm-form" onSubmit={pages}>
        <fieldset>
          <legend>Sayfa hakkı</legend>
          <div className="adm-pages-row">
            <div className="adm-seg" role="radiogroup" aria-label="Yön">
              <button type="button" role="radio" aria-checked={sign === 1} className={sign === 1 ? 'on plus' : undefined} onClick={() => setSign(1)}>Ekle</button>
              <button type="button" role="radio" aria-checked={sign === -1} className={sign === -1 ? 'on minus' : undefined} onClick={() => setSign(-1)}>Düş</button>
            </div>
            <label className="adm-field grow">
              <span className="sr-only">Sayfa sayısı</span>
              <input type="number" inputMode="numeric" min={1} max={100000} step={1} placeholder="Sayfa" required
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          </div>
          <label className="adm-field">
            <span>Gerekçe</span>
            <input type="text" required minLength={3} maxLength={300} placeholder="ör. Okunamayan sayfalar için telafi"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="adm-form-foot">
            <button type="submit" className="adm-btn primary" disabled={busy}>
              {busy ? 'Kaydediliyor…' : sign > 0 ? 'Sayfa ekle' : 'Sayfa düş'}
            </button>
            <p className="adm-hint">Şu an {num(u.pageBalance)} sayfa</p>
          </div>
        </fieldset>
      </form>

      <div className="adm-action-list">
        {!u.emailVerifiedAt && (
          <Confirm label="E-postayı doğrulanmış işaretle" question="E-posta doğrulanmış sayılsın mı?" confirmLabel="Evet, işaretle"
            onConfirm={async () => { await run({ action: 'verify' }, 'E-posta doğrulanmış işaretlendi.'); }} />
        )}
        <Confirm label="Şifre sıfırlama e-postası gönder" question={`${u.email} adresine sıfırlama bağlantısı gönderilsin mi?`} confirmLabel="Gönder"
          onConfirm={async () => { await run({ action: 'reset' }, 'Şifre sıfırlama e-postası gönderildi.'); }} />
        {u.role === 'admin' ? (
          <Confirm label="Yöneticiliği kaldır" question="Yönetici yetkisi kaldırılsın mı? Oturumları kapanır." confirmLabel="Yetkiyi kaldır" danger
            onConfirm={async () => { await run({ action: 'role', role: 'teacher' }, 'Yönetici yetkisi kaldırıldı.'); }} />
        ) : (
          <Confirm label="Yönetici yap" question="Bu hesap yönetim paneline tam erişim alacak. Emin misiniz?" confirmLabel="Yönetici yap"
            onConfirm={async () => { await run({ action: 'role', role: 'admin' }, 'Hesap yönetici yapıldı.'); }} />
        )}
        {u.suspendedAt ? (
          <Confirm label="Askıyı kaldır" question="Hesap yeniden giriş yapabilsin mi?" confirmLabel="Askıyı kaldır"
            onConfirm={async () => { await run({ action: 'unsuspend' }, 'Askı kaldırıldı.'); }} />
        ) : (
          <Confirm label="Askıya al" question="Hesap askıya alınsın mı? Tüm oturumları hemen kapanır." confirmLabel="Askıya al" danger
            onConfirm={async () => { await run({ action: 'suspend' }, 'Hesap askıya alındı.'); }} />
        )}
      </div>
    </Card>
  );
}

function JobsTab({ data }: { data: Data }) {
  if (!data.jobs.length) return <Empty title="Henüz sınav yok" />;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr><th scope="col">Başlık</th><th scope="col">Mod</th><th scope="col">Durum</th><th scope="col" className="num">Ayrılan</th><th scope="col">Tarih</th></tr>
        </thead>
        <tbody>
          {data.jobs.map((j) => (
            <tr key={j.id}>
              <td className="adm-cell-main">
                <Link href={`/admin/sinavlar/${j.id}`} className="adm-row-title">{j.title || 'Adsız sınav'}</Link>
                {j.failReason && <div className="adm-row-sub">{FAIL_REASON[j.failReason] ?? j.failReason}</div>}
              </td>
              <td>{MODE_LABEL[j.mode] ?? j.mode}</td>
              <td><StateBadge map={JOB_STATUS} value={j.status} /></td>
              <td className="num">{num(j.reservedPages)}</td>
              <td className="nowrap">{dt(j.submittedAt ?? j.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTab({ data }: { data: Data }) {
  if (!data.payments.length) return <Empty title="Ödeme yok" />;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr><th scope="col">Paket</th><th scope="col" className="num">Sayfa</th><th scope="col" className="num">Tutar</th><th scope="col">Durum</th><th scope="col">Tarih</th></tr>
        </thead>
        <tbody>
          {data.payments.map((p) => (
            <tr key={p.id}>
              <td className="strong">{packLabel(p.pack)}</td>
              <td className="num">{num(p.pages)}</td>
              <td className="num">{tlKurus(p.amountKurus)}</td>
              <td><StateBadge map={PAY_STATUS} value={p.status} /></td>
              <td className="nowrap">{dt(p.paidAt ?? p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LedgerTab({ data }: { data: Data }) {
  if (!data.ledger.length) return <Empty title="Bakiye hareketi yok" />;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr><th scope="col">Tarih</th><th scope="col">Hareket</th><th scope="col" className="num">Sayfa</th></tr>
        </thead>
        <tbody>
          {data.ledger.map((l) => (
            <tr key={l.id}>
              <td className="nowrap">{dt(l.createdAt)}</td>
              <td>
                {(l.reason === 'job_reserve' || l.reason === 'job_refund') && l.ref && /^[0-9a-f-]{36}/i.test(l.ref)
                  ? <Link href={`/admin/sinavlar/${l.ref.slice(0, 36)}`} className="adm-link">{LEDGER_REASON[l.reason]}</Link>
                  : LEDGER_REASON[l.reason] ?? l.reason}
              </td>
              <td className={`num strong${l.delta > 0 ? ' adm-plus' : ''}`}>{l.delta > 0 ? '+' : '−'}{num(Math.abs(l.delta))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
