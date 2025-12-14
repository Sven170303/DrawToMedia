'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import {
  Shield,
  ArrowLeft,
  Save,
  Loader2,
  TrendingUp,
  Calculator,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PricingConfig {
  id: string;
  tokens_per_euro: number;
  tokens_per_generation: number;
  min_purchase_amount: number;
  max_purchase_amount: number;
  currency: string;
}

export default function PricingSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [tokensPerEuro, setTokensPerEuro] = useState(10);
  const [tokensPerGeneration, setTokensPerGeneration] = useState(1);
  const [minPurchase, setMinPurchase] = useState(2.99);
  const [maxPurchase, setMaxPurchase] = useState(500);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('pricing_config')
        .select('*')
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('No pricing config found');

      const configData = data as PricingConfig;
      setConfig(configData);
      setTokensPerEuro(configData.tokens_per_euro);
      setTokensPerGeneration(configData.tokens_per_generation);
      setMinPurchase(parseFloat(String(configData.min_purchase_amount)));
      setMaxPurchase(parseFloat(String(configData.max_purchase_amount)));
    } catch (err) {
      setError('Failed to load pricing configuration');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!user || !config) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-update-pricing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            action: 'update_pricing_config',
            data: {
              id: config.id,
              tokens_per_euro: tokensPerEuro,
              tokens_per_generation: tokensPerGeneration,
              min_purchase_amount: minPurchase,
              max_purchase_amount: maxPurchase,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update pricing');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Refresh config
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Calculate preview values
  const generationsPerEuro = tokensPerEuro / tokensPerGeneration;
  const costPerGeneration = (1 / generationsPerEuro).toFixed(3);

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Pricing Settings</h1>
                  <p className="text-xs text-gray-500">Configure token economics</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            Pricing configuration saved successfully!
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Token Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tokens per Euro */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credits per Euro
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={tokensPerEuro}
                onChange={(e) => setTokensPerEuro(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                How many credits a user gets for 1 EUR
              </p>
            </div>

            {/* Tokens per Generation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credits per Generation
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={tokensPerGeneration}
                onChange={(e) => setTokensPerGeneration(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                How many credits one image generation costs
              </p>
            </div>

            {/* Min Purchase */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Purchase (EUR)
              </label>
              <input
                type="number"
                min="0.50"
                step="0.01"
                value={minPurchase}
                onChange={(e) => setMinPurchase(parseFloat(e.target.value) || 0.5)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Max Purchase */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Purchase (EUR)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={maxPurchase}
                onChange={(e) => setMaxPurchase(parseFloat(e.target.value) || 100)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 mb-6 border border-indigo-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            Preview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">10 EUR Purchase</p>
              <p className="text-2xl font-bold text-gray-900">
                {tokensPerEuro * 10} Credits
              </p>
              <p className="text-xs text-gray-500">
                ~{Math.floor((tokensPerEuro * 10) / tokensPerGeneration)} generations
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Generations per EUR</p>
              <p className="text-2xl font-bold text-gray-900">
                {generationsPerEuro.toFixed(1)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Cost per Generation</p>
              <p className="text-2xl font-bold text-gray-900">
                {costPerGeneration} EUR
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl transition-all disabled:opacity-50 shadow-lg"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Changes
          </button>
        </div>
      </main>
    </div>
  );
}
