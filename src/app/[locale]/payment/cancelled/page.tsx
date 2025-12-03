'use client';

import { Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { XCircle, ArrowLeft, CreditCard, Loader2 } from 'lucide-react';

function PaymentCancelledContent() {
  const t = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center transform -rotate-1">
        <div
          className="w-20 h-20 bg-red-100 border-2 border-red-500 flex items-center justify-center mx-auto mb-6"
          style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}
        >
          <XCircle className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-sketch-dark mb-4">
          {t('cancelled.title')}
        </h1>

        <p className="text-sketch-medium mb-6">
          {t('cancelled.description')}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push(`/${locale}/pricing`)}
            className="w-full py-3 bg-sketch-dark text-cream-50 rounded-xl font-semibold hover:bg-sketch-dark/90 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            {t('cancelled.tryAgain')}
          </button>

          <button
            onClick={() => router.push(`/${locale}`)}
            className="w-full py-3 text-sketch-medium hover:text-sketch-dark transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('cancelled.backToHome')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
      </div>
    }>
      <PaymentCancelledContent />
    </Suspense>
  );
}
