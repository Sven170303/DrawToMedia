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

      // Get session and refresh token if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push(`/${locale}/login`);
        return null;
      }

      // Check if token needs refresh (expires within 60 seconds)
      let accessToken = session.access_token;
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 - Date.now() < 60000) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          router.push(`/${locale}/login`);
          return null;
        }
        accessToken = refreshData.session.access_token;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
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
