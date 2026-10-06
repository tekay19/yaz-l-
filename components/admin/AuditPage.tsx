'use client';

import { adminUrl, type AuditRow, type Paged } from './api';
import AuditTable from './AuditTable';
import { num } from './format';
import { Card, ErrorBox, Header, Loading, Pager, useLoad, useQueryState } from './ui';

export default function AuditPage() {
  const { get, set } = useQueryState();
  const sayfa = Math.max(1, Number(get('sayfa')) || 1);
  const { data, error, loading, reload } = useLoad<Paged<AuditRow>>(adminUrl.audit(sayfa));

  return (
    <>
      <Header title="İşlem kaydı" sub={data ? `Yöneticilerin yaptığı ${num(data.total)} işlem, en yenisi üstte.` : undefined} />
      <Card flush>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && loading && <Loading />}
        {data && <div className={loading ? 'adm-stale' : undefined}><AuditTable rows={data.rows} empty="Henüz kayıtlı işlem yok." /></div>}
        {data && data.total > data.size && <Pager page={data.page} size={data.size} total={data.total} onPage={(p) => set({ sayfa: p })} />}
      </Card>
    </>
  );
}
