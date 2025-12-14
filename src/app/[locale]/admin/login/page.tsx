'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowRight, Loader2, Shield, AlertCircle } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error === 'unauthorized' ? 'You are not authorized to access the admin area.' : null
  );

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      // First check if email is in admin whitelist
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-verify-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ email: email.toLowerCase().trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.authorized) {
        setErrorMessage('This email is not authorized for admin access.');
        setLoading(false);
        return;
      }

      // Email is in whitelist, send OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: false, // Don't create new users from admin login
        },
      });

      if (otpError) {
        setErrorMessage(otpError.message);
        setLoading(false);
        return;
      }

      // Redirect to verify page
      const redirectParam = redirect ? `&redirect=${encodeURIComponent(redirect)}` : '';
      router.push(`/admin/verify?email=${encodeURIComponent(email)}${redirectParam}`);
    } catch (err) {
      setErrorMessage('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Admin Login
            </h1>
            <p className="text-gray-500 text-sm">
              Secure access for administrators only
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Send OTP Code
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Only whitelisted email addresses can access the admin panel.
              <br />
              Contact support if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AdminLoginLoading />}>
      <AdminLoginContent />
    </Suspense>
  );
}
