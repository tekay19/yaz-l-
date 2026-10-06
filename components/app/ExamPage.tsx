'use client';

// One exam: where it stands, and the teacher's part of it — approving the
// rubric, checking the papers — and its results and report files.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ExamResults, JobView } from '@/components/console/api';
import RubricCard from '@/components/console/RubricCard';
import KlasikReviewCard from '@/components/console/KlasikReviewCard';
import ReviewCard from '@/components/console/ReviewCard';
import { useTeacher } from './context';
import { IconAlert, IconCheck, IconClock, IconDownload } from './icons';
import ResultsView from './ResultsView';
import { Badge, Empty, PageHeader, StatusBadge, Tabs, dateTr, isActive, statusOf } from './ui';

type Tab = 'durum' | 'olcutler' | 'kontrol' | 'sonuclar';
const HAS_RESULTS = new Set(['review', 'delivering', 'done']);

// the exam's road, with where it is now
function steps(job: JobView) {
  const klasik = job.mode === 'klasik';
  const phase = { draft: 0, queued: 1, processing: klasik && job.rubricApproved ? 3 : 1, failed: 1, rubric: 2, review: 4, delivering: 5, done: 6 }[job.status] ?? 0;
  const list = [
    { label: 'Yüklendi', from: 1 },
    { label: 'Okundu', from: 2 },
    ...(klasik ? [{ label: 'Ölçütler onaylandı', from: 3 }, { label: 'Puanlandı', from: 4 }] : []),
    { label: 'Kontrol edildi', from: 5 },
    { label: 'Rapor gönderildi', from: 6 },
  ];
  let current = false;
  return list.map((s) => {
    if (phase >= s.from) return { ...s, state: 'done' };
    if (current) return { ...s, state: 'todo' };
    current = true;
    return { ...s, state: job.status === 'failed' ? 'fail' : 'now' };
  });
}

