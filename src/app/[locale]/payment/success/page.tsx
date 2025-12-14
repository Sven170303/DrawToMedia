'use client';

import { useEffect, useState, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function PaymentSuccessContent() {
  const t = useTranslations('payment');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCredits = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/${locale}/login`);
        return;
      }

      // Poll for credit update (webhook may take a moment)
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = 1000;

      const poll = async () => {
        const { data: userData } = await supabase
          .from('users')
          .select('credits')
          .eq('id', user.id)
          .single();

        if (userData) {
          setCredits((userData as { credits: number }).credits);
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          setLoading(false);
        }
      };

      poll();

      // Stop loading after max time
      setTimeout(() => setLoading(false), maxAttempts * pollInterval);
    };

    checkCredits();
  }, [locale, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center transform rotate-1">
        <div
          className="w-20 h-20 bg-green-100 border-2 border-green-600 flex items-center justify-center mx-auto mb-6"
          style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}
        >
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="font-display text-2xl sm:text-3xl text-sketch-dark mb-4">
          {t('success.title')}
        </h1>

        <p className="text-sketch-medium mb-6">
          {t('success.description')}
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sketch-medium mb-6">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t('success.processingCredits')}</span>
          </div>
        ) : credits !== null ? (
          <div className="bg-cream-100 border-2 border-sketch-dark rounded-sketch p-4 mb-6">
            <p className="text-sm text-sketch-medium">{t('success.currentBalance')}</p>
            <p className="text-3xl font-display text-sketch-dark">{credits} Credits</p>
          </div>
        ) : null}

        <button
          onClick={() => router.push(`/${locale}/generate`)}
          className="w-full py-3 bg-sketch-dark text-cream-50 rounded-xl font-semibold hover:bg-sketch-dark/90 transition-colors flex items-center justify-center gap-2"
        >
          {t('success.startCreating')}
          <ArrowRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => router.push(`/${locale}/pricing`)}
          className="w-full py-3 mt-3 text-sketch-medium hover:text-sketch-dark transition-colors text-sm"
        >
          {t('success.buyMoreCredits')}
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sketch-dark" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
