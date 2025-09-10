import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Sparkles, Heart, BookOpen, Users, Award, ArrowRight, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const [showAnimation, setShowAnimation] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setShowAnimation(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleChoice = (choice: 'laws' | 'stars') => {
    if (choice === 'laws') {
      navigate('/home');
    } else {
      navigate('/little-stars');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-gray-100">
      {/* Professional Animated Background */}
      <div className="absolute inset-0">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/80 via-yellow-50/40 to-gray-100/80"></div>

        {/* Elegant geometric patterns */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-gray-200/20 to-yellow-200/20 rounded-full blur-3xl animate-float opacity-60"></div>
          <div className="absolute top-40 right-20 w-48 h-48 bg-gradient-to-br from-yellow-200/20 to-gray-300/20 rounded-full blur-3xl animate-float opacity-60" style={{ animationDelay: '2s', animationDuration: '8s' }}></div>
          <div className="absolute bottom-32 left-1/4 w-56 h-56 bg-gradient-to-br from-gray-300/20 to-yellow-300/20 rounded-full blur-3xl animate-float opacity-60" style={{ animationDelay: '4s', animationDuration: '10s' }}></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-gradient-to-br from-yellow-300/20 to-gray-200/20 rounded-full blur-3xl animate-float opacity-60" style={{ animationDelay: '1s', animationDuration: '9s' }}></div>
        </div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,.15) 1px, transparent 0)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-gradient-to-r from-gray-400/30 to-yellow-400/30 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Header Section */}
        <div className={`text-center mb-20 transition-all duration-1000 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-yellow-500 mr-3 animate-float" style={{ animationDuration: '4s' }} />
            <span className={`text-lg font-semibold text-gray-600 ${isRTL ? 'font-arabic' : 'font-english'}`}>
              {t('welcomeMessage')}
            </span>
            <Sparkles className="w-8 h-8 text-yellow-500 ml-3 animate-float" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          </div>

          <h1 className={`text-6xl md:text-8xl font-extrabold mb-6 ${isRTL ? 'font-arabic' : 'font-english'}`}>
            <span className="bg-gradient-to-r from-gray-600 via-yellow-600 to-gray-700 bg-clip-text text-transparent animate-gradient-x">
              {t('welcome')}
            </span>
          </h1>

          <p className={`text-xl md:text-3xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed ${isRTL ? 'font-arabic' : 'font-english'}`}>
            {t('choosePlatform')}
          </p>
        </div>

        {/* Creative Platform Selection */}
        <div className="flex flex-col lg:flex-row gap-16 max-w-7xl w-full items-center">
          {/* Laws of Success Section */}
          <div
            className={`group flex-1 text-center cursor-pointer transform transition-all duration-700 hover:scale-105 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ animationDelay: '0.2s' }}
            onClick={() => handleChoice('laws')}
          >
            {/* Large Prominent Logo */}
            <div className="relative mb-8 flex justify-center">
              <img
                src="/logo.png"
                alt="Laws of Success Logo"
                className="w-48 h-48 object-contain transform group-hover:scale-110 transition-all duration-500 drop-shadow-2xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                }}
              />
              <BookOpen className="w-48 h-48 text-gray-600 hidden" />
            </div>

            <h2 className={`text-5xl font-bold text-gray-800 mb-6 group-hover:text-gray-900 transition-colors duration-300 ${isRTL ? 'font-arabic' : 'font-english'}`}>
              {t('lawsOfSuccess')}
            </h2>

            <p className={`text-gray-600 mb-8 text-lg leading-relaxed max-w-md mx-auto ${isRTL ? 'font-arabic' : 'font-english'}`}>
              {t('lawsDescription')}
            </p>

            <div className={`flex flex-wrap justify-center gap-3 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className={`px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 rounded-full text-sm font-semibold shadow-sm ${isRTL ? 'font-arabic' : 'font-english'}`}>
                {t('educationalLevels')}
              </span>
              <span className={`px-4 py-2 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 rounded-full text-sm font-semibold shadow-sm ${isRTL ? 'font-arabic' : 'font-english'}`}>
                {t('advancedCourses')}
              </span>
              <span className={`px-4 py-2 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 rounded-full text-sm font-semibold shadow-sm ${isRTL ? 'font-arabic' : 'font-english'}`}>
                {t('continuousLearning')}
              </span>
            </div>

            <button className="bg-gradient-to-r from-gray-600 to-yellow-600 hover:from-gray-700 hover:to-yellow-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl">
              {t('startLearning')}
            </button>
          </div>

          {/* Little Stars Section */}
          <div
            className={`group flex-1 text-center cursor-pointer transform transition-all duration-700 hover:scale-105 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ animationDelay: '0.4s' }}
            onClick={() => handleChoice('stars')}
          >
            {/* Large Prominent Logo */}
            <div className="relative mb-8 flex justify-center">
              <img
                src="/stars.png"
                alt="Little Stars Logo"
                className="w-48 h-48 object-contain transform group-hover:scale-110 transition-all duration-500 drop-shadow-2xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                }}
              />
              <Star className="w-48 h-48 text-yellow-600 hidden" />
            </div>

            <h2 className={`text-5xl font-bold text-gray-800 mb-6 group-hover:text-gray-900 transition-colors duration-300 ${isRTL ? 'font-arabic' : 'font-english'}`}>
              {t('littleStars')}
            </h2>

            <p className={`text-gray-600 mb-8 text-lg leading-relaxed max-w-md mx-auto ${isRTL ? 'font-arabic' : 'font-english'}`}>
              {t('starsDescription')}
            </p>

            <div className={`flex flex-wrap justify-center gap-3 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className={`px-4 py-2 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 rounded-full text-sm font-semibold shadow-sm ${isRTL ? 'font-arabic' : 'font-english'}`}>
                {t('preschool')}
              </span>
              <span className={`px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 rounded-full text-sm font-semibold shadow-sm ${isRTL ? 'font-arabic' : 'font-english'}`}>
                {t('educationalGames')}
              </span>
              <span className={`px-4 py-2 bg-gradient-to-r from-yellow-200 to-yellow-300 text-yellow-700 rounded-full text-sm font-semibold shadow-sm ${isRTL ? 'font-arabic' : 'font-english'}`}>
                {t('funLearning')}
              </span>
            </div>

            <button className="bg-gradient-to-r from-yellow-500 to-gray-500 hover:from-yellow-600 hover:to-gray-600 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl">
              {t('startAdventure')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
