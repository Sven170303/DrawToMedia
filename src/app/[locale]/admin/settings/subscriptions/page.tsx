'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/routing';
import {
  Shield,
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  X,
  Star,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionPlan {
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
  interval: 'month' | 'year';
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  features: string[];
}

const emptyPlan: Omit<SubscriptionPlan, 'id'> = {
  name: '',
  name_de: '',
  name_en: '',
  name_fr: '',
  description_de: null,
  description_en: null,
  description_fr: null,
  credits_per_month: 50,
  price_cents: 999,
  interval: 'month',
  stripe_product_id: null,
  stripe_price_id: null,
  is_active: true,
  is_popular: false,
  sort_order: 0,
  features: [],
};

export default function SubscriptionSettingsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  const fetchPlans = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setPlans(data || []);
    } catch (err) {
      setError('Failed to load subscription plans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSavePlan = async (plan: SubscriptionPlan | Omit<SubscriptionPlan, 'id'>) => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

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
            action: isNewPlan ? 'create_subscription_plan' : 'update_subscription_plan',
            data: plan,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save subscription plan');
      }

      setSuccess(isNewPlan ? 'Subscription plan created!' : 'Subscription plan updated!');
      setShowEditModal(false);
      setEditingPlan(null);
      setIsNewPlan(false);
      await fetchPlans();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this subscription plan?')) return;

    setSaving(true);
    setError(null);

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
            action: 'delete_subscription_plan',
            data: { id: planId },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete subscription plan');
      }

      setSuccess('Subscription plan deleted!');
      await fetchPlans();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    await handleSavePlan({ ...plan, is_active: !plan.is_active });
  };

  const handleTogglePopular = async (plan: SubscriptionPlan) => {
    await handleSavePlan({ ...plan, is_popular: !plan.is_popular });
  };

  const handleAddFeature = () => {
    if (!newFeature.trim() || !editingPlan) return;
    setEditingPlan({
      ...editingPlan,
      features: [...(editingPlan.features || []), newFeature.trim()],
    });
    setNewFeature('');
  };

  const handleRemoveFeature = (index: number) => {
    if (!editingPlan) return;
    const newFeatures = [...editingPlan.features];
    newFeatures.splice(index, 1);
    setEditingPlan({ ...editingPlan, features: newFeatures });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  <h1 className="text-lg font-bold text-gray-900">Subscription Plans</h1>
                  <p className="text-xs text-gray-500">Manage monthly/yearly subscriptions</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingPlan(emptyPlan as SubscriptionPlan);
                setIsNewPlan(true);
                setShowEditModal(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Plan
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                plan.is_active ? 'border-gray-100' : 'border-red-200 bg-red-50'
              } ${plan.is_popular ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{plan.name_de}</h3>
                    {plan.is_popular && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {plan.interval === 'month' ? 'Monthly' : 'Yearly'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      setIsNewPlan(false);
                      setShowEditModal(true);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatPrice(plan.price_cents)}
                  </span>
                  <span className="text-gray-500">
                    /{plan.interval === 'month' ? 'mo' : 'yr'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {plan.credits_per_month} Credits/{plan.interval === 'month' ? 'Monat' : 'Jahr'}
                </p>
              </div>

              {plan.features && plan.features.length > 0 && (
                <ul className="text-sm text-gray-600 space-y-1 mb-4 border-t border-gray-100 pt-4">
                  {(plan.features as string[]).slice(0, 3).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 3 && (
                    <li className="text-gray-400 text-xs">
                      +{plan.features.length - 3} more features
                    </li>
                  )}
                </ul>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleToggleActive(plan)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    plan.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {plan.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => handleTogglePopular(plan)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    plan.is_popular
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {plan.is_popular ? 'Popular' : 'Standard'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No subscription plans yet</h3>
            <p className="text-gray-500 mb-4">Create your first subscription plan to get started.</p>
            <button
              onClick={() => {
                setEditingPlan(emptyPlan as SubscriptionPlan);
                setIsNewPlan(true);
                setShowEditModal(true);
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Plan
            </button>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {showEditModal && editingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {isNewPlan ? 'New Subscription Plan' : 'Edit Subscription Plan'}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPlan(null);
                  setIsNewPlan(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Name (slug)
                </label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) =>
                    setEditingPlan({ ...editingPlan, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                  }
                  placeholder="e.g. starter, pro, business"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (DE)
                  </label>
                  <input
                    type="text"
                    value={editingPlan.name_de}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, name_de: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (EN)
                  </label>
                  <input
                    type="text"
                    value={editingPlan.name_en}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, name_en: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (FR)
                  </label>
                  <input
                    type="text"
                    value={editingPlan.name_fr}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, name_fr: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credits per Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingPlan.credits_per_month || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditingPlan({
                        ...editingPlan,
                        credits_per_month: value === '' ? 0 : parseInt(value, 10),
                      });
                    }}
                    onBlur={() => {
                      if (!editingPlan.credits_per_month || editingPlan.credits_per_month < 1) {
                        setEditingPlan({ ...editingPlan, credits_per_month: 1 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (Cents)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingPlan.price_cents || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditingPlan({
                        ...editingPlan,
                        price_cents: value === '' ? 0 : parseInt(value, 10),
                      });
                    }}
                    onBlur={() => {
                      if (!editingPlan.price_cents || editingPlan.price_cents < 1) {
                        setEditingPlan({ ...editingPlan, price_cents: 1 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    = {formatPrice(editingPlan.price_cents || 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Interval
                  </label>
                  <select
                    value={editingPlan.interval}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        interval: e.target.value as 'month' | 'year',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingPlan.sort_order}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        sort_order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Features
                </label>
                <div className="space-y-2 mb-2">
                  {editingPlan.features?.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                        {feature}
                      </span>
                      <button
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-2 hover:bg-red-100 rounded-lg"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                    placeholder="Add a feature..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPlan(null);
                  setIsNewPlan(false);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePlan(editingPlan)}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isNewPlan ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
