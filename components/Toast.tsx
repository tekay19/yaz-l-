'use client';

// Top-right notifications. Errors in the wizard used to print inline, far
// from where the visitor was looking; a toast lands in the corner, announces
// itself to screen readers, and clears itself.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type Kind = 'error' | 'success';
type Toast = { id: number; kind: Kind; text: string };

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const LIFETIME = 5000;

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (text: string, kind: Kind = 'error') => {
      const id = nextId.current++;
      // the same message twice in a row is one problem, not two
      setToasts((list) => [...list.filter((t) => t.text !== text), { id, kind, text }].slice(-3));
      timers.current.push(setTimeout(() => dismiss(id), LIFETIME));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-ico" aria-hidden="true">
              {t.kind === 'error' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            <p>{t.text}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Bildirimi kapat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
