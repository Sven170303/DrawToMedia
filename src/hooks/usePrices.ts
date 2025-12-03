'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Price {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  unitAmount: number;
  currency: string;
  type: 'one_time' | 'recurring';
  interval: 'month' | 'year' | null;
  credits: number;
  pricePerCredit: number;
  popular: boolean;
}

export interface PricesData {
  oneTime: Price[];
  subscription: Price[];
}

export function usePrices() {
  const [prices, setPrices] = useState<PricesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-prices`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token && {
                'Authorization': `Bearer ${session.access_token}`,
              }),
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch prices');
        }

        const data = await response.json();
        setPrices(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  return { prices, loading, error };
}
