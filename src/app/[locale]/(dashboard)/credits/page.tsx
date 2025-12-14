'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Loader2,
  AlertCircle,
  Coins,
  Star,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserDataContext } from '@/contexts/UserDataContext';
import { usePackages, type CreditPackage, type SubscriptionPlan } from '@/hooks/usePackages';
import { usePaymentIntent } from '@/hooks/usePaymentIntent';
import { useSubscription } from '@/hooks/useSubscription';
import { PaymentModal, PaymentSuccessModal } from '@/components/payment/PaymentModal';
import { cn } from '@/lib/utils';

const PACKAGE_ICONS: Record<number, typeof Sparkles> = {
  25: Sparkles,
  50: Zap,
  100: Crown,
  250: Star,
};

const SUBSCRIPTION_ICONS: Record<number, typeof RefreshCw> = {
  30: Sparkles,
  100: Zap,
  300: Crown,
};

function CreditsPageContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { user: userData, refetch: refetchUserData } = useUserDataContext();
  const { packages, subscriptions, loading: packagesLoading, error: packagesError } = usePackages();
  const { createPaymentIntent, paymentIntent, loading: paymentLoading, reset: resetPayment } = usePaymentIntent();
  const {
    subscription: activeSubscription,
    hasActiveSubscription,
    createSubscription,
    cancelSubscription,
    checkoutLoading: subscriptionLoading,
  } = useSubscription();

  const [activeTab, setActiveTab] = useState<'onetime' | 'subscription'>('onetime');
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchasedCredits, setPurchasedCredits] = useState(0);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  const credits = userData?.credits ?? 0;

  // Check for success redirect from Stripe
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowSuccessModal(true);
      refetchUserData();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (searchParams.get('subscription') === 'success') {
      setShowSuccessModal(true);
      refetchUserData();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, refetchUserData]);

  const formatPrice = (cents: number, currency: string = 'eur') => {
    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getLocalizedName = (pkg: CreditPackage) => {
    if (locale === 'de') return pkg.name_de;
    if (locale === 'fr') return pkg.name_fr;
    return pkg.name_en;
  };

  const getLocalizedDescription = (pkg: CreditPackage) => {
    if (locale === 'de') return pkg.description_de;
    if (locale === 'fr') return pkg.description_fr;
    return pkg.description_en;
  };

  const getSubscriptionLocalizedName = (plan: SubscriptionPlan) => {
    if (locale === 'de') return plan.name_de;
    if (locale === 'fr') return plan.name_fr;
    return plan.name_en;
  };

  const getSubscriptionLocalizedDescription = (plan: SubscriptionPlan) => {
    if (locale === 'de') return plan.description_de;
    if (locale === 'fr') return plan.description_fr;
    return plan.description_en;
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      await createSubscription(plan.id, locale);
    } catch (error) {
      console.error('Error creating subscription:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!activeSubscription) return;

    if (!window.confirm(t('profile.subscription.cancelConfirm'))) {
      return;
    }

    setCancellingSubscription(true);
    try {
      await cancelSubscription();
      refetchUserData();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setShowPaymentModal(true);

    try {
      await createPaymentIntent(pkg.id, locale);
    } catch (error) {
      console.error('Error creating payment intent:', error);
    }
  };

  const handlePaymentSuccess = useCallback(() => {
    setPurchasedCredits(selectedPackage?.credits || 0);
    setShowPaymentModal(false);
    setShowSuccessModal(true);
    resetPayment();
    refetchUserData();
    setSelectedPackage(null);
  }, [selectedPackage, resetPayment, refetchUserData]);

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    resetPayment();
    setSelectedPackage(null);
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setPurchasedCredits(0);
  };

  const renderPackageCard = (pkg: CreditPackage, index: number) => {
    const Icon = PACKAGE_ICONS[pkg.credits] || Sparkles;
    const isLoading = paymentLoading && selectedPackage?.id === pkg.id;

    return (
      <div
        key={pkg.id}
        className={cn(
          'card relative transition-transform hover:scale-[1.02]',
          pkg.is_popular
            ? 'ring-4 ring-sketch-dark/10 transform scale-105 z-10 rotate-0'
            : index === 0 ? '-rotate-1' : index === 2 ? 'rotate-1' : '-rotate-0.5'
        )}
      >
        {pkg.is_popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-full text-center">
            <span
              className="bg-sketch-dark text-cream-50 text-xs font-bold px-4 py-1.5 border-2 border-white shadow-md"
              style={{ borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}
            >
              {t('pricing.packages.standard.badge')}
            </span>
          </div>
        )}

        <div className="text-center mb-6">
          <div
            className={cn(
              'w-14 h-14 rounded-full border-2 border-sketch-dark flex items-center justify-center mx-auto mb-4',
              pkg.is_popular ? 'bg-sketch-dark text-cream-50' : 'bg-cream-100 text-sketch-dark'
            )}
            style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
          >
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="font-display text-xl text-sketch-dark mb-1">
            {getLocalizedName(pkg)}
          </h3>
          <p className="text-sketch-medium font-medium text-sm">
            {pkg.credits} Credits
          </p>
        </div>

        <div className="text-center mb-5">
          <p className="text-2xl font-display text-sketch-dark">
            {formatPrice(pkg.price_cents, pkg.currency)}
          </p>
          <p className="text-xs text-sketch-light mt-1">
            {formatPrice(pkg.price_per_credit, pkg.currency)} {t('pricing.perCredit')}
          </p>
        </div>

        <ul className="space-y-2 mb-5 text-sm">
          <li className="flex items-center gap-2 text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {pkg.credits} {t('pricing.features.generations')}
          </li>
          <li className="flex items-center gap-2 text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.noExpiration')}
          </li>
        </ul>

        <button
          onClick={() => handlePurchase(pkg)}
          disabled={isLoading}
          className={cn(
            'w-full py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm',
            pkg.is_popular
              ? 'bg-sketch-dark text-cream-50 hover:bg-sketch-dark/90'
              : 'bg-cream-100 text-sketch-dark hover:bg-cream-200',
            isLoading && 'opacity-70 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            t('pricing.buyButton')
          )}
        </button>
      </div>
    );
  };

  const renderSubscriptionCard = (plan: SubscriptionPlan, index: number) => {
    const Icon = SUBSCRIPTION_ICONS[plan.credits_per_month] || RefreshCw;
    const isLoading = subscriptionLoading;
    const description = getSubscriptionLocalizedDescription(plan);

    return (
      <div
        key={plan.id}
        className={cn(
          'card relative transition-transform hover:scale-[1.02]',
          plan.is_popular
            ? 'ring-4 ring-sketch-dark/10 transform scale-105 z-10 rotate-0'
            : index === 0 ? '-rotate-1' : index === 2 ? 'rotate-1' : '-rotate-0.5'
        )}
      >
        {plan.is_popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-full text-center">
            <span
              className="bg-sketch-dark text-cream-50 text-xs font-bold px-4 py-1.5 border-2 border-white shadow-md"
              style={{ borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}
            >
              {t('pricing.packages.plusSub.badge')}
            </span>
          </div>
        )}

        <div className="text-center mb-6">
          <div
            className={cn(
              'w-14 h-14 rounded-full border-2 border-sketch-dark flex items-center justify-center mx-auto mb-4',
              plan.is_popular ? 'bg-sketch-dark text-cream-50' : 'bg-cream-100 text-sketch-dark'
            )}
            style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
          >
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="font-display text-xl text-sketch-dark mb-1">
            {getSubscriptionLocalizedName(plan)}
          </h3>
          <p className="text-sketch-medium font-medium text-sm">
            {plan.credits_per_month} Credits{t('pricing.subscription.perMonth')}
          </p>
        </div>

        <div className="text-center mb-5">
          <p className="text-2xl font-display text-sketch-dark">
            {formatPrice(plan.price_cents, plan.currency)}
            <span className="text-sm text-sketch-light">{t('pricing.subscription.perMonth')}</span>
          </p>
          {description && (
            <p className="text-xs text-sketch-light mt-1">{description}</p>
          )}
        </div>

        <ul className="space-y-2 mb-5 text-sm">
          <li className="flex items-center gap-2 text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {plan.credits_per_month} {t('pricing.features.generations')}{t('pricing.subscription.perMonth')}
          </li>
          <li className="flex items-center gap-2 text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.cancelAnytime')}
          </li>
          <li className="flex items-center gap-2 text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.creditsAccumulate')}
          </li>
        </ul>

        <button
          onClick={() => handleSubscribe(plan)}
          disabled={isLoading || hasActiveSubscription}
          className={cn(
            'w-full py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm',
            plan.is_popular
              ? 'bg-sketch-dark text-cream-50 hover:bg-sketch-dark/90'
              : 'bg-cream-100 text-sketch-dark hover:bg-cream-200',
            (isLoading || hasActiveSubscription) && 'opacity-70 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hasActiveSubscription ? (
            t('profile.subscription.active')
          ) : (
            t('pricing.subscribeButton')
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with current balance */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-sketch-dark mb-1">
              {t('dashboard.credits.title')}
            </h1>
            <p className="text-sketch-medium">
              {t('dashboard.credits.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-white border-2 border-sketch-dark rounded-sketch shadow-sm transform -rotate-1">
            <Coins className="w-6 h-6 text-sketch-dark" />
            <div>
              <p className="text-xs text-sketch-medium font-medium">{t('dashboard.credits.current')}</p>
              <p className="text-2xl font-display text-sketch-dark">{credits}</p>
            </div>
          </div>
        </div>

        {/* Active Subscription Banner */}
        {hasActiveSubscription && activeSubscription && (
          <div className="mb-8 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">{t('profile.subscription.active')}</p>
                  <p className="text-sm text-green-600">
                    {activeSubscription.credits_per_month} Credits{t('pricing.subscription.perMonth')} •{' '}
                    {t('profile.subscription.nextRenewal', {
                      date: new Date(activeSubscription.current_period_end).toLocaleDateString(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US')
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelSubscription}
                disabled={cancellingSubscription}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                {cancellingSubscription ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {t('profile.subscription.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        {subscriptions.length > 0 && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-cream-100 rounded-xl p-1 border-2 border-sketch-dark/10">
              <button
                onClick={() => setActiveTab('onetime')}
                className={cn(
                  'px-5 py-2 rounded-lg font-medium text-sm transition-all',
                  activeTab === 'onetime'
                    ? 'bg-white text-sketch-dark shadow-sm'
                    : 'text-sketch-medium hover:text-sketch-dark'
                )}
              >
                {t('pricing.oneTime.title')}
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={cn(
                  'px-5 py-2 rounded-lg font-medium text-sm transition-all',
                  activeTab === 'subscription'
                    ? 'bg-white text-sketch-dark shadow-sm'
                    : 'text-sketch-medium hover:text-sketch-dark'
                )}
              >
                {t('pricing.subscription.title')}
              </button>
            </div>
          </div>
        )}

        {/* Tab Description */}
        <p className="text-center text-sketch-medium text-sm mb-6">
          {activeTab === 'onetime'
            ? t('pricing.oneTime.subtitle')
            : t('pricing.subscription.subtitle')
          }
        </p>

        {/* Loading State */}
        {packagesLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
          </div>
        )}

        {/* Error State */}
        {packagesError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-sketch-dark font-medium mb-2">{t('pricing.error.title')}</p>
            <p className="text-sketch-medium text-sm">{t('pricing.error.description')}</p>
          </div>
        )}

        {/* One-time Packages */}
        {activeTab === 'onetime' && packages.length > 0 && !packagesLoading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {packages.map((pkg, index) => renderPackageCard(pkg, index))}
          </div>
        )}

        {/* Subscription Plans */}
        {activeTab === 'subscription' && subscriptions.length > 0 && !packagesLoading && (
          <div className={cn(
            'grid gap-5',
            subscriptions.length === 1 ? 'max-w-sm mx-auto' :
            subscriptions.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' :
            subscriptions.length === 3 ? 'sm:grid-cols-3 max-w-3xl mx-auto' :
            'sm:grid-cols-2 lg:grid-cols-4'
          )}>
            {subscriptions.map((plan, index) => renderSubscriptionCard(plan, index))}
          </div>
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={handleClosePaymentModal}
          paymentIntent={paymentIntent}
          pkg={selectedPackage}
          loading={paymentLoading && !paymentIntent}
          onSuccess={handlePaymentSuccess}
        />

        {/* Success Modal */}
        <PaymentSuccessModal
          isOpen={showSuccessModal}
          onClose={handleCloseSuccessModal}
          credits={purchasedCredits}
        />
      </div>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
        </div>
      </div>
    }>
      <CreditsPageContent />
    </Suspense>
  );
}
