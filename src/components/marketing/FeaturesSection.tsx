import { useTranslations } from 'next-intl';
import { Upload, Sparkles, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FeaturesSection() {
  const t = useTranslations('landing.features');

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50 torn-edge-top torn-edge-bottom">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display text-4xl sm:text-5xl text-center text-sketch-dark mb-16 transform -rotate-1">
          {t('title')}
        </h2>

        <div className="grid md:grid-cols-3 gap-10">
          <FeatureCard
            icon={<Upload className="w-10 h-10" />}
            title={t('upload.title')}
            description={t('upload.description')}
            step={1}
            rotateClass="-rotate-2"
          />
          <FeatureCard
            icon={<Sparkles className="w-10 h-10" />}
            title={t('customize.title')}
            description={t('customize.description')}
            step={2}
            rotateClass="rotate-1"
          />
          <FeatureCard
            icon={<ImageIcon className="w-10 h-10" />}
            title={t('generate.title')}
            description={t('generate.description')}
            step={3}
            rotateClass="-rotate-1"
          />
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  step: number;
  rotateClass?: string;
}

function FeatureCard({ icon, title, description, step, rotateClass }: FeatureCardProps) {
  return (
    <div className={cn("card text-center transform transition-transform hover:scale-105 duration-300", rotateClass)}>
      <div 
        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cream-100 border-2 border-sketch-dark text-sketch-dark mb-6 shadow-sm" 
        style={{borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%'}}
      >
        {icon}
      </div>
      <div className="absolute top-4 right-4 inline-block w-8 h-8 bg-sketch-dark text-cream-50 rounded-full text-sm font-bold flex items-center justify-center border-2 border-white shadow-md">
        {step}
      </div>
      <h3 className="font-display text-2xl text-sketch-dark mb-3">{title}</h3>
      <p className="text-sketch-medium font-medium">{description}</p>
    </div>
  );
}


