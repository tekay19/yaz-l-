import type { ReactNode } from 'react';

// The classroom board the public pages are built around: a green board in a
// wooden frame, with a chalk ledge (two sticks, an eraser) along the bottom.
// The hero, the closing call and the sign-in pages all sit on one.

// Chalk on a board is never a clean vector: the strokes wobble a little and
// the grain of the board shows through. One SVG filter does both; text that
// wants it uses `filter: url(#chalk)` (class .chalk). Rendered once per page.
export function ChalkDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter id="chalk" x="-2%" y="-6%" width="104%" height="112%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="4" result="wobble" />
        <feDisplacementMap in="SourceGraphic" in2="wobble" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="1.35" numOctaves="1" seed="11" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.7" result="holes" />
        <feComposite in="rough" in2="holes" operator="in" />
      </filter>
    </svg>
  );
}

export function Board({ children, className = '', tray = true }: { children: ReactNode; className?: string; tray?: boolean }) {
  return (
    <div className={`board ${className}`}>
      <div className="board-surface">{children}</div>
      {tray && (
        <div className="board-tray" aria-hidden="true">
          <i className="board-chalk" />
          <i className="board-chalk yellow" />
          <i className="board-eraser" />
        </div>
      )}
    </div>
  );
}
