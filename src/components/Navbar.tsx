import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, Globe, ChevronDown, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ProfilePictureUploader from './ProfilePictureUploader';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  let authState;
  try {
    authState = useAuth();
  } catch (error) {
    console.error('❌ Navbar: useAuth error:', error);
    return (
      <nav className="bg-neutral-950 border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-amber-500">
                Laws of Success Academy
              </Link>
            </div>
            <div className="text-neutral-400 text-sm flex items-center">Loading...</div>
          </div>
        </div>
      </nav>
    );
  }
  
  const { user, logout, isAuthenticated } = authState;
  const { language, setLanguage, isRTL, t } = useLanguage();
  const location = useLocation();

  const toggleLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');

  const navigation = user?.role === 'admin' ? [
    { name: t('dashboard'), href: '/admin' },
  ] : isAuthenticated ? [
    { name: t('dashboard'), href: '/dashboard' },
    { name: t('courses'), href: '/courses' },
    { name: t('about'), href: '/about' },
    { name: t('contact'), href: '/contact' },
  ] : [
    { name: t('home'), href: '/' },
    { name: t('lawsOfSuccess'), href: '/home' },
    { name: t('littleStars'), href: '/little-stars' },
    { name: 'المسابقة', href: '/competition', special: true },
    { name: t('about'), href: '/about' },
    { name: t('courses'), href: '/courses' },
    { name: t('contact'), href: '/contact' },
  ];

  const isActive = (href: string) => location.pathname === href;

  const publicPages = ['/', '/home', '/little-stars', '/about', '/courses', '/contact', '/competition'];
  
  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (isAuthenticated) return;
    if (!publicPages.includes(href)) {
      e.preventDefault();
      window.location.href = '/login';
    }
  };

  return (
    <nav className={`bg-neutral-950 sticky top-0 z-50 border-b border-amber-500/30 ${isRTL ? 'font-arabic' : 'font-english'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Golden accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center h-16 ${isRTL ? 'flex-row-reverse' : ''}`}>
          
          {/* Logo */}
          <Link to={isAuthenticated ? "/dashboard" : "/"} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-lg" />
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <span className="text-lg font-bold text-amber-500">Laws of Success</span>
              <div className="text-[10px] text-neutral-400 font-medium tracking-wide">ACADEMY & LITTLE STARS</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className={`hidden lg:flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {navigation.map((item: any) => (
              item.special ? (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`relative px-4 py-2 text-sm font-semibold transition-all duration-300 rounded-lg flex items-center gap-2 ${
                    isActive(item.href)
                      ? 'text-neutral-900 bg-gradient-to-r from-amber-400 to-yellow-500'
                      : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/30'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  {item.name}
                </Link>
              ) : !isAuthenticated && !publicPages.includes(item.href) ? (
                <button
                  key={item.name}
                  onClick={(e) => handleNavClick(item.href, e)}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                    isActive(item.href)
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.name}
                </button>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                    isActive(item.href)
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.name}
                </Link>
              )
            ))}
          </div>

          {/* Right Section */}
          <div className={`hidden lg:flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {isAuthenticated ? (
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* User Info */}
                <div className={`flex items-center gap-2 px-3 py-1.5 bg-neutral-900 rounded-lg border border-neutral-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <ProfilePictureUploader currentImageUrl={user?.profile_picture_url} size="sm" editable={false} className="flex-shrink-0" />
                  <span className="text-sm font-medium text-neutral-200 max-w-[100px] truncate">
                    {user?.role === 'client' ? (user?.students?.[0]?.name || user?.full_name) : user?.full_name}
                  </span>
                </div>
                
                {/* Dashboard Button */}
                <Link
                  to={user?.role === 'admin' ? '/admin' : '/dashboard'}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-900 text-sm font-bold rounded-lg hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300"
                >
                  {t('dashboard')}
                </Link>
                
                {/* Logout */}
                <button onClick={logout} className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-all">
                  {t('login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-900 text-sm font-bold rounded-lg hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden border-t border-neutral-800 py-4 space-y-1">
            {navigation.map((item: any) => (
              item.special ? (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 text-base font-semibold rounded-lg mx-2 ${
                    isActive(item.href)
                      ? 'text-neutral-900 bg-gradient-to-r from-amber-400 to-yellow-500'
                      : 'text-amber-400 border border-amber-500/30'
                  }`}
                >
                  <Award className="w-5 h-5" />
                  {item.name}
                </Link>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 text-base font-medium rounded-lg mx-2 transition-all ${
                    isActive(item.href)
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.name}
                </Link>
              )
            ))}

            <div className="border-t border-neutral-800 mt-4 pt-4 mx-2 space-y-3">
              {/* Language Switcher Mobile */}
              <button
                onClick={() => { toggleLanguage(); setIsOpen(false); }}
                className="flex items-center justify-between w-full px-4 py-3 bg-neutral-900 text-neutral-300 rounded-lg border border-neutral-800"
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  {t('language')}
                </span>
                <span className="font-bold text-amber-500">{language === 'ar' ? 'English' : 'العربية'}</span>
              </button>

              {isAuthenticated ? (
                <>
                  <div className="px-4 py-3 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-3">
                    <ProfilePictureUploader currentImageUrl={user?.profile_picture_url} size="sm" editable={false} />
                    <span className="text-neutral-200 font-medium">
                      {user?.role === 'client' ? (user?.students?.[0]?.name || user?.full_name) : user?.full_name}
                    </span>
                  </div>
                  <Link
                    to={user?.role === 'admin' ? '/admin' : '/dashboard'}
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-900 rounded-lg text-center font-bold"
                  >
                    {t('dashboard')}
                  </Link>
                  <button
                    onClick={() => { logout(); setIsOpen(false); }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg font-medium"
                  >
                    <LogOut className="w-5 h-5" />
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 text-neutral-300 hover:text-white rounded-lg text-center font-medium border border-neutral-700"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-900 rounded-lg text-center font-bold"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
