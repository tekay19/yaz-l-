'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Api, JobView } from './api';
import DraftJob from './DraftJob';
import ReviewCard from './ReviewCard';

// the worker still owns the job in these states: keep polling until it settles
const ACTIVE = new Set(['queued', 'processing', 'delivering']);

const STATUS: Record<string, string> = {
  draft: 'Taslak: fotoğraf yükleniyor',
  queued: 'Sırada',
  processing: 'Okunuyor',
  review: 'Kontrolünüzü bekliyor',
  delivering: 'Rapor hazırlanıyor ve e-postalanıyor',
  done: 'Rapor e-postanıza gönderildi',
  failed: 'Cevap anahtarı okunamadı; hakkınız iade edilir',
};

export default function JobFlow({ api, onBalanceChange }: { api: Api; onBalanceChange: () => void }) {
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [current, setCurrent] = useState<JobView | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    const r = await api.listJobs();
    if (r.ok) setJobs(r.data);
  }, [api]);

  const reload = useCallback(async (id: string) => {
    const r = await api.job(id);
    if (r.ok) setCurrent(r.data);
    else setError(r.error);
    return r.ok ? r.data : null;
  }, [api]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

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

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await api.createJob(title);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTitle('');
    await reload(r.data.id);
    loadJobs();
  }

  function settled() {
    if (!current) return;
    reload(current.id);
    loadJobs();
    onBalanceChange();
  }

  return (
    <>
      <section className="panel-card">
        <h2>Yeni sınav</h2>
        <p className="small muted">Çoktan seçmeli (optik). Klasik sınav, sunucuda KLASIK_ENABLED açılana kadar kapalı.</p>
        <form className="console-row" onSubmit={create}>
          <div className="field console-grow">
            <label htmlFor="console-title">Başlık</label>
            <input id="console-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="9-B Matematik 1. yazılı" />
          </div>
          <button type="submit" className="btn btn-primary btn-sm console-end">Oluştur</button>
        </form>
        {error && <p className="console-banner err">{error}</p>}
      </section>

      {current && (
        <section className="panel-card">
          <div className="console-row between">
            <div>
              <h2>{current.title || 'Adsız sınav'}</h2>
              <p className="tiny muted">{current.id}</p>
            </div>
            <span className="console-status">{STATUS[current.status] ?? current.status}</span>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Anahtar: {current.pages.key} · Öğrenci sayfası: {current.pages.students} · Okunan: {current.pages.read} · Okunamayan: {current.pages.failed}
          </p>
          {current.status === 'draft' && (
            <DraftJob key={current.id} api={api} job={current} onChanged={() => reload(current.id)} onSubmitted={settled} />
          )}
          {current.status === 'review' && <ReviewCard key={current.id} api={api} jobId={current.id} onApproved={settled} />}
          {ACTIVE.has(current.status) && <p className="tiny muted" style={{ marginTop: 10 }}>Durum 5 saniyede bir yenileniyor.</p>}
        </section>
      )}

      <section className="panel-card">
        <div className="console-row between">
          <h2>Sınavlarım</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadJobs}>Yenile</button>
        </div>
        {jobs.length === 0 ? (
          <p className="empty">Henüz sınav yok.</p>
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
                    <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrent(j)}>Aç</button></td>
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
