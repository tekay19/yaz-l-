'use client';

// The selected package, shared across the funnel. Kept in sessionStorage so
// a refresh or a step forward never loses it, and re-read on mount so every
// screen quotes the same price.

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PLAN, PACKS, isPackName, type Pack, type PackName } from '@/lib/packs';

const PLAN_KEY = 'sinavoku_plan';

export function readPlanName(): PackName {
  try {
    const v = sessionStorage.getItem(PLAN_KEY);
    return isPackName(v) ? v : DEFAULT_PLAN;
  } catch {
    return DEFAULT_PLAN;
  }
}

export function writePlanName(name: PackName) {
  try {
    sessionStorage.setItem(PLAN_KEY, name);
  } catch {
    /* private mode — the default plan still applies */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sinavoku:plan', { detail: name }));
  }
}

export function usePlan(): [Pack, (name: PackName) => void] {
  // start from the default so server and first client render agree
  const [name, setName] = useState<PackName>(DEFAULT_PLAN);

  useEffect(() => {
    setName(readPlanName());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isPackName(detail)) setName(detail);
    };
    window.addEventListener('sinavoku:plan', onChange);
    return () => window.removeEventListener('sinavoku:plan', onChange);
  }, []);

  const choose = useCallback((next: PackName) => {
    writePlanName(next);
    setName(next);
  }, []);

  return [PACKS[name], choose];
}
