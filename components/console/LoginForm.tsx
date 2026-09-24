'use client';

import { useState, type FormEvent } from 'react';
import type { Api } from './api';

type State = { kind: 'idle' | 'busy' | 'sent' } | { kind: 'error'; text: string };

export default function LoginForm({ api, linkFailed }: { api: Api; linkFailed: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: 'busy' });
    const r = await api.login(email);
    setState(r.ok ? { kind: 'sent' } : { kind: 'error', text: r.error });
  }

  return (
    <section className="panel-card console-narrow">
      <h2>Giriş</h2>
      <p className="small muted">
        E-postanıza 15 dakika geçerli bir giriş bağlantısı gelir. Bağlantıyı açıp &quot;Giriş yap&quot;a basınca bu sayfaya dönersiniz.
      </p>
      {linkFailed && <p className="console-banner err">Giriş bağlantısı geçersiz ya da süresi dolmuş. Yeni bağlantı isteyin.</p>}
      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="console-email">E-posta</label>
          <input id="console-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={state.kind === 'busy'}>
          Giriş bağlantısı gönder
        </button>
      </form>
      {state.kind === 'sent' && <p className="console-banner ok">Bağlantı gönderildi. E-postanızı (spam klasörü dahil) kontrol edin.</p>}
      {state.kind === 'error' && <p className="console-banner err">{state.text}</p>}
    </section>
  );
}
