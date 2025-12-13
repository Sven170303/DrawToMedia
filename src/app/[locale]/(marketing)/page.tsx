import { setRequestLocale } from 'next-intl/server';
import { HeroSection } from '@/components/marketing/HeroSection';
import { FeaturesSection } from '@/components/marketing/FeaturesSection';
import { ShowcaseSection } from '@/components/marketing/ShowcaseSection';
import { FaqSection } from '@/components/marketing/FaqSection';
import { routing } from '@/i18n/routing';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.hero' });

  const alternates = routing.locales.reduce((acc, cur) => {
    acc[cur] = `/${cur}`;
    return acc;
  }, {} as Record<string, string>);

  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: `/${locale}`,
      languages: alternates,
    },
    openGraph: {
      title: t('title'),
      description: t('subtitle'),
      siteName: 'Draw to Media',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
        },
      ],
      locale: locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('subtitle'),
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="overflow-hidden">
      <HeroSection />
      <FeaturesSection />
      <ShowcaseSection />
      <FaqSection />
    </div>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
