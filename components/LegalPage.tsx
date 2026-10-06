import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo, SiteFooter } from './Chrome';

// The frame of the legal texts: header, title, draft date, the notice that
// the text is a draft, the sections, the contact line and the footer.
export default function LegalPage({ title, updated, notice, children }: {
  title: string; updated: string; notice: ReactNode; children: ReactNode;
}) {
  return <>
    <header className="site-head"><div className="wrap"><Logo /><Link href="/">Ana sayfa</Link></div></header>
    <main><article className="wrap legal-copy">
      <h1>{title}</h1>
      <p className="small muted" style={{ marginTop: 16 }}>Taslak · Son güncelleme: {updated}</p>
      <div className="notice" style={{ marginTop: 20 }}><p>{notice}</p></div>
      {children}
    </article></main>
    <SiteFooter />
  </>;
}

export const Contact = () => <p className="small">İletişim: <a href="mailto:admin@zakrom.com">admin@zakrom.com</a></p>;
