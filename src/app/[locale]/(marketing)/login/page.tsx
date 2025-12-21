'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useRouter } from '@/i18n/routing';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { signInWithOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signInWithOtp(email);

    if (error) {
      // Map Supabase errors to user-friendly messages
      let errorKey = 'errors.generic';
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorKey = 'errors.rateLimited';
      } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
        errorKey = 'errors.invalidEmail';
      } else if (error.message.includes('Database') || error.message.includes('database')) {
        errorKey = 'errors.databaseError';
      }
      setError(t(errorKey, { seconds: '60' }));
      setLoading(false);
      return;
    }

    // Store email in sessionStorage instead of URL to prevent exposure in browser history
    sessionStorage.setItem('verifyEmail', email);
    router.push('/verify');
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 bg-pattern">
      <div className="w-full max-w-md">
        <div className="card transform rotate-1 border-4 border-sketch-dark shadow-xl">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-sketch-dark mb-2">
              {t('login.title')}
            </h1>
            <p className="text-sketch-medium font-medium">
              {t('login.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-sketch-dark mb-2 ml-1"
              >
                {t('login.emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sketch-light" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  className="input-field pl-12 text-lg"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-sketch text-red-600 text-sm font-bold flex items-center gap-2 transform -rotate-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg py-4 mt-2"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {t('login.submitButton')}
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>

            <p className="text-xs text-sketch-light text-center mt-3">
              {t('login.hint')}
            </p>
          </form>

          <div className="mt-8 pt-6 border-t-2 border-dashed border-sketch-light/30 text-center">
            <p className="text-sm text-sketch-medium font-medium">
              {t('login.noAccount')}{' '}
              <span className="text-sketch-dark font-bold">
                {t('login.signUp')}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