export default function ExamPage({ id }: { id: string }) {
  const { api, refreshMe } = useTeacher();
  const router = useRouter();
  const params = useSearchParams();
  const [job, setJob] = useState<JobView | null | undefined>(undefined);
  const [results, setResults] = useState<ExamResults | null>(null);
  const tab = (params.get('sekme') as Tab) || 'durum';

  const load = useCallback(async () => {
    const r = await api.job(id);
    setJob(r.ok ? r.data : null);
    if (r.ok && r.data.status === 'draft') router.replace(`/yukle?sinav=${id}`);
    if (r.ok && HAS_RESULTS.has(r.data.status)) {
      const res = await api.results(id);
      setResults(res.ok ? res.data : null);
    }
  }, [api, id, router]);
  useEffect(() => { load(); }, [load]);
  const active = job ? isActive(job) : false;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active, load]);

  const setTab = (t: Tab) => router.replace(`/hesap/sinav/${id}${t === 'durum' ? '' : `?sekme=${t}`}`, { scroll: false });
  const settled = () => { load(); refreshMe(); };

  if (job === undefined) return <div className="app-skeleton tall" />;
  if (job === null) {
    return <Empty title="Sınav bulunamadı" action={<Link href="/hesap" className="btn btn-primary">Sınavlarıma dönün</Link>}>Silinmiş ya da başka bir hesaba ait olabilir.</Empty>;
  }

  const klasik = job.mode === 'klasik';
  const meta = statusOf(job.status);
  const tabs: { id: Tab; label: string; badge?: string | null }[] = [
    { id: 'durum', label: 'Genel bakış' },
    ...(klasik ? [{ id: 'olcutler' as Tab, label: 'Puanlama ölçütleri', badge: job.status === 'rubric' ? '!' : null }] : []),
    { id: 'kontrol', label: 'Kontrol', badge: job.status === 'review' ? '!' : null },
    { id: 'sonuclar', label: 'Sonuçlar' },
  ];
  const reports = HAS_RESULTS.has(job.status) && (
    <>
      <a className="btn btn-ghost btn-sm" href={api.reportUrl(id, 'xlsx')}><IconDownload size={16} /> Excel</a>
      <a className="btn btn-ghost btn-sm" href={api.reportUrl(id, 'pdf')}><IconDownload size={16} /> PDF özet</a>
    </>
  );

  let body: React.ReactNode;
  if (tab === 'olcutler' && klasik) {
    body = job.status === 'rubric'
      ? <section className="app-card"><RubricCard api={api} jobId={id} onChanged={settled} /></section>
      : <Empty icon={<IconCheck size={26} />} title={['queued', 'processing'].includes(job.status) ? 'Ölçütler hazırlanıyor' : 'Ölçütler onaylandı'}>
        {['queued', 'processing'].includes(job.status)
          ? 'Cevap anahtarınız okunuyor; puanlama ölçütleri hazır olunca onayınıza sunulacak ve size e-posta gelecek.'
          : 'Kâğıtlar onayladığınız ölçütlerle puanlandı. Kontrol ekranında bir cevabı kabul ederek ölçütlere ekleyebilirsiniz.'}
      </Empty>;
  } else if (tab === 'kontrol') {
    body = job.status === 'review'
      ? (klasik
        ? <KlasikReviewCard api={api} jobId={id} onApproved={settled} />
        : <ReviewCard api={api} jobId={id} onApproved={settled} />)
      : <Empty icon={<IconClock size={26} />} title={job.status === 'done' || job.status === 'delivering' ? 'Kontrol tamamlandı' : 'Henüz kontrol edilecek bir şey yok'}>
        {job.status === 'done' || job.status === 'delivering'
          ? 'Onayladığınız puanlar rapora işlendi.'
          : 'Kâğıtlar okunup puanlanınca, sistemin emin olmadığı yerler burada size gösterilir.'}
      </Empty>;
  } else if (tab === 'sonuclar') {
    body = results
      ? <>
        {!results.final && <p className="console-banner warn">Önizleme: puanlar kontrolünüzü onaylayınca kesinleşir.</p>}
        <ResultsView r={results} />
      </>
      : <Empty icon={<IconClock size={26} />} title="Sonuçlar henüz hazır değil">Kâğıtlar okunup puanlanınca sonuçlar burada görünür.</Empty>;
  } else {
    const total = job.pages.students;
    const doneN = job.pages.read + job.pages.failed;
    body = (
      <div className="app-grid-2 wide-left">
        <section className="app-card">
          <h2>Durum</h2>
          <ol className="app-steps">
            {steps(job).map((s) => (
              <li key={s.label} className={s.state}>
                <span className="dot">{s.state === 'done' ? <IconCheck size={14} /> : null}</span>
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
          {job.status === 'failed' && (
            <p className="console-banner err"><IconAlert size={15} /> Cevap anahtarı okunamadı; kullanılan sayfa hakkı iade edildi. Anahtarı daha net çekip sınavı yeniden yükleyin.</p>
          )}
          {meta.action && meta.tab && job.status !== 'done' && (
            <button type="button" className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setTab(meta.tab as Tab)}>{meta.action}</button>
          )}
        </section>
        <section className="app-card">
          <h2>Kâğıtlar</h2>
          <dl className="app-dl">
            <div><dt>Öğrenci sayfası</dt><dd>{total}</dd></div>
            <div><dt>Okunan</dt><dd>{job.pages.read}</dd></div>
            <div><dt>Okunamayan</dt><dd>{job.pages.failed}{job.pages.failed ? <span className="muted small"> · hakkı iade</span> : null}</dd></div>
            <div><dt>Cevap anahtarı</dt><dd>{job.pages.key ? `${job.pages.key} fotoğraf` : 'yazılı metin'}</dd></div>
          </dl>
          {isActive(job) && total > 0 && (
            <>
              <div className="app-progress big"><span style={{ width: `${Math.round((doneN / total) * 100)}%` }} /></div>
              <p className="tiny muted" style={{ marginTop: 6 }}>{doneN} / {total} sayfa okundu · sayfa kendini yeniliyor</p>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: '/hesap', label: 'Sınavlarım' }}
        title={job.title || 'Adsız sınav'}
        sub={<><Badge tone="grey">{klasik ? 'Klasik' : 'Çoktan seçmeli'}</Badge> <StatusBadge status={job.status} rubricApproved={job.rubricApproved} /> <span className="muted"> · {dateTr(job.createdAt, true)}</span></>}
        actions={reports || undefined}
      />
      <Tabs tabs={tabs} value={tabs.some((t) => t.id === tab) ? tab : 'durum'} onChange={setTab} />
      <div className="app-tab-body">{body}</div>
    </>
  );
}
