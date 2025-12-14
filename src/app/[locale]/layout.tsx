import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import '../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://draw-to-digital.com'),
  title: {
    default: 'Draw to Media',
    template: '%s | Draw to Media',
  },
  description: 'Verwandle deine Skizzen in digitale Kunstwerke mit KI',
  keywords: ['Skizze', 'KI', 'Kunst', 'Digital Art', 'AI Art', 'Sketch to Image'],
  authors: [{ name: 'Draw to Media' }],
  openGraph: {
    type: 'website',
    siteName: 'Draw to Media',
    title: 'Draw to Media',
    description: 'Verwandle deine Skizzen in digitale Kunstwerke mit KI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Draw to Media',
    description: 'Verwandle deine Skizzen in digitale Kunstwerke mit KI',
  },
  robots: {
    index: true,
    follow: true,
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
