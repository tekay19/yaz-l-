'use client';

// Drop <Tracker page="index" /> into a page and it logs the view, scroll
// depth, CTA clicks and time on page. One instance per page.

import { useEffect } from 'react';
import { flush, track } from '@/lib/tracking';

export default function Tracker({ page }: { page: string }) {
  useEffect(() => {
    const started = Date.now();
    track('page_view', page, document.title.slice(0, 64));
    if (page === 'hata') track('error_view', page);

    // scroll depth — one event per threshold, per page
    const marks = [25, 50, 75, 100];
    const hit = new Set<number>();
    let ticking = false;

    const measure = () => {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      for (const m of marks) {
        if (pct >= m && !hit.has(m)) {
          hit.add(m);
          track('scroll_depth', page, '', m);
        }
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(measure);
      }
    };

    // every primary button / link that moves someone down the funnel
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.('a.btn, button.btn, [data-track]') as HTMLElement | null;
      if (!el) return;
      if (el.hasAttribute('data-pack-btn')) return; // logged separately, with the pack name
      const label = (el.dataset.track || el.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 64);
      track('cta_click', page, label);
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        track('exit', page, '', Math.round((Date.now() - started) / 1000));
        flush(true);
      }
    };
    const onPageHide = () => flush(true);

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    measure();

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      flush(true);
    };
  }, [page]);

  return null;
}
