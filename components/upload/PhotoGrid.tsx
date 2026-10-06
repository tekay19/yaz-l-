'use client';

import type { Draft } from '@/components/console/api';
import type { Kind, Pending } from './usePhotos';

// The photos of one kind: those the server took, in order, then those on
// their way up or refused, each with what happened to it.
export default function PhotoGrid({ jobId, kind, pages, pending, onRemove, onDismiss }: {
  jobId: string; kind: Kind; pages: Draft['pages']; pending: Pending[];
  onRemove: (pageId: string) => void; onDismiss: (item: Pending) => void;
}) {
  const label = kind === 'key' ? 'Anahtar' : 'Sayfa';
  return (
    <div className="thumb-grid">
      {pages.filter((p) => p.kind === kind).map((p, i) => (
        <figure key={p.id} className="thumb-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- the owner's own page photo */}
          <img src={`/api/jobs/${jobId}/pages/${p.id}`} alt="" loading="lazy" />
          <figcaption><b>{label} {i + 1}</b> uygun</figcaption>
          <button type="button" onClick={() => onRemove(p.id)} aria-label={`${label} ${i + 1} fotoğrafını çıkarın`}>×</button>
        </figure>
      ))}
      {pending.filter((p) => p.kind === kind).map((p) => (
        <figure key={p.key} className={`thumb-card${p.error ? ' bad' : ' wait'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
          <img src={p.url} alt="" />
          <figcaption title={p.error ?? p.name}>{p.error ?? 'kontrol ediliyor…'}</figcaption>
          {p.error && <button type="button" onClick={() => onDismiss(p)} aria-label="Hatalı fotoğrafı kaldırın">×</button>}
        </figure>
      ))}
    </div>
  );
}

export function PhotoTips() {
  return (
    <ul className="photo-tips small">
      <li>Kâğıt ekranı doldursun: yakından, tepeden ve düz çekin.</li>
      <li>Gün ışığında ya da iyi aydınlatılmış yerde, gölge düşürmeden.</li>
      <li>Telefonun kendi kamerasını kullanın; WhatsApp&apos;tan gelen fotoğraflar küçülmüş olur.</li>
    </ul>
  );
}
