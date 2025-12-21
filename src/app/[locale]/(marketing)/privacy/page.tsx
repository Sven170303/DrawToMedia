import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  return {
    title: t('privacy.title'),
  };
}

export default function PrivacyPage() {
  const t = useTranslations('legal');

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl sm:text-4xl text-sketch-dark mb-8">
          {t('privacy.title')}
        </h1>

        <div className="card prose prose-sketch space-y-6">
          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('privacy.collection.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('privacy.collection.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('privacy.usage.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('privacy.usage.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('privacy.storage.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('privacy.storage.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('privacy.rights.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('privacy.rights.text')}
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-sketch-dark mb-4">
              {t('privacy.cookies.title')}
            </h2>
            <p className="text-sketch-medium">
              {t('privacy.cookies.text')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
