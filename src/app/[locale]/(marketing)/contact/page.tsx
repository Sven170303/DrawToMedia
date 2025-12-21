import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Mail } from 'lucide-react';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('contact.title'),
  };
}

export default function ContactPage() {
  const t = useTranslations('legal');

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
          {t('contact.title')}
        </h1>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-cream-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-sketch-dark" />
            </div>
            <div>
              <h2 className="font-display text-xl text-sketch-dark mb-2">
                {t('contact.email.title')}
              </h2>
              <p className="text-sketch-medium mb-4">
                {t('contact.email.description')}
              </p>
              <a
                href="mailto:info@draw-to-digital.com"
                className="text-sketch-dark font-semibold hover:underline"
              >
                info@draw-to-digital.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
