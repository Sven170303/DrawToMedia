'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Sparkles,
  History,
  User,
  CreditCard,
  LogOut,
  Menu,
  X,
  Globe,
  ChevronDown,
  Coins,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, usePathname, useRouter, routing, type Locale } from '@/i18n/routing';
import { useAuth } from '@/hooks/useAuth';
import { useUserData } from '@/hooks/useUserData';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { user: userData } = useUserData(user?.id);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const credits = userData?.credits ?? 0;

  const navItems = [
    { href: '/generate' as const, label: t('navigation.generate'), icon: Sparkles },
    { href: '/history' as const, label: t('navigation.history'), icon: History },
    { href: '/profile' as const, label: t('navigation.profile'), icon: User },
    { href: '/pricing' as const, label: t('navigation.pricing'), icon: CreditCard },
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
    router.push('/');
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-white torn-edge-right z-20 pt-4 pb-6 h-screen overflow-hidden">
        {/* Logo */}
        <div className="flex items-center h-16 px-8 mb-6">
          <Link href="/" className="font-display text-2xl text-sketch-dark transform -rotate-2 hover:rotate-0 transition-transform">
            Draw to Media
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-bold transition-all relative group',
                  isActive
                    ? 'text-sketch-dark'
                    : 'text-sketch-medium hover:text-sketch-dark'
                )}
              >
                 {isActive && (
                    <div className="absolute inset-0 bg-yellow-100 -rotate-1 rounded-sm -z-10 border-2 border-sketch-dark/20" 
                         style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}></div>
                 )}
                <Icon className={cn('w-6 h-6', isActive && 'stroke-2')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Credits Card */}
        <div className="px-6 py-4 mt-auto">
          <div className="bg-white border-2 border-sketch-dark p-4 transform rotate-1" style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}>
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-sketch-dark" />
              <span className="text-sm font-bold text-sketch-medium">
                {t('profile.credits.title')}
              </span>
            </div>
            <p className="text-2xl font-display text-sketch-dark mb-3">
              {credits} {credits === 1 ? t('common.creditsSingular') : t('common.credits')}
            </p>
            <Link
              href="/pricing"
              className="btn-primary w-full block text-center text-sm py-2"
            >
              {t('profile.credits.buyMore')}
            </Link>
          </div>
        </div>

        {/* User Section */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-4 p-2 border-2 border-transparent hover:border-sketch-light/20 rounded-lg transition-colors">
            <div className="w-10 h-10 bg-sketch-dark text-white rounded-full flex items-center justify-center border-2 border-sketch-dark" style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}>
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-sketch-dark truncate">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="relative mb-3">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-sketch-medium hover:text-sketch-dark border-2 border-sketch-light/30 rounded-lg bg-white transition-all"
              style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {languageNames[locale]}
              </span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', isLangOpen && 'rotate-180')} />
            </button>

            {isLangOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg border-2 border-sketch-dark py-2 z-50 shadow-lg">
                {routing.locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => switchLocale(loc)}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm font-bold hover:bg-cream-100 transition-colors',
                      locale === loc && 'bg-yellow-50'
                    )}
                  >
                    {languageNames[loc]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border-2 border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" />
            {t('navigation.logout')}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm border-b-2 border-sketch-dark torn-edge-bottom">
        <div className="flex items-center justify-between h-16 px-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-cream-50 transition-colors"
          >
            <Menu className="w-6 h-6 text-sketch-dark" />
          </button>

          <Link href="/" className="font-display text-xl text-sketch-dark transform -rotate-2">
            Draw to Media
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 border-2 border-sketch-dark rounded-full" style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}>
              <Coins className="w-4 h-4 text-sketch-dark" />
              <span className="text-sm font-bold text-sketch-dark">{credits}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-sketch-dark/20 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-80 bg-white torn-edge-right transform transition-transform duration-300 ease-in-out pt-4 pb-6',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 mb-6">
          <Link href="/" className="font-display text-2xl text-sketch-dark transform -rotate-2">
            Draw to Media
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-cream-50 transition-colors"
          >
            <X className="w-6 h-6 text-sketch-dark" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-lg font-bold transition-all relative',
                  isActive
                    ? 'text-sketch-dark'
                    : 'text-sketch-medium hover:text-sketch-dark'
                )}
              >
                {isActive && (
                    <div className="absolute inset-0 bg-yellow-100 -rotate-1 rounded-sm -z-10 border-2 border-sketch-dark/20" 
                         style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}></div>
                 )}
                <Icon className={cn('w-6 h-6', isActive && 'stroke-2')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Credits Card */}
        <div className="px-6 py-4 mt-8">
          <div className="bg-white border-2 border-sketch-dark p-4 transform rotate-1" style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}>
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-sketch-dark" />
              <span className="text-sm font-bold text-sketch-medium">
                {t('profile.credits.title')}
              </span>
            </div>
            <p className="text-2xl font-display text-sketch-dark mb-3">
              {credits} {credits === 1 ? t('common.creditsSingular') : t('common.credits')}
            </p>
            <Link
              href="/pricing"
              onClick={() => setIsSidebarOpen(false)}
              className="btn-primary w-full block text-center text-sm py-2"
            >
              {t('profile.credits.buyMore')}
            </Link>
          </div>
        </div>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-6 bg-white torn-edge-top">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-sketch-dark text-white rounded-full flex items-center justify-center border-2 border-sketch-dark" style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}>
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-sketch-dark truncate">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Language */}
          <div className="flex gap-2 mb-4">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  switchLocale(loc);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  'flex-1 py-2 text-sm font-bold transition-colors border-2',
                  locale === loc
                    ? 'bg-sketch-dark text-cream-50 border-sketch-dark'
                    : 'bg-white text-sketch-medium border-sketch-light/30 hover:border-sketch-dark'
                )}
                style={{borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px'}}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              handleSignOut();
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border-2 border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" />
            {t('navigation.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-h-screen overflow-y-auto">
        <div className="pt-16 lg:pt-0 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
