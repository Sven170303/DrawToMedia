'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function ShowcaseSection() {
  const t = useTranslations('landing.showcase');

  // Placeholder images - in a real app these would be actual examples
  const examples = [
    {
      id: 1,
      sketch: '/images/sketch-example-1.jpg', // We need to make sure these exist or use placeholders
      result: '/images/result-example-1.jpg',
      rotate: 'rotate-1'
    },
    {
      id: 2,
      sketch: '/images/sketch-example-2.jpg',
      result: '/images/result-example-2.jpg',
      rotate: '-rotate-1'
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-display text-4xl sm:text-5xl text-center text-sketch-dark mb-4 transform rotate-1">
          {t('title')}
        </h2>
        <p className="text-center text-sketch-medium text-xl mb-16 max-w-2xl mx-auto">
          {t('subtitle')}
        </p>

        <div className="space-y-20">
          {/* Da wir noch keine echten Bilder haben, nutze ich hier Platzhalter-Divs mit CSS Patterns für die Demo */}
          <div className="grid md:grid-cols-[1fr,auto,1fr] gap-8 items-center">
            {/* Sketch Side */}
            <div className="relative group transform transition-transform hover:-rotate-1 duration-300">
              <div className="absolute -inset-2 bg-white rounded-sm shadow-md transform -rotate-1"></div>
              <div className="relative aspect-square bg-cream-100 border-2 border-sketch-medium p-4 rounded-sm flex items-center justify-center overflow-hidden">
                <div className="text-sketch-medium/50 font-handwriting text-2xl">
                    {/* Placeholder for Sketch Image */}
                    <div className="w-full h-full border-2 border-dashed border-sketch-medium/30 rounded flex items-center justify-center">
                        Sketch Placeholder
                    </div>
                </div>
                <span className="absolute bottom-2 left-2 bg-white/80 px-2 py-1 text-xs font-bold text-sketch-dark rounded shadow-sm">
                  {t('before')}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center transform md:rotate-0 rotate-90">
              <ArrowRight className="w-12 h-12 text-sketch-dark animate-pulse" />
            </div>

            {/* Result Side */}
            <div className="relative group transform transition-transform hover:rotate-1 duration-300">
              <div className="absolute -inset-2 bg-white rounded-sm shadow-xl transform rotate-1"></div>
              <div className="relative aspect-square bg-gradient-to-br from-purple-100 to-blue-100 border-4 border-white shadow-lg rounded-sm overflow-hidden">
                 {/* Placeholder for Result Image */}
                 <div className="w-full h-full flex items-center justify-center text-purple-800/50 font-bold text-xl">
                    AI Result Placeholder
                 </div>
                <span className="absolute bottom-2 right-2 bg-sketch-dark/80 text-white px-2 py-1 text-xs font-bold rounded shadow-sm">
                  {t('after')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


