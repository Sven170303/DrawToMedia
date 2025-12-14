'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CreditPackage {
  id: string;
  name: string;
  name_de: string;
  name_en: string;
  name_fr: string;
  description_de: string | null;
  description_en: string | null;
  description_fr: string | null;
  credits: number;
  price_cents: number;
  price_formatted: string;
  currency: string;
  price_per_credit: number;
  is_popular: boolean;
  stripe_product_id: string | null;
  type: 'one_time';
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  name_de: string;
  name_en: string;
  name_fr: string;
  description_de: string | null;
  description_en: string | null;
  description_fr: string | null;
  credits_per_month: number;
  price_cents: number;
  price_formatted: string;
  currency: string;
  interval: 'month' | 'year';
  is_popular: boolean;
  features: string[];
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  type: 'subscription';
}

export interface PricingConfig {
  tokens_per_euro: number;
  tokens_per_generation: number;
  currency: string;
}

export interface PackagesData {
  packages: CreditPackage[];
  subscriptions: SubscriptionPlan[];
  pricing_config: PricingConfig | null;
}

export function usePackages() {
  const [data, setData] = useState<PackagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-packages`,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch packages');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  return {
    packages: data?.packages || [],
    subscriptions: data?.subscriptions || [],
    pricingConfig: data?.pricing_config,
    loading,
    error,
    refetch: fetchPackages,
  };
}
