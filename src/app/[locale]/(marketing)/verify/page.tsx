'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link, useRouter } from '@/i18n/routing';

function VerifyContent() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { verifyOtp, signInWithOtp } = useAuth();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get email from sessionStorage instead of URL params
  useEffect(() => {
    const storedEmail = sessionStorage.getItem('verifyEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);

    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (token: string) => {
    setLoading(true);
    setError(null);

    const { error } = await verifyOtp(email, token);

    if (error) {
      // Map Supabase errors to user-friendly messages
      let errorMessage = t('errors.generic');
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        errorMessage = t('errors.generic');
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorMessage = t('errors.rateLimited', { seconds: '60' });
      }
      setError(errorMessage);
      setLoading(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      // Use window.location for full page reload to ensure auth cookies are properly sent
      // router.push can cause issues with middleware auth checks on client-side navigation
      window.location.href = `/${locale}/generate`;
    }, 1500);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    const { error } = await signInWithOtp(email);
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setResendCooldown(60);
    setOtp(['', '', '', '', '', '']);
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl text-sketch-dark mb-2">
            {t('otp.existingUser.title')}
          </h1>
          <p className="text-sketch-medium">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sketch-medium hover:text-sketch-dark mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('otp.title')}
          </Link>

          <div className="text-center mb-8">
            <h1 className="font-display text-3xl text-sketch-dark mb-2">
              {t('otp.title')}
            </h1>
            <p className="text-sketch-medium">
              {t('otp.subtitle', { email })}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-sketch-dark mb-3 text-center">
                {t('otp.codeLabel')}
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-12 h-14 text-center text-2xl font-bold input-field"
                    disabled={loading}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={() => handleVerify(otp.join(''))}
              disabled={loading || otp.some((d) => !d)}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('otp.submitButton')
              )}
            </button>

            <div className="text-center space-y-2">
              {resendCooldown > 0 ? (
                <p className="text-sm text-sketch-light">
                  {t('otp.resendIn', { seconds: resendCooldown })}
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm text-sketch-dark font-semibold hover:underline disabled:opacity-50"
                >
                  {t('otp.resendCode')}
                </button>
              )}
              <p className="text-xs text-sketch-light">
                {t('otp.checkSpam')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyLoading() {
  const tCommon = useTranslations('common');
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="card text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-sketch-medium" />
        <p className="text-sketch-medium">{tCommon('loading')}</p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyLoading />}>
      <VerifyContent />
    </Suspense>
  );
}
