import type { ReactNode } from 'react';
import { Check } from '../Chrome';

// The header and the signed-out card shared by the admin screens (panel,
// measurement, demo) and the test console.

export function LogoMark() {
  return <span className="logo-mark" aria-hidden="true"><Check /></span>;
}

export function AdminHeader({ badge, children }: { badge: string; children?: ReactNode }) {
  return (
    <header className="panel-head">
      <div className="panel-wrap">
        <a href="/" className="logo">
          <LogoMark />
          SınavOku <span className="panel-badge">{badge}</span>
        </a>
        {children}
      </div>
    </header>
  );
}

// For screens that need the panel session: they send the admin to /panel.
export function AdminSignedOut({ title }: { title: string }) {
  return (
    <div className="panel-login">
      <div className="card panel-login-card">
        <h1>{title}</h1>
        <p className="small muted">Bu sayfa yönetici oturumu ister. Önce panelden giriş yapın, sonra buraya dönün.</p>
        <a href="/panel" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>Panele git</a>
      </div>
    </div>
  );
}
