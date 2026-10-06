'use client';

import { useState } from 'react';
import { RosterEditor } from './ui';

// The frame both review screens share. The teacher's job here is to look at
// what the system flagged and approve, so that is what stays in sight: a bar
// with how much is left, a switch between the flagged sheets and all of
// them, and the approve button. The roster is there, folded away.
export function ReviewFrame({
  summary, flagged, total, showAll, onShowAll, approveLabel = 'Onaylayın, raporu gönderin', onApprove, approveDisabled, hint,
  roster, onRoster, onSaveRoster, children, after,
}: {
  summary: React.ReactNode; flagged: number; total: number; showAll: boolean; onShowAll: (all: boolean) => void;
  approveLabel?: string; onApprove: () => void; approveDisabled?: boolean; hint?: React.ReactNode;
  roster: string; onRoster: (v: string) => void; onSaveRoster: () => void;
  children: React.ReactNode; after?: React.ReactNode;
}) {
  return (
    <div className="review">
      <div className="review-bar">
        <div className="review-bar-text">
          <strong>{flagged ? `${flagged} kâğıtta bakmanız gereken yer var` : 'Bakmanız gereken bir yer yok'}</strong>
          <span className="small muted">{summary}</span>
        </div>
        <div className="review-bar-actions">
          <div className="review-switch" role="group" aria-label="Gösterilen kâğıtlar">
            <button type="button" className={!showAll ? 'on' : undefined} onClick={() => onShowAll(false)} disabled={!flagged}>Kontrol edilecekler · {flagged}</button>
            <button type="button" className={showAll ? 'on' : undefined} onClick={() => onShowAll(true)}>Tümü · {total}</button>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={approveDisabled} onClick={onApprove}>{approveLabel}</button>
        </div>
        {hint && <p className="review-hint small muted">{hint}</p>}
      </div>

      <details className="review-roster">
        <summary>Sınıf listesi · {roster.split('\n').filter((l) => l.trim()).length} öğrenci</summary>
        <p className="tiny muted">İsimler bu listeyle eşleştirilir. Listeyi düzeltirseniz kâğıtlar yeniden eşleştirilir.</p>
        <RosterEditor value={roster} onChange={onRoster} onSave={onSaveRoster} saveLabel="Listeyi kaydedin ve yeniden eşleştirin" />
      </details>

      <div className="review-list">{children}</div>
      {after}
    </div>
  );
}

// A page photo, or a quiet placeholder once it has been deleted (photos go
// after 7 days; the review can outlive them).
export function ReviewPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return <span className={`review-photo-gone ${className ?? ''}`}>Fotoğraf silinmiş</span>;
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Büyük açın">
      {/* eslint-disable-next-line @next/next/no-img-element -- the owner's own page photo */}
      <img className={className} src={src} alt={alt} onError={() => setGone(true)} loading="lazy" />
    </a>
  );
}

