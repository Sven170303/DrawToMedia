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
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect to verify page with email
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-pattern">
      <div className="w-full max-w-md">
        <div className="card transform rotate-1 border-4 border-sketch-dark shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="font-display text-3xl text-sketch-dark transform -rotate-2 inline-block hover:scale-110 transition-transform">
              Draw to Media
            </Link>
            <h1 className="font-display text-3xl text-sketch-dark mt-8 mb-2">
              {t('login.title')}
            </h1>
            <p className="text-sketch-medium font-medium">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Form */}
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
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-dashed border-sketch-light/30 text-center">
            <p className="text-sm text-sketch-medium font-medium">
              {t('login.noAccount')}{' '}
              <Link href="/login" className="text-sketch-dark font-bold hover:underline decoration-wavy decoration-2 underline-offset-4">
                {t('login.signUp')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
