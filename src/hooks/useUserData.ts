'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Subscription } from '@/types/database';

interface UserData {
  user: User | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserData(userId: string | undefined): UserData {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchData = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        // User might not exist yet in public.users table
        if (userError.code === 'PGRST116') {
          setUser(null);
        } else {
          throw userError;
        }
      } else {
        setUser(userData);
      }

      // Fetch active subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      setSubscription(subData || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  return {
    user,
    subscription,
    loading,
    error,
    refetch: fetchData,
  };
}
