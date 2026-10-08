'use client';

import { useEffect, useRef, useState } from 'react';
import { RosterEditor } from './ui';

// The frame both review screens share. The teacher's job here is to look at
// what the system flagged and approve, so that is what stays in sight: a bar
// with how much is left, a switch between the flagged sheets and all of
// them, and the approve button. The roster is there, folded away.
export function ReviewFrame({
  summary, flagged, total, showAll, onShowAll, approveLabel = 'Onaylayın, raporu gönderin', onApprove, approveDisabled, hint,
  roster, onRoster, onSaveRoster, rosterExtra, bodyClassName = 'review-list', children, after,
}: {
  summary: React.ReactNode; flagged: number; total: number; showAll: boolean; onShowAll: (all: boolean) => void;
  approveLabel?: string; onApprove: () => void; approveDisabled?: boolean; hint?: React.ReactNode;
  roster: string; onRoster: (v: string) => void; onSaveRoster: () => void; rosterExtra?: React.ReactNode;
  // the klasik screen lays its body out as a class list beside one paper
  bodyClassName?: string;
  children: React.ReactNode; after?: React.ReactNode;
}) {
  // what sticks under the bar (the class list, the photos) and where a jump
  // to a question lands follow its real height, which wraps on narrow screens
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const set = () => root.current?.style.setProperty('--review-sticky', `${(parseFloat(getComputedStyle(el).top) || 0) + el.offsetHeight + 12}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="review" ref={root}>
      <div className="review-bar" ref={bar}>
        <div className={`review-bar-text${flagged ? ' attn' : ''}`}>
          <strong>{flagged ? `${flagged} kâğıtta bakmanız gereken yer var` : 'Bakmanız gereken bir yer yok'}</strong>
          <span className="small muted">{summary}</span>
        </div>
        <div className="review-bar-actions">
          <div className="review-switch" role="group" aria-label="Gösterilen kâğıtlar">
            <button type="button" className={!showAll ? 'on' : undefined} aria-pressed={!showAll} onClick={() => onShowAll(false)} disabled={!flagged}>Kontrol edilecekler <span className="review-n">{flagged}</span></button>
            <button type="button" className={showAll ? 'on' : undefined} aria-pressed={showAll} onClick={() => onShowAll(true)}>Tümü <span className="review-n">{total}</span></button>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={approveDisabled} onClick={onApprove}>{approveLabel}</button>
        </div>
        {hint && <p className="review-hint small muted">{hint}</p>}
      </div>

      <details className="review-roster">
        <summary>Sınıf listesi <span className="review-n">{roster.split('\n').filter((l) => l.trim()).length} öğrenci</span></summary>
        <p className="tiny muted">İsimler bu listeyle eşleştirilir. Listeyi düzeltirseniz kâğıtlar yeniden eşleştirilir.</p>
        <RosterEditor value={roster} onChange={onRoster} onSave={onSaveRoster} saveLabel="Listeyi kaydedin ve yeniden eşleştirin" />
        {rosterExtra}
      </details>

      <div className={bodyClassName}>{children}</div>
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

