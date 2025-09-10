import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, Languages } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const { language, setLanguage, isRTL, t } = useLanguage();
  const location = useLocation();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const navigation = user?.role === 'admin' ? [
    { name: t('dashboard'), href: '/admin' },
  ] : isAuthenticated ? [
    { name: t('dashboard'), href: '/dashboard' },
    { name: t('courses'), href: '/courses' },
    { name: t('about'), href: '/about' },
    { name: t('gallery'), href: '/gallery' },
    { name: t('contact'), href: '/contact' },
  ] : [
    { name: t('home'), href: '/' },
    { name: t('lawsOfSuccess'), href: '/home' },
    { name: t('littleStars'), href: '/little-stars' },
    { name: t('about'), href: '/about' },
    { name: t('courses'), href: '/courses' },
    { name: t('gallery'), href: '/gallery' },
    { name: t('contact'), href: '/contact' },
  ];

  const isActive = (href: string) => {
    return location.pathname === href;
  };

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    // For authenticated users, allow normal navigation
    if (isAuthenticated) {
      return;
    }

    // For non-authenticated users, allow access to public pages
    const publicPages = ['/', '/home', '/little-stars', '/about', '/courses', '/gallery', '/contact'];
    if (!publicPages.includes(href)) {
      e.preventDefault();
      // Only redirect to login for truly private pages
      window.location.href = '/login';
    } else {
      // For public pages, navigate normally
      window.location.href = href;
    }
  };

  return (
    <nav className={`bg-gradient-luxury backdrop-blur-sm shadow-luxury sticky top-0 z-50 border-b border-primary/20 w-full ${isRTL ? 'font-arabic' : 'font-english'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between h-20 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Logo */}
          <div className="flex items-center">
            <Link to={isAuthenticated ? "/dashboard" : "/"} className={`flex items-center ${isRTL ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
              <img
                src="/logo.png"
                alt="Laws of Success Academy"
                className="w-12 h-12 rounded-lg"
              />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <span className={`text-2xl font-bold bg-gradient-to-r from-yellow-500 via-yellow-600 to-amber-600 bg-clip-text text-transparent ${isRTL ? 'font-arabic' : 'font-english'}`}>
                  Laws of Success
                </span>
                <div className={`text-xs text-primary/80 font-medium ${isRTL ? 'font-arabic' : 'font-english'}`}>
                  Academy & Little Stars
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center flex-1 mx-8">
            {navigation.length > 0 && navigation.map((item) => (
              !isAuthenticated && !['/', '/home', '/little-stars', '/about', '/courses', '/gallery', '/contact'].includes(item.href) ? (
                <button
                  key={item.name}
                  onClick={(e) => handleNavClick(item.href, e)}
                  className={`px-4 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-300 border border-primary/20 ${isRTL ? 'font-arabic' : 'font-english'} ${
                    isActive(item.href)
                      ? 'text-primary bg-primary/10 shadow-luxury border-primary/40'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30'
                  }`}
                >
                  {item.name}
                </button>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-4 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-300 border border-primary/20 ${isRTL ? 'font-arabic' : 'font-english'} ${
                    isActive(item.href)
                      ? 'text-primary bg-primary/10 shadow-luxury border-primary/40'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30'
                  }`}
                >
                  {item.name}
                </Link>
              )
            ))}
          </div>

          {/* Auth Buttons */}
          <div className={`hidden md:flex items-center ${isRTL ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 bg-gradient-gold text-secondary hover:shadow-luxury transform hover:scale-105 ${isRTL ? 'flex-row-reverse font-arabic' : 'font-english'}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <Languages className="w-4 h-4" />
              <span className="font-semibold">
                {language === 'ar' ? 'EN' : 'عر'}
              </span>
            </button>

            {isAuthenticated ? (
              <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
                <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                  <User className="w-4 h-4 text-primary" />
                  <span className={`text-sm font-medium text-foreground ${isRTL ? 'font-arabic' : 'font-english'}`}>
                    {user?.role === 'client' ? (user?.students?.[0]?.name || user?.full_name) : user?.full_name}
                  </span>
                </div>
                <Link
                  to={user?.role === 'admin' ? '/admin' : '/dashboard'}
                  className={`px-6 py-2 bg-gradient-gold text-secondary font-medium rounded-lg hover:shadow-luxury transition-all duration-300 transform hover:scale-105 ${isRTL ? 'font-arabic' : 'font-english'}`}
                >
                  {t('dashboard')}
                </Link>
                <button
                  onClick={logout}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
                <Link
                  to="/login"
                  className={`px-6 py-2 text-foreground hover:text-primary transition-colors duration-200 ${isRTL ? 'font-arabic' : 'font-english'}`}
                >
                  {t('login')}
                </Link>
                <Link
                  to="/register"
                  className={`px-6 py-2 bg-gradient-gold text-secondary font-medium rounded-lg hover:shadow-luxury transition-all duration-300 transform hover:scale-105 ${isRTL ? 'font-arabic' : 'font-english'}`}
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors duration-200 border border-primary/20"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className={`px-4 pt-2 pb-3 space-y-1 bg-card/95 backdrop-blur-sm border-t border-primary/20 shadow-luxury ${isRTL ? 'text-right font-arabic' : 'text-left font-english'}`} dir={isRTL ? 'rtl' : 'ltr'}>
              {navigation.length > 0 && navigation.map((item) => (
                !isAuthenticated && !['/', '/home', '/little-stars', '/about', '/courses', '/gallery', '/contact'].includes(item.href) ? (
                  <button
                    key={item.name}
                    onClick={(e) => {
                      handleNavClick(item.href, e);
                      setIsOpen(false);
                    }}
                    className={`block w-full px-3 py-2 rounded-md text-base font-medium transition-all duration-200 border border-primary/20 ${isRTL ? 'text-right font-arabic' : 'text-left font-english'} ${
                      isActive(item.href)
                        ? 'text-primary bg-primary/10 border-primary/40'
                        : 'text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30'
                    }`}
                  >
                    {item.name}
                  </button>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-all duration-200 border border-primary/20 ${isRTL ? 'text-right font-arabic' : 'text-left font-english'} ${
                      isActive(item.href)
                        ? 'text-primary bg-primary/10 border-primary/40'
                        : 'text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.name}
                  </Link>
                )
              ))}

              <div className="border-t border-gray-200 pt-3 mt-3">
                {/* Language Switcher for Mobile */}
                <button
                  onClick={() => {
                    toggleLanguage();
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-3 bg-gradient-gold text-secondary rounded-lg mb-2 hover:shadow-luxury transition-all duration-300 ${isRTL ? 'flex-row-reverse font-arabic' : 'font-english'}`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Languages className="w-4 h-4" />
                    <span className="font-medium">{t('language')}</span>
                  </div>
                  <span className="font-semibold">
                    {language === 'ar' ? 'English' : 'العربية'}
                  </span>
                </button>

                {isAuthenticated ? (
                  <div className="space-y-2">
                    <div className={`px-3 py-2 text-sm text-muted-foreground bg-primary/5 rounded-lg ${isRTL ? 'text-right font-arabic' : 'text-left font-english'}`}>
                      {t('welcome')}, {user?.role === 'client' ? (user?.students?.[0]?.name || user?.full_name) : user?.full_name}
                    </div>
                    <Link
                      to={user?.role === 'admin' ? '/admin' : '/dashboard'}
                      className={`block px-3 py-3 bg-gradient-gold text-secondary rounded-lg text-center font-medium hover:shadow-luxury transition-all duration-300 ${isRTL ? 'font-arabic' : 'font-english'}`}
                      onClick={() => setIsOpen(false)}
                    >
                      {t('dashboard')}
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className={`block w-full px-3 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all duration-200 ${isRTL ? 'text-right font-arabic' : 'text-left font-english'}`}
                    >
                      {t('logout')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/login"
                      className={`block px-3 py-3 text-foreground hover:text-primary hover:bg-primary/5 rounded-lg text-center font-medium transition-all duration-200 ${isRTL ? 'font-arabic' : 'font-english'}`}
                      onClick={() => setIsOpen(false)}
                    >
                      {t('login')}
                    </Link>
                    <Link
                      to="/register"
                      className={`block px-3 py-3 bg-gradient-gold text-secondary rounded-lg text-center font-medium hover:shadow-luxury transition-all duration-300 ${isRTL ? 'font-arabic' : 'font-english'}`}
                      onClick={() => setIsOpen(false)}
                    >
                      {t('register')}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
