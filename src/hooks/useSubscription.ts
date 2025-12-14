'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export interface UserSubscription {
  id: string;
  stripe_subscription_id: string;
  subscription_plan_id: string | null;
  credits_per_month: number;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const supabase = createClient();

  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setSubscription(data || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const createSubscription = async (planId: string, locale: string = 'de') => {
    if (!user) {
      throw new Error('Must be logged in to subscribe');
    }

    setCheckoutLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      const origin = window.location.origin;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            plan_id: planId,
            success_url: `${origin}/${locale}/credits?subscription=success`,
            cancel_url: `${origin}/${locale}/credits?subscription=cancelled`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }

      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription) {
      throw new Error('No active subscription to cancel');
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No valid session');
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            subscription_id: subscription.stripe_subscription_id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      await fetchSubscription();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    loading,
    checkoutLoading,
    error,
    hasActiveSubscription: !!subscription && ['active', 'trialing'].includes(subscription.status),
    createSubscription,
    cancelSubscription,
    refetch: fetchSubscription,
  };
}
