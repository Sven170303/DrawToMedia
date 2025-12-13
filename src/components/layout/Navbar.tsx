'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Menu, X, Globe, LogOut, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, usePathname, useRouter, routing, type Locale } from '@/i18n/routing';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const t = useTranslations('navigation');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { href: '/' as const, label: t('home') },
    { href: '/pricing' as const, label: t('pricing') },
  ];

  const languageNames: Record<Locale, string> = {
    de: 'Deutsch',
    en: 'English',
    fr: 'Français',
  };

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
    setIsLangOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm torn-edge-bottom shadow-sm pb-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="font-display text-2xl text-sketch-dark transform -rotate-2 hover:rotate-0 transition-transform">
            Draw to Media
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sketch-medium hover:text-sketch-dark transition-all font-bold text-lg',
                  pathname === item.href && 'text-sketch-dark underline decoration-wavy decoration-2 underline-offset-4'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-white/50 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>{languageNames[locale]}</span>
              </button>

              {isLangOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-sketch-light/20 py-1">
                  {routing.locales.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => switchLocale(loc)}
                      className={cn(
                        'w-full text-left px-4 py-2 hover:bg-cream-100 transition-colors',
                        locale === loc && 'font-semibold bg-cream-50'
                      )}
                    >
                      {languageNames[loc]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auth Button */}
            {loading ? (
              <div className="w-20 h-9 bg-sketch-light/20 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-white/50 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span className="max-w-[120px] truncate text-sm">
                    {user.email}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-sketch-light/20 py-1 z-50">
                    <Link
                      href="/generate"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-cream-100 transition-colors text-sketch-dark font-semibold"
                    >
                      <Sparkles className="w-4 h-4" />
                      {t('generate')}
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-cream-100 transition-colors text-sketch-dark"
                    >
                      <User className="w-4 h-4" />
                      {t('profile')}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 hover:bg-cream-100 transition-colors text-red-600 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-secondary text-sm">
                {t('login')}
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-sketch-light/20">
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'text-sketch-medium hover:text-sketch-dark transition-colors',
                    pathname === item.href && 'text-sketch-dark font-semibold'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-sketch-light/20">
                <p className="text-sm text-sketch-light mb-2">Sprache</p>
                <div className="flex space-x-2">
                  {routing.locales.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        switchLocale(loc);
                        setIsMenuOpen(false);
                      }}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm',
                        locale === loc
                          ? 'bg-sketch-dark text-cream-50'
                          : 'bg-white/50 text-sketch-medium'
                      )}
                    >
                      {loc.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {user ? (
                <div className="pt-4 border-t border-sketch-light/20 space-y-3">
                  <p className="text-sm text-sketch-light truncate">{user.email}</p>
                  <Link
                    href="/generate"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 text-sketch-dark font-semibold hover:text-sketch-dark/80 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('generate')}
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 text-sketch-dark hover:text-sketch-dark/80 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    {t('profile')}
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                    className="text-red-600 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="btn-primary text-center"
                >
                  {t('login')}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
