'use client';

import Link from 'next/link';
import type { AuditRow } from './api';
import { ACTION_LABEL, dt, summarizeDetail } from './format';
import { Empty } from './ui';

export function targetHref(r: Pick<AuditRow, 'targetType' | 'targetId'>) {
  if (r.targetType === 'user') return `/admin/ogretmenler/${r.targetId}`;
  if (r.targetType === 'job') return `/admin/sinavlar/${r.targetId}`;
  if (r.targetType === 'payment') return '/admin/odemeler';
  if (r.targetType === 'events') return '/admin/analitik';
  return null;
}
const TARGET: Record<string, string> = { user: 'Öğretmen', job: 'Sınav', payment: 'Ödeme', events: 'Analitik' };

export default function AuditTable({ rows, showTarget = true, empty = 'Henüz işlem yok.' }: { rows: AuditRow[]; showTarget?: boolean; empty?: string }) {
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th scope="col">Tarih</th>
            <th scope="col">İşlem</th>
            <th scope="col">Ayrıntı</th>
            {showTarget && <th scope="col">Hedef</th>}
            <th scope="col">Yönetici</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = targetHref(r);
            return (
              <tr key={r.id}>
                <td className="nowrap">{dt(r.createdAt)}</td>
                <td className="nowrap strong">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="adm-detail">{summarizeDetail(r.action, r.detail) || <span className="adm-muted">—</span>}</td>
                {showTarget && (
                  <td className="nowrap">{href ? <Link href={href} className="adm-link">{TARGET[r.targetType] ?? r.targetType}</Link> : r.targetType}</td>
                )}
                <td className="adm-muted">{r.adminEmail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
