import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage, Language } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t, isRTL } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`fixed top-4 ${isRTL ? 'left-4' : 'right-4'} z-50 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 hover:scale-105`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Languages className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-medium text-gray-700">
        {language === 'ar' ? 'EN' : 'عر'}
      </span>
    </button>
  );
};

export default LanguageSwitcher;
