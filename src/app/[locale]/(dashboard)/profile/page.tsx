'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  User,
  Mail,
  Coins,
  CreditCard,
  Calendar,
  Clock,
  Package,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Receipt,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

interface CreditPurchase {
  id: string;
  stripe_session_id: string;
  amount_paid: number;
  currency: string;
  credits: number;
  created_at: string;
}

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: userData, subscription, loading: userDataLoading, refetch } = useUserData(authUser?.id);
  const supabase = createClient();

  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  useEffect(() => {
    if (authUser) {
      fetchPurchases();
    }
  }, [authUser]);

  const fetchPurchases = async () => {
    if (!authUser) return;

    setPurchasesLoading(true);
    try {
      const { data, error } = await supabase
        .from('credit_purchases')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const isLoading = authLoading || userDataLoading;
  const credits = userData?.credits ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-sketch-dark border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="card text-center max-w-md">
            <User className="w-16 h-16 text-sketch-medium mx-auto mb-4" />
            <h1 className="font-display text-2xl text-sketch-dark mb-2">
              {t('auth.login.title')}
            </h1>
            <p className="text-sketch-medium mb-6">
              Bitte melde dich an, um dein Profil zu sehen.
            </p>
            <Link href="/login" className="btn-primary inline-block">
              {t('navigation.login')}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
            {t('profile.title')}
          </h1>

          <div className="space-y-6">
            {/* Account Info Card */}
            <div className="card transform rotate-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-cream-100 border-2 border-sketch-dark rounded-full flex items-center justify-center" style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}>
                  <User className="w-8 h-8 text-sketch-medium" />
                </div>
                <div>
                  <h2 className="font-display text-xl text-sketch-dark">
                    {t('profile.settings.title')}
                  </h2>
                  <p className="text-sketch-medium text-sm font-medium">
                    {authUser.email}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b-2 border-dashed border-sketch-light/20">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-sketch-light" />
                    <span className="text-sketch-medium font-bold">{t('profile.settings.email')}</span>
                  </div>
                  <span className="text-sketch-dark font-bold">{authUser.email}</span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-sketch-light" />
                    <span className="text-sketch-medium font-bold">Mitglied seit</span>
                  </div>
                  <span className="text-sketch-dark font-bold">
                    {formatDate(authUser.created_at || new Date().toISOString())}
                  </span>
                </div>
              </div>
            </div>

            {/* Credits Card */}
            <div className="card bg-gradient-to-br from-cream-50 to-cream-100 transform -rotate-1">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display text-xl text-sketch-dark mb-1">
                    {t('profile.credits.title')}
                  </h2>
                  <p className="text-sketch-medium text-sm font-medium">
                    1 Credit = 1 Bildgenerierung
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-sketch-dark rounded-sketch shadow-sm">
                  <Coins className="w-5 h-5 text-sketch-dark" />
                  <span className="text-2xl font-display text-sketch-dark">{credits}</span>
                </div>
              </div>

              <Link
                href="/pricing"
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                {t('profile.credits.buyMore')}
              </Link>
            </div>

            {/* Subscription Card */}
            <div className="card">
              <h2 className="font-display text-xl text-sketch-dark mb-4">
                {t('profile.subscription.title')}
              </h2>

              {subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sketch-dark">
                        {subscription.price_id?.includes('basic') ? 'Basic' : 'Plus'} Plan
                      </p>
                      <p className="text-sm text-sketch-medium">
                        {t('profile.subscription.active')}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-cream-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sketch-medium">Nächste Verlängerung</span>
                      <span className="font-medium text-sketch-dark">
                        {formatDate(subscription.current_period_end)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sketch-medium">Credits/Monat</span>
                      <span className="font-medium text-sketch-dark">
                        {subscription.price_id?.includes('basic') ? '12' : '30'}
                      </span>
                    </div>
                  </div>

                  <button className="w-full py-3 text-sketch-medium hover:text-sketch-dark border border-sketch-light/30 rounded-xl transition-colors flex items-center justify-center gap-2">
                    {t('profile.subscription.manage')}
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-cream-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="w-8 h-8 text-sketch-light" />
                  </div>
                  <p className="text-sketch-medium mb-4">
                    {t('profile.subscription.inactive')}
                  </p>
                  <Link
                    href="/pricing"
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    Abonnement starten
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* Purchase History */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl text-sketch-dark">
                  Kaufhistorie
                </h2>
                <Receipt className="w-5 h-5 text-sketch-light" />
              </div>

              {purchasesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-sketch-medium" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-cream-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-6 h-6 text-sketch-light" />
                  </div>
                  <p className="text-sketch-medium text-sm">
                    Noch keine Käufe vorhanden
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 bg-cream-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sketch-dark">
                            +{purchase.credits} Credits
                          </p>
                          <p className="text-sm text-sketch-medium">
                            {formatDate(purchase.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-sketch-dark">
                        {formatCurrency(Number(purchase.amount_paid) * 100, purchase.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
