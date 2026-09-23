'use client';

// One screen per decision. Each step renders inside this shell, which owns
// the heading, the back/forward controls and the order sidebar — so every
// page of the wizard looks and behaves the same and nothing hides below the
// fold.

import Link from 'next/link';
import PriceTag from './PriceTag';
import { usePlan } from '@/lib/usePlan';
import { hasKey, hasPapers, useUpload } from '@/lib/useUpload';

export const WIZARD_STEPS = [
  { n: 1, label: 'Paket', href: '/paket' },
  { n: 2, label: 'Cevap anahtarı', href: '/yukle' },
  { n: 3, label: 'Kâğıtlar', href: '/kagitlar' },
  { n: 4, label: 'Özet', href: '/ozet' },
  { n: 5, label: 'Ödeme', href: '/odeme' },
] as const;

type Props = {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  lead: string;
  children: React.ReactNode;
  back?: { href: string; label: string };
  onNext?: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
};

export default function WizardShell({
  step,
  title,
  lead,
  children,
  back,
  onNext,
  nextLabel,
  nextDisabled,
}: Props) {
  const [plan] = usePlan();
  const { upload } = useUpload();

  return (
    <main className="wizard">
      <div className="wrap">
        <p className="wizard-count">
          Adım {step} / {WIZARD_STEPS.length}
        </p>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>

        <div className="wizard-grid">
          <div className="wizard-body">{children}</div>

          <aside className="card summary wizard-aside">
            <h2>Siparişiniz</h2>

            <div className="sum-row">
              <span className="k">Paket</span>
              <span className="v">{plan.short}</span>
            </div>
            <div className="sum-row">
              <span className="k">Sayfa hakkı</span>
              <span className="v">{plan.pages} sayfa</span>
            </div>
            <div className="sum-row">
              <span className="k">Cevap anahtarı</span>
              <span className={`v${hasKey(upload) ? '' : ' missing'}`}>
                {hasKey(upload) ? 'Yüklendi' : 'Bekliyor'}
              </span>
            </div>
            <div className="sum-row">
              <span className="k">Öğrenci kâğıdı</span>
              <span className={`v${hasPapers(upload) ? '' : ' missing'}`}>
                {hasPapers(upload) ? upload.count : 'Bekliyor'}
              </span>
            </div>
            <div className="sum-total">
              <span className="k">Tutar</span>
              <span className="v">
                <PriceTag pack={plan} size="sm" />
              </span>
            </div>

            {onNext && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginTop: 22 }}
                onClick={onNext}
                disabled={nextDisabled}
              >
                {nextLabel}
              </button>
            )}

            <p className="trust-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Bu adımda ödeme alınmaz
            </p>
          </aside>
        </div>

        <p className="wizard-back">
          <Link href={back?.href ?? '/'} className="back-link">
            ← {back?.label ?? 'Ana sayfaya dönün'}
          </Link>
        </p>
      </div>
    </main>
  );
}
