'use client';

// Sınavlarım: what waits for the teacher first, then every exam.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import type { JobView } from '@/components/console/api';
import { useToast } from '@/components/Toast';
import { useTeacher } from './context';
import { IconCheck, IconPlus, IconSearch } from './icons';
import { Empty, PageHeader, Stat, StatusBadge, dateTr, examHref, isActive, needsTeacher, num, progressOf, statusOf } from './ui';

type Filter = 'all' | 'waiting' | 'reading' | 'done' | 'draft';
const FILTERS: { id: Filter; label: string; match: (j: JobView) => boolean }[] = [
  { id: 'all', label: 'Tümü', match: () => true },
  { id: 'waiting', label: 'Sizi bekleyen', match: (j) => j.status === 'rubric' || j.status === 'review' },
  { id: 'reading', label: 'Okunuyor', match: isActive },
  { id: 'done', label: 'Tamamlanan', match: (j) => j.status === 'done' },
  { id: 'draft', label: 'Taslak', match: (j) => j.status === 'draft' },
];

export default function ExamsPage() {
  const { api, me, refreshMe } = useTeacher();
  const toast = useToast();
  const [jobs, setJobs] = useState<JobView[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [classCount, setClassCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await api.listJobs();
    if (r.ok) setJobs(r.data);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  // an exam being read or graded cannot go: a worker holds its pages
  const canDelete = (j: JobView) => j.status !== 'queued' && j.status !== 'processing';
  async function remove(j: JobView) {
    if (!window.confirm(`"${j.title || 'Adsız sınav'}" silinsin mi? Fotoğraflar ve sonuçlar kalıcı olarak silinir.`)) return;
    const r = await api.deleteJob(j.id);
    if (!r.ok) { toast(r.error, 'error'); return; }
    setJobs((list) => list && list.filter((x) => x.id !== j.id));
    refreshMe(); // an exam waiting for its key gives its pages back
    toast('Sınav silindi.', 'success');
  }
  useEffect(() => { api.classes().then((r) => setClassCount(r.ok ? r.data.length : 0)); }, [api]);
  // exams being read move on their own: keep the list fresh while any is
  const reading = jobs?.some(isActive) ?? false;
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [reading, load]);

  const waiting = useMemo(() => (jobs ?? []).filter((j) => j.status === 'rubric' || j.status === 'review'), [jobs]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    const needle = q.trim().toLocaleLowerCase('tr');
    return (jobs ?? []).filter((j) => f.match(j) && (!needle || (j.title || 'Adsız sınav').toLocaleLowerCase('tr').includes(needle)));
  }, [jobs, filter, q]);
  const thisMonth = useMemo(() => {
    const now = new Date();
    return (jobs ?? []).filter((j) => j.status !== 'draft' && new Date(j.createdAt).getMonth() === now.getMonth() && new Date(j.createdAt).getFullYear() === now.getFullYear())
      .reduce((s, j) => s + j.pages.students, 0);
  }, [jobs]);

  return (
    <>
      <PageHeader
        title="Sınavlarım"
        sub="Yüklediğiniz sınavlar, okuma durumu ve sonuçları."
        actions={<Link href="/yukle" className="btn btn-primary app-hide-wide"><IconPlus size={17} /> Yeni sınav</Link>}
      />

      <div className="app-stats">
        <Stat label="Sayfa hakkınız" value={num(me.pageBalance)} hint={<Link href="/hesap/paket">Paket alın</Link>} />
        <Stat label="Sizi bekleyen" value={waiting.length} tone={waiting.length ? 'attention' : undefined} hint={waiting.length ? 'onay ya da kontrol' : 'şu an yok'} />
        <Stat label="Bu ay okunan sayfa" value={num(thisMonth)} />
        <Stat label="Tamamlanan sınav" value={(jobs ?? []).filter((j) => j.status === 'done').length} tone="good" />
      </div>

      {waiting.length > 0 && (
        <section className="app-card app-todo" aria-labelledby="todo-h">
          <h2 id="todo-h">Sizi bekleyenler <span className="app-pen-count" aria-label={`${waiting.length} sınav`}>{waiting.length}</span></h2>
          <ul>
            {waiting.map((j) => (
              <li key={j.id}>
                <div className="app-todo-text">
                  <Link href={examHref(j)} className="app-row-title">{j.title || 'Adsız sınav'}</Link>
                  <span className="app-meta">
                    <span>{statusOf(j.status).label}</span>
                    <span>{j.pages.students} sayfa</span>
                    <span>{dateTr(j.createdAt)}</span>
                  </span>
                </div>
                <Link href={examHref(j)} className="btn btn-sm btn-primary">{statusOf(j.status).action}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {jobs?.length === 0 && (
        <Onboarding steps={[
            { done: (classCount ?? 0) > 0, title: 'Sınıf listenizi kaydedin', text: 'İsimler kâğıtlarla bu listeye göre eşleşir; her sınavda yeniden yapıştırmazsınız.', href: '/hesap/siniflar', cta: 'Sınıf ekleyin' },
            { done: me.pageBalance > 0, title: 'Sayfa hakkı alın', text: 'Her öğrenci sayfası bir sayfa. Sınavı gönderirken de alabilirsiniz.', href: '/hesap/paket', cta: 'Paketlere bakın' },
            { done: false, title: 'İlk sınavınızı yükleyin', text: 'Cevap anahtarını ve kâğıtların fotoğraflarını ekleyin; okunup puanlanır.', href: '/yukle', cta: 'Sınav yükleyin' },
          ]} />
      )}

      {jobs?.length !== 0 && (
      <section className="app-card app-flush">
        <div className="app-toolbar">
          <div className="app-chips" role="group" aria-label="Sınavları süzün">
            {FILTERS.map((f) => {
              const n = (jobs ?? []).filter(f.match).length;
              return (
                <button key={f.id} type="button" className={filter === f.id ? 'on' : undefined} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}{f.id !== 'all' && n ? <span>{n}</span> : null}
                </button>
              );
            })}
          </div>
          <label className="app-search">
            <IconSearch size={16} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sınav adıyla arayın" aria-label="Sınav adıyla arayın" />
          </label>
        </div>

        {jobs === null ? (
          <div className="app-skeleton" />
        ) : shown.length === 0 ? (
          <Empty title="Bu süzgeçte sınav yok">Başka bir süzgeç seçin ya da aramayı temizleyin.</Empty>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table t-exams">
              <thead>
                <tr><th>Sınav</th><th>Durum</th><th className="num">Sayfa</th><th>Tarih</th><th aria-label="İşlem" /></tr>
              </thead>
              <tbody>
                {shown.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link href={examHref(j)} className="app-row-title">{j.title || 'Adsız sınav'}</Link>
                      <div className="app-row-sub">{j.mode === 'klasik' ? 'Klasik' : 'Çoktan seçmeli'}</div>
                    </td>
                    <td>
                      <StatusBadge status={j.status} rubricApproved={j.rubricApproved} />
                      {isActive(j) && (() => {
                        const p = progressOf(j);
                        return p.total > 0 && (
                          <div className="app-progress" role="progressbar" aria-label={p.label} aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} title={`${p.done} / ${p.total} sayfa ${p.verb}`}>
                            <span style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} />
                          </div>
                        );
                      })()}
                    </td>
                    <td className="num">
                      {j.pages.students}
                      {j.pages.failed ? <div className="app-row-sub app-attn">{j.pages.failed} okunamadı</div> : null}
                    </td>
                    <td className="app-date">{dateTr(j.createdAt)}</td>
                    <td className="right">
                      <div className="app-row-actions">
                        <Link href={examHref(j)} className={`btn btn-sm ${needsTeacher(j) ? 'btn-primary' : 'btn-ghost'}`}>
                          {statusOf(j.status).action ?? 'Aç'}
                        </Link>
                        {canDelete(j) && (
                          <button type="button" className="btn btn-ghost btn-sm app-row-delete" onClick={() => remove(j)}
                            aria-label={`${j.title || 'Adsız sınav'} sınavını sil`}>Sil</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}
    </>
  );
}

// A new teacher's first screen: what to do, in order, with what is done ticked.
function Onboarding({ steps }: { steps: { done: boolean; title: string; text: string; href: string; cta: string }[] }) {
  const next = steps.findIndex((s) => !s.done);
  return (
    <Board className="app-onboard">
      <h2 className="chalk">Hoş geldiniz.</h2>
      <p className="app-onboard-sub">Üç adımda ilk sınıfınızın sonuçları hazır.</p>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'done' : i === next ? 'next' : undefined}>
            <span className="n" aria-hidden={s.done || undefined}>{s.done ? <IconCheck size={15} /> : i + 1}</span>
            <div>
              <strong>{s.done && <span className="sr-only">Tamamlandı: </span>}{s.title}</strong>
              <p>{s.text}</p>
            </div>
            {!s.done && <Link href={s.href} className={`btn btn-sm ${i === next ? 'lp-chalk-btn' : 'lp-chalk-ghost'}`}>{s.cta}</Link>}
          </li>
        ))}
      </ol>
    </Board>
  );
}
