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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePrices, type Price } from '@/hooks/usePrices';
import { useCheckout } from '@/hooks/useCheckout';
import { cn } from '@/lib/utils';

type PricingTab = 'oneTime' | 'subscription';

const PACKAGE_ICONS: Record<string, typeof Sparkles> = {
  'prod_TX8ff9rU2hmuKA': Sparkles,
  'prod_TX8fxksOk2BWvV': Zap,
  'prod_TX8f5fPshnDHXd': Crown,
  'prod_TX8f4XSQ5Ut4cS': Zap,
  'prod_TX8f6IOkSiMHzx': Crown,
};

const PACKAGE_KEYS: Record<string, string> = {
  'prod_TX8ff9rU2hmuKA': 'starter',
  'prod_TX8fxksOk2BWvV': 'standard',
  'prod_TX8f5fPshnDHXd': 'pro',
  'prod_TX8f4XSQ5Ut4cS': 'basicSub',
  'prod_TX8f6IOkSiMHzx': 'plusSub',
};

export default function PricingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { prices, loading: pricesLoading, error: pricesError } = usePrices();
  const { checkout, loading: checkoutLoading } = useCheckout();
  const [activeTab, setActiveTab] = useState<PricingTab>('oneTime');
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);

  const formatPrice = (cents: number, currency: string = 'eur') => {
    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handlePurchase = async (price: Price) => {
    if (!user) {
      window.location.href = `/${locale}/login?redirect=/${locale}/pricing`;
      return;
    }

    setLoadingPackage(price.id);

    try {
      await checkout({
        priceId: price.id,
        mode: price.type === 'recurring' ? 'subscription' : 'payment',
        locale,
      });
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoadingPackage(null);
    }
  };

  const renderPriceCard = (price: Price, index: number, isSubscription: boolean) => {
    const Icon = PACKAGE_ICONS[price.productId] || Sparkles;
    const packageKey = PACKAGE_KEYS[price.productId] || 'starter';
    const isLoading = loadingPackage === price.id || checkoutLoading;

    return (
      <div
        key={price.id}
        className={cn(
          'card relative transition-transform hover:scale-[1.02]',
          price.popular
            ? 'ring-4 ring-sketch-dark/10 transform scale-105 z-10 rotate-0'
            : index === 0 ? '-rotate-2' : 'rotate-2'
        )}
      >
        {price.popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-full text-center">
            <span
              className="bg-sketch-dark text-cream-50 text-xs font-bold px-4 py-1.5 border-2 border-white shadow-md"
              style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}
            >
              {t(`pricing.packages.${packageKey}.badge`)}
            </span>
          </div>
        )}

        <div className="text-center mb-6">
          <div
            className={cn(
              'w-16 h-16 rounded-full border-2 border-sketch-dark flex items-center justify-center mx-auto mb-4',
              price.popular ? 'bg-sketch-dark text-cream-50' : 'bg-cream-100 text-sketch-dark'
            )}
            style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h3 className="font-display text-2xl text-sketch-dark mb-1">
            {t(`pricing.packages.${packageKey}.name`)}
          </h3>
          <p className="text-sketch-medium font-medium">
            {price.credits} Credits{isSubscription ? ` ${t('pricing.subscription.perMonth')}` : ''}
          </p>
        </div>

        <div className="text-center mb-6">
          <p className="text-3xl font-display text-sketch-dark">
            {formatPrice(price.unitAmount, price.currency)}
            {isSubscription && (
              <span className="text-lg text-sketch-medium">
                {t('pricing.subscription.perMonth')}
              </span>
            )}
          </p>
          <p className="text-sm text-sketch-light mt-1">
            {formatPrice(price.pricePerCredit, price.currency)} {t('pricing.perCredit')}
          </p>
        </div>

        <ul className="space-y-3 mb-6">
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {price.credits} {t('pricing.features.generations')}
          </li>
          {isSubscription ? (
            <>
              <li className="flex items-center gap-2 text-sm text-sketch-medium">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                {t('pricing.features.cancelAnytime')}
              </li>
              <li className="flex items-center gap-2 text-sm text-sketch-medium">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                {t('pricing.features.creditsAccumulate')}
              </li>
            </>
          ) : (
            <li className="flex items-center gap-2 text-sm text-sketch-medium">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              {t('pricing.features.noExpiration')}
            </li>
          )}
          <li className="flex items-center gap-2 text-sm text-sketch-medium">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            {t('pricing.features.allResolutions')}
          </li>
        </ul>

        <button
          onClick={() => handlePurchase(price)}
          disabled={isLoading}
          className={cn(
            'w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2',
            price.popular
              ? 'bg-sketch-dark text-cream-50 hover:bg-sketch-dark/90'
              : 'bg-cream-100 text-sketch-dark hover:bg-cream-200',
            isLoading && 'opacity-70 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isSubscription ? (
            t('pricing.subscribeButton')
          ) : (
            t('pricing.buyButton')
          )}
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
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-sketch-medium text-lg max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-cream-100 border-2 border-sketch-dark rounded-sketch p-1 transform -rotate-1">
            <button
              onClick={() => setActiveTab('oneTime')}
              className={cn(
                'px-6 py-3 rounded-sketch text-sm font-bold transition-all',
                activeTab === 'oneTime'
                  ? 'bg-white text-sketch-dark shadow-sm border-2 border-sketch-dark transform rotate-1'
                  : 'text-sketch-medium hover:text-sketch-dark'
              )}
            >
              {t('pricing.oneTime.title')}
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={cn(
                'px-6 py-3 rounded-sketch text-sm font-bold transition-all',
                activeTab === 'subscription'
                  ? 'bg-white text-sketch-dark shadow-sm border-2 border-sketch-dark transform -rotate-1'
                  : 'text-sketch-medium hover:text-sketch-dark'
              )}
            >
              {t('pricing.subscription.title')}
            </button>
          </div>
        </div>

        {pricesLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
          </div>
        )}

        {pricesError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-sketch-dark font-medium mb-2">{t('pricing.error.title')}</p>
            <p className="text-sketch-medium text-sm">{t('pricing.error.description')}</p>
          </div>
        )}

        {prices && !pricesLoading && (
          <>
            {activeTab === 'oneTime' ? (
              <div className="grid md:grid-cols-3 gap-6">
                {prices.oneTime.map((price, index) =>
                  renderPriceCard(price, index, false)
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {prices.subscription.map((price, index) =>
                  renderPriceCard(price, index, true)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
