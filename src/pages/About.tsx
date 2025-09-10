import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const About: React.FC = () => {
  const { t, isRTL } = useLanguage();

  return (
    <div className={`w-full min-h-screen bg-background py-20 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              {t('aboutPageTitle')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('aboutPageDesc')}
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-luxury p-8">
            <div className="prose prose-lg max-w-none">
              <p className="text-muted-foreground mb-6">
                {t('aboutPageContent')}
              </p>

              <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutMission')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('aboutMissionDesc')}
              </p>

              <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutVision')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('aboutVisionDesc')}
              </p>

              <h2 className="text-2xl font-bold text-foreground mb-4">{t('aboutValues')}</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>{t('aboutExcellence')}</li>
                <li>{t('aboutPersonalized')}</li>
                <li>{t('aboutIntegrity')}</li>
                <li>{t('aboutInnovation')}</li>
                <li>{t('aboutCommunity')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
