'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { hasRequiredUpload, readUpload } from '@/lib/useUpload';
import Processing from './Processing';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = publishableKey.startsWith('pk_test_') ? loadStripe(publishableKey) : null;

function CardFields() {
  const router = useRouter();
  const elements = useElements();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasRequiredUpload(readUpload())) {
      router.replace('/yukle');
      return;
    }
    if (!elements || busy) return;

    setBusy(true);
    setError('');

    // Stripe validates its iframe-owned fields. The flow intentionally stops
    // here: no PaymentIntent, PaymentMethod, confirmation, charge or hold is
    // created, and the card values never enter application code.
    const { error: validationError } = await elements.submit();
    if (validationError) {
      setError(validationError.message || 'Kart bilgilerini kontrol edin.');
      setBusy(false);
      return;
    }

    setProcessing(true);
  }

  if (processing) return <Processing />;

  return (
    <form onSubmit={submit} noValidate>
      <div className="payment-privacy" role="note">
        <strong>Kart bilgileriniz Stripe&apos;ın güvenli alanında işlenir.</strong>
        <span>
          SınavOku kart numaranızı veya güvenlik kodunuzu göremez ve saklayamaz. Bu adımda ödeme,
          provizyon ya da kart kaydı oluşturulmaz.
        </span>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />

      <button type="submit" className="btn btn-buy btn-block" style={{ marginTop: 20 }} disabled={busy || !elements}>
        {busy ? 'Kontrol ediliyor…' : 'Hemen satın al'}
      </button>

      {error && (
        <p className="status err" role="alert">
          {error}
        </p>
      )}

      <p className="tiny muted" style={{ marginTop: 16 }}>
        <Link href="/kvkk">KVKK Aydınlatma Metni</Link> ·{' '}
        <Link href="/gizlilik">Gizlilik Politikası</Link>
      </p>
    </form>
  );
}

export default function OrderForm({ amount }: { amount: number }) {
  if (!stripePromise) {
    return (
      <p className="status err" role="alert">
        Kart alanı şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.
      </p>
    );
  }

  const options: StripeElementsOptions = {
    mode: 'payment',
    currency: 'try',
    amount,
    paymentMethodCreation: 'manual',
    paymentMethodTypes: ['card'],
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#14513C',
        colorText: '#17201C',
        borderRadius: '8px',
        fontFamily: 'system-ui, sans-serif',
      },
    },
    locale: 'tr',
  };

  return (
    <Elements key={amount} stripe={stripePromise} options={options}>
      <CardFields />
    </Elements>
  );
}
