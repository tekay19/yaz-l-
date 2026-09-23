'use client';

// The order number is generated in the browser and kept for the session, so
// the same reference shows on every step of the wizard.

import { useOrderNo } from '@/lib/useUpload';

export default function OrderNo() {
  return <span className="num">{useOrderNo()}</span>;
}
