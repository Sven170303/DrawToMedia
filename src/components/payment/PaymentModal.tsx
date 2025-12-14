'use client';

import { useState, useEffect } from 'react';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { X, Loader2, CheckCircle, AlertCircle, CreditCard, Lock } from 'lucide-react';
import { getStripe } from '@/lib/stripe/client';
import type { CreditPackage } from '@/hooks/usePackages';
import type { PaymentIntentData } from '@/hooks/usePaymentIntent';
import { useTranslations, useLocale } from 'next-intl';

interface PaymentFormProps {
  paymentIntent: PaymentIntentData;
  pkg: CreditPackage;
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({ paymentIntent, pkg, onSuccess, onCancel }: PaymentFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (cents: number, currency: string = 'eur') => {
    return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();

    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    const returnUrl = `${window.location.origin}/${locale}/credits?payment=success`;

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret: paymentIntent.client_secret,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  const getLocalizedName = () => {
    if (locale === 'de') return pkg.name_de;
    if (locale === 'fr') return pkg.name_fr;
    return pkg.name_en;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Package Summary */}
      <div className="bg-cream-50 rounded-xl p-4 border-2 border-sketch-dark/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-sketch-dark">{getLocalizedName()}</p>
            <p className="text-sm text-sketch-medium">{pkg.credits} Credits</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl text-sketch-dark">
              {formatPrice(paymentIntent.amount, paymentIntent.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Element */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-xs text-sketch-medium">
        <Lock className="w-4 h-4" />
        <p>{t('payment.securePayment')}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 py-3 px-4 rounded-xl border-2 border-sketch-dark/20 text-sketch-dark font-medium hover:bg-cream-100 transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || processing}
          className="flex-1 py-3 px-4 rounded-xl bg-sketch-dark text-cream-50 font-medium hover:bg-sketch-dark/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              {t('payment.payNow')}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentIntent: PaymentIntentData | null;
  pkg: CreditPackage | null;
  loading: boolean;
  onSuccess: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  paymentIntent,
  pkg,
  loading,
  onSuccess,
}: PaymentModalProps) {
  const t = useTranslations();
  const [stripeLoaded, setStripeLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && paymentIntent) {
      getStripe().then(() => setStripeLoaded(true));
    }
  }, [isOpen, paymentIntent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sketch-dark rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-cream-50" />
            </div>
            <h2 className="font-display text-xl text-sketch-dark">
              {t('payment.checkout')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sketch-dark mb-4" />
              <p className="text-sketch-medium">{t('payment.preparing')}</p>
            </div>
          )}

          {!loading && paymentIntent && pkg && stripeLoaded && (
            <Elements
              stripe={getStripe()}
              options={{
                clientSecret: paymentIntent.client_secret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2d2d2d',
                    colorBackground: '#ffffff',
                    colorText: '#2d2d2d',
                    colorDanger: '#dc2626',
                    fontFamily: 'system-ui, sans-serif',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <PaymentForm
                paymentIntent={paymentIntent}
                pkg={pkg}
                onSuccess={onSuccess}
                onCancel={onClose}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits: number;
}

export function PaymentSuccessModal({ isOpen, onClose, credits }: PaymentSuccessModalProps) {
  const t = useTranslations();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="font-display text-2xl text-sketch-dark mb-2">
          {t('payment.success.title')}
        </h2>
        <p className="text-sketch-medium mb-6">
          {t('payment.success.description', { credits })}
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 px-4 rounded-xl bg-sketch-dark text-cream-50 font-medium hover:bg-sketch-dark/90 transition-colors"
        >
          {t('payment.success.continue')}
        </button>
      </div>
    </div>
  );
}
