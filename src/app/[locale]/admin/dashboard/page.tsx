'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/routing';
import {
  Shield,
  Users,
  ImageIcon,
  CreditCard,
  Settings,
  LogOut,
  TrendingUp,
  Package,
  DollarSign,
  Activity,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AdminStats {
  total_users: number;
  active_users_30d: number;
  total_generations_30d: number;
  total_revenue_30d: number;
  total_credits_sold_30d: number;
}

interface PricingConfig {
  id: string;
  tokens_per_euro: number;
  tokens_per_generation: number;
  min_purchase_amount: number;
  max_purchase_amount: number;
  currency: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = createClient();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      // Fetch stats
      const statsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-update-pricing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ action: 'get_stats' }),
        }
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      // Fetch pricing config
      const { data: configData, error: configError } = await supabase
        .from('pricing_config')
        .select('*')
        .single();

      if (configError) {
        console.error('Error fetching pricing config:', configError);
      } else {
        setPricingConfig(configData);
      }

    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-xs text-gray-500">Draw to Digital Media</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_users || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active (30d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.active_users_30d || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Generations (30d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_generations_30d || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue (30d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats?.total_revenue_30d || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Pricing Config */}
        {pricingConfig && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Current Pricing Configuration
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Credits per Euro</p>
                <p className="text-xl font-bold text-gray-900">{pricingConfig.tokens_per_euro}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Credits per Generation</p>
                <p className="text-xl font-bold text-gray-900">{pricingConfig.tokens_per_generation}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Min Purchase</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pricingConfig.min_purchase_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Purchase</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pricingConfig.max_purchase_amount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/users"
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">User Management</h3>
                  <p className="text-sm text-gray-500">View users and manage credits</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </div>
          </Link>

          <Link
            href="/admin/settings/pricing"
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <Settings className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Pricing Settings</h3>
                  <p className="text-sm text-gray-500">Configure tokens per euro, generation costs</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </div>
          </Link>

          <Link
            href="/admin/settings/packages"
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Credit Packages</h3>
                  <p className="text-sm text-gray-500">One-time credit purchases</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
          </Link>

          <Link
            href="/admin/settings/subscriptions"
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <RefreshCw className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Subscription Plans</h3>
                  <p className="text-sm text-gray-500">Monthly/yearly recurring credits</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Credits Sold */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Credits Summary (30 days)
          </h2>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-gray-500">Credits Sold</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.total_credits_sold_30d?.toLocaleString() || 0}
              </p>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div>
              <p className="text-sm text-gray-500">Avg. Revenue per Credit</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.total_credits_sold_30d
                  ? formatCurrency((stats.total_revenue_30d || 0) / stats.total_credits_sold_30d)
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
