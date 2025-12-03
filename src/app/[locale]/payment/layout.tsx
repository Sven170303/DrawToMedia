import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

interface PaymentLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PaymentLayout({
  children,
  params,
}: PaymentLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="bg-paper-pattern min-h-screen">
      {children}
    </div>
  );
}
