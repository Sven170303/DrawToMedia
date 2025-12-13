'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FaqSection() {
  const t = useTranslations('landing.faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { id: 'copyright' },
    { id: 'format' },
    { id: 'privacy' },
    { id: 'credits' }
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-cream-50 torn-edge-top">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-4xl sm:text-5xl text-center text-sketch-dark mb-16 transform -rotate-1">
          {t('title')}
        </h2>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div 
              key={faq.id}
              className={cn(
                "bg-white border-2 border-sketch-medium rounded-lg overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md",
                openIndex === index ? "transform -rotate-1" : "transform hover:rotate-1"
              )}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-6 py-4 flex items-center justify-between bg-white text-left"
              >
                <span className="font-display text-xl text-sketch-dark">
                  {t(`items.${faq.id}.question`)}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-6 h-6 text-sketch-medium" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-sketch-medium" />
                )}
              </button>
              
              <div 
                className={cn(
                  "px-6 text-sketch-medium leading-relaxed overflow-hidden transition-all duration-300",
                  openIndex === index ? "max-h-40 py-4 border-t-2 border-sketch-medium/10" : "max-h-0"
                )}
              >
                {t(`items.${faq.id}.answer`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


