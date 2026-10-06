import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo, SiteFooter } from './Chrome';

// The frame of the legal texts: header, title, draft date, the notice that
// the text is a draft, the sections, the contact line and the footer.
export default function LegalPage({ title, updated, notice, children }: {
  title: string; updated: string; notice: ReactNode; children: ReactNode;
}) {
  return <>
    <header className="site-head">
      <div className="wrap">
        <Logo />
        <Link href="/" className="head-login">Ana sayfaya dönün</Link>
      </div>
    </header>
    <main className="legal-main">
      <article className="wrap legal-copy">
        <header className="legal-head">
          <h1>{title}</h1>
          <p className="legal-date">Taslak metin. Son güncelleme: {updated}</p>
          <div className="notice legal-notice"><p>{notice}</p></div>
        </header>
        {children}
      </article>
    </main>
    <SiteFooter />
  </>;
}

export const Contact = () => <p className="legal-contact">İletişim: <a href="mailto:admin@zakrom.com">admin@zakrom.com</a></p>;
