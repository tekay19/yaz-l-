'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Api, JobView } from './api';
import ReviewCard from './ReviewCard';
import RubricCard from './RubricCard';
import KlasikReviewCard from './KlasikReviewCard';

// the worker still owns the job in these states: keep polling until it settles
const ACTIVE = new Set(['queued', 'processing', 'delivering']);

const STATUS: Record<string, string> = {
  draft: 'Taslak: gönderilmedi',
  queued: 'Sırada',
  processing: 'Okunuyor',
  rubric: 'Puanlama ölçütleri onayınızı bekliyor',
  review: 'Kontrolünüzü bekliyor',
  delivering: 'Rapor hazırlanıyor ve e-postalanıyor',
  done: 'Rapor e-postanıza gönderildi',
  failed: 'Cevap anahtarı okunamadı; hakkınız iade edilir',
};

export default function JobFlow({ api, open, onBalanceChange }: { api: Api; open: string | null; onBalanceChange: () => void }) {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [current, setCurrent] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // a poll still in flight when the teacher opens another job must not
  // bring the old one back on screen
  const openId = useRef<string | null>(null);

  const loadJobs = useCallback(async () => {
    const r = await api.listJobs();
    if (r.ok) setJobs(r.data);
  }, [api]);

  const reload = useCallback(async (id: string) => {
    openId.current = id;
    const r = await api.job(id);
    if (openId.current !== id) return null;
    if (r.ok) setCurrent(r.data);
    else setError(r.error);
    return r.ok ? r.data : null;
  }, [api]);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  // /hesap?sinav=<id>: the exam the wizard just submitted
  useEffect(() => { if (open) reload(open); }, [open, reload]);

  const id = current?.id;
  const status = current?.status;
  useEffect(() => {
    if (!id || !status || !ACTIVE.has(status)) return;
    const timer = setInterval(async () => {
      const job = await reload(id);
      if (job && !ACTIVE.has(job.status)) {
        loadJobs();
        onBalanceChange();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [id, status, reload, loadJobs, onBalanceChange]);

  function settled() {
    if (!current) return;
    reload(current.id);
    loadJobs();
    onBalanceChange();
  }

  return (
    <>
      {error && <p className="console-banner err">{error}</p>}

      {current && (
        <section className="panel-card">
          <div className="console-row between">
            <div>
              <h2>{current.title || 'Adsız sınav'}</h2>
              <p className="tiny muted">{current.mode === 'klasik' ? 'Klasik' : 'Çoktan seçmeli'}</p>
            </div>
            <span className="console-status">{STATUS[current.status] ?? current.status}</span>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Anahtar: {current.pages.key} · Öğrenci sayfası: {current.pages.students} · Okunan: {current.pages.read} · Okunamayan: {current.pages.failed}
          </p>
          {current.status === 'draft' && (
            <Link href={`/yukle?sinav=${current.id}`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Yüklemeye devam edin</Link>
          )}
          {current.status === 'rubric' && <RubricCard key={current.id} api={api} jobId={current.id} onChanged={settled} />}
          {current.status === 'review' && current.mode === 'klasik' && <KlasikReviewCard key={current.id} api={api} jobId={current.id} onApproved={settled} />}
          {current.status === 'review' && current.mode !== 'klasik' && <ReviewCard key={current.id} api={api} jobId={current.id} onApproved={settled} />}
          {ACTIVE.has(current.status) && <p className="tiny muted" style={{ marginTop: 10 }}>Durum 5 saniyede bir yenileniyor.</p>}
        </section>
      )}

      <section className="panel-card">
        <div className="console-row between">
          <h2>Sınavlarım</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadJobs}>Yenile</button>
        </div>
        {jobs.length === 0 ? (
          <p className="empty">Henüz sınav yok. <Link href="/yukle">İlk sınavınızı yükleyin</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table className="panel-table">
              <thead>
                <tr><th>Oluşturma</th><th>Başlık</th><th>Durum</th><th>Sayfa (okunan / okunamayan)</th><th /></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{new Date(j.createdAt).toLocaleString('tr-TR')}</td>
                    <td>{j.title || 'Adsız sınav'}</td>
                    <td>{STATUS[j.status] ?? j.status}</td>
                    <td>{j.pages.students} ({j.pages.read} / {j.pages.failed})</td>
                    <td>
                      {j.status === 'draft'
                        ? <Link href={`/yukle?sinav=${j.id}`} className="btn btn-ghost btn-sm">Devam edin</Link>
                        : <button type="button" className="btn btn-ghost btn-sm" onClick={() => reload(j.id)}>Aç</button>}
                    </td>
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
