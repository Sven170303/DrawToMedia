'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function Footer() {
  const t = useTranslations('footer');
  const currentYear = new Date().getFullYear();

  const legalLinks = [
    { href: '/terms' as const, label: t('terms') },
    { href: '/privacy' as const, label: t('privacy') },
    { href: '/imprint' as const, label: t('imprint') },
    { href: '/contact' as const, label: t('contact') },
  ];

  return (
    <footer className="bg-white border-t-0 pt-12 pb-8 px-4 sm:px-6 lg:px-8 torn-edge-top mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Logo */}
          <div className="font-display text-xl text-sketch-dark transform -rotate-1">
            Draw to Media
          </div>

          {/* Legal Links */}
          <nav className="flex flex-wrap justify-center gap-6 text-sm font-bold">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sketch-medium hover:text-sketch-dark transition-colors hover:underline decoration-wavy"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-sm text-sketch-light">
            {t('copyright', { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  );
}
