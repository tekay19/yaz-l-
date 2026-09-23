'use client';

// The waiting list on the capacity screen — the real output of the whole
// funnel, and the only field the product ever stores.

import { useState } from 'react';
import { track } from '@/lib/tracking';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;

    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, source: 'hata-bekleme-listesi' }),
      });
      if (!res.ok) throw new Error('request failed');
      track('waitlist_submit', 'hata');
      setEmail('');
      setStatus({ kind: 'ok', text: 'Kaydınız alındı. Kapasite açıldığında ilk size yazacağız.' });
    } catch {
      setStatus({ kind: 'err', text: 'Gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="bildir-eposta">E-posta adresiniz</label>
        <input
          id="bildir-eposta"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ogretmen@okul.k12.tr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy}>
        {busy ? 'Gönderiliyor…' : 'Beni haberdar edin'}
      </button>
      {status && (
        <p className={`status ${status.kind}`} role="status">
          {status.text}
        </p>
      )}
    </form>
  );
}
