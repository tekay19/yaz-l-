import type { Metadata } from 'next';
import Summary from '@/components/Summary';
import Tracker from '@/components/Tracker';
import OrderNo from '@/components/OrderNo';
import { StepHeader, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = {
  title: 'Siparişinizi gözden geçirin — SınavOku',
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <Tracker page="ozet" />
      <StepHeader current={4} />
      <Summary />
      <SiteFooter
        left={
          <span className="small muted">
            Sipariş no <OrderNo />
          </span>
        }
      />
    </>
  );
}
