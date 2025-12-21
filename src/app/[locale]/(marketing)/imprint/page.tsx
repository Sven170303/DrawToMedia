import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('imprint.title'),
  };
}

export default function ImprintPage() {
  const t = useTranslations('legal');

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
          {t('imprint.title')}
        </h1>

        <div className="card prose prose-sketch">
          <h2 className="font-display text-xl text-sketch-dark mb-4">
            {t('imprint.company.title')}
          </h2>
          <p className="text-sketch-medium mb-6">
            Draw to Digital Media<br />
            {t('imprint.company.address')}
          </p>

          <h2 className="font-display text-xl text-sketch-dark mb-4">
            {t('imprint.contact.title')}
          </h2>
          <p className="text-sketch-medium mb-6">
            {t('imprint.contact.email')}: info@draw-to-digital.com
          </p>

          <h2 className="font-display text-xl text-sketch-dark mb-4">
            {t('imprint.responsibility.title')}
          </h2>
          <p className="text-sketch-medium">
            {t('imprint.responsibility.text')}
          </p>
        </div>
      </div>
    </div>
  );
}
