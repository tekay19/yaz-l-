'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminUrl, closeJob, type JobDetail as Data } from './api';
import AuditTable from './AuditTable';
import { CLOSABLE, FAIL_REASON, JOB_STATUS, MODE_LABEL, PAGE_STATUS, dt, num } from './format';
import { Badge, Card, Dl, Empty, ErrorBox, Header, Loading, Notice, StatStrip, StateBadge, useLoad } from './ui';

export default function JobDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useLoad<Data>(adminUrl.job(id));

  if (!data) {
    return (
      <>
        <Header title="Sınav" back={{ href: '/admin/sinavlar', label: 'Sınavlar' }} />
        {error ? <ErrorBox error={error} onRetry={reload} /> : loading && <Loading rows={8} />}
      </>
    );
  }
  const j = data.job;
  const students = data.pages.filter((p) => p.kind === 'student');
  const read = students.filter((p) => p.status === 'read').length;
  const failed = data.pages.filter((p) => p.status === 'failed').length;
  const tokIn = data.pages.reduce((n, p) => n + (p.inputTokens ?? 0), 0);
  const tokOut = data.pages.reduce((n, p) => n + (p.outputTokens ?? 0), 0);

  return (
    <>
      <Header
        back={{ href: '/admin/sinavlar', label: 'Sınavlar' }}
        title={j.title || 'Adsız sınav'}
        sub={<>
          <StateBadge map={JOB_STATUS} value={j.status} />
          <Badge>{MODE_LABEL[j.mode] ?? j.mode}</Badge>
          {j.failReason && <Badge tone="red">{FAIL_REASON[j.failReason] ?? j.failReason}</Badge>}
          <Link href={`/admin/ogretmenler/${j.userId}`} className="adm-link">{j.email}</Link>
        </>}
      />
      {error && <ErrorBox error={error} onRetry={reload} />}

      <StatStrip label="Sınav özeti" items={[
        { label: 'Okunan öğrenci sayfası', value: <>{num(read)}<small> / {num(students.length)}</small></>, hint: `${num(j.rosterSize)} öğrencilik liste` },
        { label: 'Okunamayan', value: num(failed), tone: failed ? 'mark' : undefined, hint: failed ? 'sayfa' : 'Tüm sayfalar okundu' },
        { label: 'Ayrılan hak', value: num(j.reservedPages), hint: `${num(data.refunded)} sayfa iade edildi` },
        { label: 'AI token', value: num(tokIn + tokOut), hint: `girdi ${num(tokIn)}, çıktı ${num(tokOut)}` },
      ]} />

      <div className="adm-detail-grid">
        <div className="adm-detail-main">
          <Card title="Sayfalar" flush aside={<span className="adm-muted">Öğrenci cevapları burada gösterilmez</span>}>
            {data.pages.length === 0 ? <Empty title="Sayfa yüklenmemiş" /> : (
              <div className="adm-table-wrap">
                <table className="adm-table compact">
                  <thead>
                    <tr>
                      <th scope="col">Tür</th><th scope="col" className="num">Sıra</th><th scope="col">Durum</th>
                      <th scope="col" className="num">Deneme</th><th scope="col">Hata</th>
                      <th scope="col" className="num">Token girdi</th><th scope="col" className="num">Token çıktı</th>
                      <th scope="col">Fotoğraf</th><th scope="col">Puanlandı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pages.map((p) => (
                      <tr key={p.id}>
                        <td>{p.kind === 'key' ? <Badge tone="violet">Cevap anahtarı</Badge> : 'Öğrenci'}</td>
                        <td className="num">{num(p.seq)}</td>
                        <td><StateBadge map={PAGE_STATUS} value={p.status} /></td>
                        <td className={`num${p.attempts > 1 ? ' adm-amber' : ''}`}>{num(p.attempts)}</td>
                        <td className="adm-err-cell">{p.error ? <span title={p.error}>{p.error}</span> : <span className="adm-muted">—</span>}</td>
                        <td className="num">{p.inputTokens != null ? num(p.inputTokens) : '—'}</td>
                        <td className="num">{p.outputTokens != null ? num(p.outputTokens) : '—'}</td>
                        <td>{p.hasPhoto ? 'Var' : <span className="adm-muted">Silindi</span>}</td>
                        <td>{p.graded ? 'Evet' : <span className="adm-muted">Hayır</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Yönetici işlemleri" flush>
            <AuditTable rows={data.actions} showTarget={false} empty="Bu sınavda yönetici işlemi yok." />
          </Card>
        </div>
        <aside className="adm-detail-side" aria-label="Sınav bilgileri">
          {CLOSABLE.includes(j.status) && <CloseJob id={j.id} reload={reload} />}
          <Card title="Zaman çizelgesi">
            <Dl items={[
              ['Oluşturuldu', dt(j.createdAt)],
              ['Gönderildi', dt(j.submittedAt)],
              ['Ölçüt onayı', dt(j.rubricApprovedAt)],
              ['Otomatik teslim', dt(j.autoDeliveredAt)],
              ['Bitti', dt(j.finishedAt)],
              ['Öğretmene bildirildi', dt(j.notifiedAt)],
            ]} />
          </Card>
        </aside>
      </div>
    </>
  );
}

function CloseJob({ id, reload }: { id: string; reload: () => void }) {
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function go() {
    setBusy(true);
    const r = await closeJob(id, note.trim());
    setBusy(false);
    setAsk(false);
    if (!r.ok) { setMsg({ kind: 'err', text: r.error }); return; }
    setMsg({ kind: 'ok', text: 'Sınav kapatıldı; kullanılmayan sayfalar iade edilecek ve öğretmene bildirilecek.' });
    setNote('');
    reload();
  }

  return (
    <Card title="Sınavı kapat" className="adm-close-card">
      {msg && <Notice kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      <p className="adm-hint">Sınav kapanır, kullanılmayan sayfa hakları öğretmenin bakiyesine döner.</p>
      <label className="adm-field">
        <span>Gerekçe</span>
        <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Öğretmen isteğiyle iptal" />
      </label>
      {!ask ? (
        <button type="button" className="adm-btn" disabled={note.trim().length < 3} onClick={() => setAsk(true)}>Sınavı kapat</button>
      ) : (
        <div className="adm-confirm danger" role="group" aria-label="Kapatmayı onayla">
          <span>Bu işlem geri alınamaz. Kapatılsın mı?</span>
          <div className="adm-confirm-btns">
            <button type="button" className="adm-btn sm danger" onClick={go} disabled={busy} autoFocus>{busy ? 'Kapatılıyor…' : 'Kapat ve iade et'}</button>
            <button type="button" className="adm-btn sm" onClick={() => setAsk(false)} disabled={busy}>Vazgeç</button>
          </div>
        </div>
      )}
    </Card>
  );
}
