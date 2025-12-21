'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/routing';
import {
  Shield,
  ArrowLeft,
  Save,
  Loader2,
  Package,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  X,
  Star,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CreditPackage {
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
  stripe_product_id: string | null;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

export default function PackagesSettingsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit modal state
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchPackages = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('credit_packages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setPackages(data || []);
    } catch (err) {
      setError('Failed to load packages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleSavePackage = async (pkg: CreditPackage) => {
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
            action: 'update_package',
            data: pkg,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update package');
      }

      setSuccess('Package updated successfully!');
      setShowEditModal(false);
      setEditingPackage(null);
      await fetchPackages();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this package?')) return;

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
            action: 'delete_package',
            data: { id: pkgId },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete package');
      }

      setSuccess('Package deleted successfully!');
      await fetchPackages();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete package');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pkg: CreditPackage) => {
    await handleSavePackage({ ...pkg, is_active: !pkg.is_active });
  };

  const handleTogglePopular = async (pkg: CreditPackage) => {
    await handleSavePackage({ ...pkg, is_popular: !pkg.is_popular });
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
                  <h1 className="text-lg font-bold text-gray-900">Credit Packages</h1>
                  <p className="text-xs text-gray-500">Manage packages and pricing</p>
                </div>
              </div>
            </div>
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

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                pkg.is_active ? 'border-gray-100' : 'border-red-200 bg-red-50'
              } ${pkg.is_popular ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                    {pkg.is_popular && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{pkg.name_de}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingPackage(pkg);
                      setShowEditModal(true);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
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
                    {formatPrice(pkg.price_cents)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {pkg.credits} Credits
                  <span className="text-gray-400 ml-2">
                    ({(pkg.price_cents / 100 / pkg.credits).toFixed(3)} EUR/Credit)
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleToggleActive(pkg)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    pkg.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {pkg.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => handleTogglePopular(pkg)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    pkg.is_popular
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {pkg.is_popular ? 'Popular' : 'Standard'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && editingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Package</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPackage(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (DE)
                  </label>
                  <input
                    type="text"
                    value={editingPackage.name_de}
                    onChange={(e) =>
                      setEditingPackage({ ...editingPackage, name_de: e.target.value })
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
                    value={editingPackage.name_en}
                    onChange={(e) =>
                      setEditingPackage({ ...editingPackage, name_en: e.target.value })
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
                    value={editingPackage.name_fr}
                    onChange={(e) =>
                      setEditingPackage({ ...editingPackage, name_fr: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingPackage.credits || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditingPackage({
                        ...editingPackage,
                        credits: value === '' ? 0 : parseInt(value, 10),
                      });
                    }}
                    onBlur={(e) => {
                      if (!editingPackage.credits || editingPackage.credits < 1) {
                        setEditingPackage({ ...editingPackage, credits: 1 });
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
                    value={editingPackage.price_cents || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditingPackage({
                        ...editingPackage,
                        price_cents: value === '' ? 0 : parseInt(value, 10),
                      });
                    }}
                    onBlur={(e) => {
                      if (!editingPackage.price_cents || editingPackage.price_cents < 1) {
                        setEditingPackage({ ...editingPackage, price_cents: 1 });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    = {formatPrice(editingPackage.price_cents || 0)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingPackage.sort_order}
                  onChange={(e) =>
                    setEditingPackage({
                      ...editingPackage,
                      sort_order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingPackage(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePackage(editingPackage)}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
