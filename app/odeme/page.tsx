import type { Metadata } from 'next';
import OrderStep from '@/components/OrderStep';
import OrderNo from '@/components/OrderNo';
import Tracker from '@/components/Tracker';
import { StepHeader, SiteFooter } from '@/components/Chrome';

export const metadata: Metadata = {
  title: 'Siparişinizi oluşturun — SınavOku',
  robots: { index: false },
};

export default function Page() {
  return (
    <>
      <Tracker page="odeme" />
      <StepHeader current={5} />
      <OrderStep />
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
