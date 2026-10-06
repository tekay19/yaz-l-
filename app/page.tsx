import { SiteFooter, SiteHeader } from '@/components/Chrome';
import Hero from '@/components/landing/Hero';
import { Closing, Details, Faq, KlasikSpotlight, Results, Roles, Steps } from '@/components/landing/Sections';
import Pricing from '@/components/Pricing';
import Tracker from '@/components/Tracker';
import './landing.css';

export default function Home() {
  return (
    <>
      <Tracker page="index" />
      <SiteHeader />
      <main className="lp-main">
        <Hero />
        <Steps />
        <Roles />
        <KlasikSpotlight />
        <Results />
        <Details />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <SiteFooter
        left={<span className="small muted">SınavOku erken erişimde.</span>}
        right={
          <span className="small muted">
            Destek:{' '}
            <a href="mailto:admin@zakrom.com" className="foot-mail">admin@zakrom.com</a>
          </span>
        }
      />
    </>
  );
}
