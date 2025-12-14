'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Loader2,
  AlertCircle,
  Star,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/hooks/useAuth';
import { usePackages, type CreditPackage, type SubscriptionPlan } from '@/hooks/usePackages';
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

export default function PricingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { packages, subscriptions, loading: packagesLoading, error: packagesError } = usePackages();
  const [activeTab, setActiveTab] = useState<'onetime' | 'subscription'>('onetime');

  const formatPrice = (cents: number, currency: string = 'eur') => {
    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getLocalizedName = (pkg: CreditPackage | SubscriptionPlan) => {
    if (locale === 'de') return pkg.name_de;
    if (locale === 'fr') return pkg.name_fr;
    return pkg.name_en;
  };

  const getLocalizedDescription = (plan: SubscriptionPlan) => {
    if (locale === 'de') return plan.description_de;
    if (locale === 'fr') return plan.description_fr;
    return plan.description_en;
  };

  const handlePurchase = () => {
    if (!user) {
      router.push(`/login?redirect=/credits`);
      return;
    }
    router.push('/credits');
  };

  const renderPackageCard = (pkg: CreditPackage, index: number) => {
    const Icon = PACKAGE_ICONS[pkg.credits] || Sparkles;

    return (
      <div
        key={pkg.id}
        className={cn(
          'card relative transition-transform hover:scale-[1.02]',
          pkg.is_popular
            ? 'ring-4 ring-sketch-dark/10 transform scale-105 z-10 rotate-0'
            : index === 0 ? '-rotate-2' : index === 2 ? 'rotate-2' : '-rotate-1'
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
              'w-16 h-16 rounded-full border-2 border-sketch-dark flex items-center justify-center mx-auto mb-4',
              pkg.is_popular ? 'bg-sketch-dark text-cream-50' : 'bg-cream-100 text-sketch-dark'
            )}
            style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h3 className="font-display text-2xl text-sketch-dark mb-1">
            {getLocalizedName(pkg)}
          </h3>
          <p className="text-sketch-medium font-medium">
            {pkg.credits} Credits
          </p>
        </div>

        <div className="text-center mb-6">
          <p className="text-3xl font-display text-sketch-dark">
            {formatPrice(pkg.price_cents, pkg.currency)}
          </p>
          <p className="text-sm text-sketch-light mt-1">
            {formatPrice(pkg.price_per_credit, pkg.currency)} {t('pricing.perCredit')}
          </p>
        </div>

        <ul className="space-y-3 mb-6">
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {pkg.credits} {t('pricing.features.generations')}
          </li>
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.noExpiration')}
          </li>
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.allResolutions')}
          </li>
        </ul>

        <button
          onClick={handlePurchase}
          className={cn(
            'w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2',
            pkg.is_popular
              ? 'bg-sketch-dark text-cream-50 hover:bg-sketch-dark/90'
              : 'bg-cream-100 text-sketch-dark hover:bg-cream-200'
          )}
        >
          {t('pricing.buyButton')}
        </button>
      </div>
    );
  };

  const renderSubscriptionCard = (plan: SubscriptionPlan, index: number) => {
    const Icon = SUBSCRIPTION_ICONS[plan.credits_per_month] || RefreshCw;
    const description = getLocalizedDescription(plan);

    return (
      <div
        key={plan.id}
        className={cn(
          'card relative transition-transform hover:scale-[1.02]',
          plan.is_popular
            ? 'ring-4 ring-sketch-dark/10 transform scale-105 z-10 rotate-0'
            : index === 0 ? '-rotate-2' : index === 2 ? 'rotate-2' : '-rotate-1'
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
              'w-16 h-16 rounded-full border-2 border-sketch-dark flex items-center justify-center mx-auto mb-4',
              plan.is_popular ? 'bg-sketch-dark text-cream-50' : 'bg-cream-100 text-sketch-dark'
            )}
            style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h3 className="font-display text-2xl text-sketch-dark mb-1">
            {getLocalizedName(plan)}
          </h3>
          <p className="text-sketch-medium font-medium">
            {plan.credits_per_month} Credits{t('pricing.subscription.perMonth')}
          </p>
        </div>

        <div className="text-center mb-6">
          <p className="text-3xl font-display text-sketch-dark">
            {formatPrice(plan.price_cents, plan.currency)}
            <span className="text-lg text-sketch-light">{t('pricing.subscription.perMonth')}</span>
          </p>
          {description && (
            <p className="text-sm text-sketch-light mt-1">{description}</p>
          )}
        </div>

        <ul className="space-y-3 mb-6">
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {plan.credits_per_month} {t('pricing.features.generations')}{t('pricing.subscription.perMonth')}
          </li>
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.cancelAnytime')}
          </li>
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.creditsAccumulate')}
          </li>
          {plan.features && plan.features.length > 0 && plan.features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-sketch-medium">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <button
          onClick={handlePurchase}
          className={cn(
            'w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2',
            plan.is_popular
              ? 'bg-sketch-dark text-cream-50 hover:bg-sketch-dark/90'
              : 'bg-cream-100 text-sketch-dark hover:bg-cream-200'
          )}
        >
          {t('pricing.subscribeButton')}
        </button>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-sketch-dark border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-sketch-medium text-lg max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Tab Navigation */}
        {subscriptions.length > 0 && (
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-cream-100 rounded-xl p-1 border-2 border-sketch-dark/10">
              <button
                onClick={() => setActiveTab('onetime')}
                className={cn(
                  'px-6 py-2.5 rounded-lg font-medium text-sm transition-all',
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
                  'px-6 py-2.5 rounded-lg font-medium text-sm transition-all',
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
        <div className="text-center mb-8">
          <p className="text-sketch-medium">
            {activeTab === 'onetime'
              ? t('pricing.oneTime.subtitle')
              : t('pricing.subscription.subtitle')
            }
          </p>
        </div>

        {packagesLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
          </div>
        )}

        {packagesError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-sketch-dark font-medium mb-2">{t('pricing.error.title')}</p>
            <p className="text-sketch-medium text-sm">{t('pricing.error.description')}</p>
          </div>
        )}

        {/* One-time Packages */}
        {activeTab === 'onetime' && packages.length > 0 && !packagesLoading && (
          <div className="grid md:grid-cols-4 gap-6">
            {packages.map((pkg, index) => renderPackageCard(pkg, index))}
          </div>
        )}

        {/* Subscription Plans */}
        {activeTab === 'subscription' && subscriptions.length > 0 && !packagesLoading && (
          <div className={cn(
            'grid gap-6',
            subscriptions.length === 1 ? 'max-w-md mx-auto' :
            subscriptions.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' :
            subscriptions.length === 3 ? 'md:grid-cols-3 max-w-4xl mx-auto' :
            'md:grid-cols-4'
          )}>
            {subscriptions.map((plan, index) => renderSubscriptionCard(plan, index))}
          </div>
        )}
      </div>
    </div>
  );
}
