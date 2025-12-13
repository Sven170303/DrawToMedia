'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { User, Subscription } from '@/types/database';

interface UserDataContextType {
  user: User | null;
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!authUser?.id) {
      setUser(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      // Fetch user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (userError) {
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
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle();

      setSubscription(subData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, supabase]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authUser?.id, authLoading, fetchData]);

  return (
    <UserDataContext.Provider
      value={{
        user,
        subscription,
        loading: authLoading || loading,
        error,
        refetch: fetchData,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserDataContext(): UserDataContextType {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error('useUserDataContext must be used within a UserDataProvider');
  }
  return context;
}
