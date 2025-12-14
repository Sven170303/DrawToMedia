'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface PaymentIntentData {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  credits: number;
  package_name: string;
}

export function usePaymentIntent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentData | null>(null);
  const router = useRouter();

  const createPaymentIntent = useCallback(async (packageId: string, locale: string = 'de') => {
    setLoading(true);
    setError(null);
    setPaymentIntent(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/${locale}/login`);
        return null;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ package_id: packageId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const data: PaymentIntentData = await response.json();
      setPaymentIntent(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const reset = useCallback(() => {
    setPaymentIntent(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    createPaymentIntent,
    paymentIntent,
    loading,
    error,
    reset,
  };
}
