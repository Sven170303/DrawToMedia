import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('terms.title'),
  };
}

export default function TermsPage() {
  const t = useTranslations('legal');

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
          {t('terms.title')}
        </h1>

        <div className="card prose prose-sketch space-y-6">
          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('terms.general.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('terms.general.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('terms.usage.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('terms.usage.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('terms.credits.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('terms.credits.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('terms.liability.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('terms.liability.text')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
