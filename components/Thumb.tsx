'use client';

import { useEffect, useState } from 'react';

/** A local preview of a picked file. The blob URL never leaves the browser. */
export default function Thumb({
  file,
  name,
  onRemove,
}: {
  file?: File;
  name?: string;
  onRemove?: () => void;
}) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const label = file?.name ?? name ?? '';

  return (
    <figure className="thumb-card">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={url} alt="" />
      ) : (
        <span className="thumb-placeholder" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 16l-5-5-6 6" />
          </svg>
        </span>
      )}
      <figcaption title={label}>{label}</figcaption>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`${label} dosyasını çıkar`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </figure>
  );
}
