import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export function HeroSection() {
  const t = useTranslations('landing.hero');

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-sketch-dark mb-6 animate-fade-in transform -rotate-1">
          {t('title')}
        </h1>
        <p className="text-xl sm:text-2xl text-sketch-medium font-medium mb-10 max-w-2xl mx-auto transform rotate-1">
          {t('subtitle')}
        </p>
        <Link 
          href="/generate" 
          className="btn-primary inline-block text-xl px-8 py-4 shadow-xl hover:rotate-2 transition-transform"
        >
          {t('cta')}
        </Link>
      </div>
    </section>
  );
}


