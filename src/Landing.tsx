import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Sparkles, Heart, BookOpen, Users, Award, ArrowRight, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Footer from '../components/Footer';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    setShowAnimation(true);
  }, []);

  const handleChoice = (choice: 'laws' | 'stars') => {
    if (choice === 'laws') {
      navigate('/home');
    } else {
      navigate('/little-stars');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      {/* Responsive Background Images */}
      <div className="absolute inset-0 z-0">
        {/* Mobile/Vertical Background */}
        <img
          src="/landingvertical.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover md:hidden"
        />
        {/* Desktop/Horizontal Background */}
        <img
          src="/landinghorizontal.png"
          alt=""
          className="hidden md:block absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Header Section */}
        <div className={`text-center mb-12 md:mb-16 transition-all duration-1000 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 mr-2 md:mr-3 animate-pulse drop-shadow-lg" />
            <span className={`text-base md:text-lg font-semibold text-white drop-shadow-lg ${isRTL ? 'font-arabic' : 'font-english'}`}>
              {t('welcomeMessage')}
            </span>
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 ml-2 md:ml-3 animate-pulse drop-shadow-lg" style={{ animationDelay: '0.5s' }} />
          </div>

          <h1 className={`text-4xl md:text-6xl lg:text-7xl font-extrabold mb-4 md:mb-6 ${isRTL ? 'font-arabic' : 'font-english'}`}>
            <span className="text-white drop-shadow-2xl">
              {t('welcome')}
            </span>
          </h1>

          <p className={`text-lg md:text-xl lg:text-2xl text-white drop-shadow-lg mb-6 max-w-2xl mx-auto leading-relaxed ${isRTL ? 'font-arabic' : 'font-english'}`}>
            {t('choosePlatform')}
          </p>
        </div>

        {/* Beautiful Widget Cards */}
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8 lg:gap-12 max-w-7xl w-full items-stretch px-2">
          {/* Laws of Success Widget */}
          <div
            className={`group flex-1 cursor-pointer transform transition-all duration-700 hover:scale-105 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ animationDelay: '0.2s' }}
            onClick={() => handleChoice('laws')}
          >
            <div className="relative h-full rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md bg-white/10 hover:bg-white/20 transition-all duration-500 border-2 border-white/30">
              {/* Content */}
              <div className="relative z-10 p-6 md:p-8 lg:p-10 flex flex-col items-center text-center h-full">
                {/* Logo */}
                <div className="relative mb-6 flex justify-center transform group-hover:scale-110 transition-transform duration-500">
                  <img
                    src="/logo.png"
                    alt="Laws of Success Logo"
                    className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain drop-shadow-2xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div className="hidden items-center justify-center w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48">
                    <BookOpen className="w-full h-full text-gray-600" />
                  </div>
                </div>

                {/* Title */}
                <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 group-hover:text-yellow-100 transition-colors duration-300 drop-shadow-lg ${isRTL ? 'font-arabic' : 'font-english'}`}>
                  {t('lawsOfSuccess')}
                </h2>

                {/* Description */}
                <p className={`text-white/90 mb-6 text-base md:text-lg leading-relaxed max-w-md mx-auto drop-shadow ${isRTL ? 'font-arabic' : 'font-english'}`}>
                  {t('lawsDescription')}
                </p>

                {/* Tags */}
                <div className={`flex flex-wrap justify-center gap-2 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`px-3 py-1.5 md:px-4 md:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-semibold shadow-md border border-white/30 ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {t('educationalLevels')}
                  </span>
                  <span className={`px-3 py-1.5 md:px-4 md:py-2 bg-yellow-500/30 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-semibold shadow-md border border-yellow-300/30 ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {t('advancedCourses')}
                  </span>
                  <span className={`px-3 py-1.5 md:px-4 md:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-semibold shadow-md border border-white/30 ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {t('continuousLearning')}
                  </span>
                </div>

                {/* Button */}
                <button className="mt-auto bg-gradient-to-r from-gray-600 to-yellow-600 hover:from-gray-700 hover:to-yellow-700 text-white font-bold py-3 px-6 md:py-4 md:px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl flex items-center gap-2">
                  <span>{t('startLearning')}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Little Stars Widget */}
          <div
            className={`group flex-1 cursor-pointer transform transition-all duration-700 hover:scale-105 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ animationDelay: '0.4s' }}
            onClick={() => handleChoice('stars')}
          >
            <div className="relative h-full rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md bg-white/10 hover:bg-white/20 transition-all duration-500 border-2 border-white/30">
              {/* Content */}
              <div className="relative z-10 p-6 md:p-8 lg:p-10 flex flex-col items-center text-center h-full">
                {/* Logo */}
                <div className="relative mb-6 flex justify-center transform group-hover:scale-110 transition-transform duration-500">
                  <img
                    src="/stars.png"
                    alt="Little Stars Logo"
                    className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain drop-shadow-2xl"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div className="hidden items-center justify-center w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48">
                    <Star className="w-full h-full text-yellow-600" />
                  </div>
                </div>

                {/* Title */}
                <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 group-hover:text-yellow-100 transition-colors duration-300 drop-shadow-lg ${isRTL ? 'font-arabic' : 'font-english'}`}>
                  {t('littleStars')}
                </h2>

                {/* Description */}
                <p className={`text-white/90 mb-6 text-base md:text-lg leading-relaxed max-w-md mx-auto drop-shadow ${isRTL ? 'font-arabic' : 'font-english'}`}>
                  {t('starsDescription')}
                </p>

                {/* Tags */}
                <div className={`flex flex-wrap justify-center gap-2 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className={`px-3 py-1.5 md:px-4 md:py-2 bg-yellow-500/30 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-semibold shadow-md border border-yellow-300/30 ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {t('preschool')}
                  </span>
                  <span className={`px-3 py-1.5 md:px-4 md:py-2 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-semibold shadow-md border border-white/30 ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {t('educationalGames')}
                  </span>
                  <span className={`px-3 py-1.5 md:px-4 md:py-2 bg-yellow-500/30 backdrop-blur-sm text-white rounded-full text-xs md:text-sm font-semibold shadow-md border border-yellow-300/30 ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {t('funLearning')}
                  </span>
                </div>

                {/* Button */}
                <button className="mt-auto bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-6 md:py-4 md:px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl flex items-center gap-2">
                  <span>{t('startAdventure')}</span>
                  <Star className="w-5 h-5 group-hover:rotate-12 transition-transform fill-current" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Decorative Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${4 + Math.random() * 3}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Landing;
