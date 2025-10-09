import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Star, Sparkles, Sun, Moon, Cloud, Rainbow, Flower, Bird, Music, Palette, BookOpen, Users, Award, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import Footer from '../components/Footer';

interface Course {
  id: number;
  name: string;
  name_en?: string;
  name_ar?: string;
  description: string;
  description_en?: string;
  description_ar?: string;
  price: number;
  pricing_info?: {
    pricing_type: string;
    currency: string;
    session_price?: number;
    monthly_price?: number;
    session_duration_hours?: number;
    display_price: string;
  };
  max_students: number;
  available_seats: number;
  is_active: boolean;
  category?: string;
  image_url?: string;
  created_at?: string;
}

const LittleStars: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);

  // Helper functions for multilingual content
  const getCourseName = (course: Course): string => {
    if (language === 'ar' && course.name_ar) {
      return course.name_ar;
    }
    return course.name_en || course.name;
  };

  const getCourseDescription = (course: Course): string => {
    if (language === 'ar' && course.description_ar) {
      return course.description_ar;
    }
    return course.description_en || course.description;
  };

  useEffect(() => {
    setShowAnimation(true);
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching preschool courses from:', '/api/courses?level=preschool');
      const response = await axios.get('/api/courses?level=preschool');
      console.log('✅ Preschool courses loaded successfully:', response.data);
      const coursesData = response.data.courses || response.data || [];
      setCourses(Array.isArray(coursesData) ? coursesData.slice(0, 6) : []);
    } catch (error: any) {
      console.error('❌ Failed to load preschool courses:', error?.response?.data || error?.message);
      // Set empty courses array on error so UI doesn't break
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = (courseId: number) => {
    if (isAuthenticated) {
      navigate('/courses');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Responsive Background Images */}
      <div className="fixed inset-0 z-0">
        {/* Mobile/Vertical Background */}
        <img
          src="/littlestarsvertical.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover md:hidden"
        />
        {/* Desktop/Horizontal Background */}
        <img
          src="/littlestarshorizontal.png"
          alt=""
          className="hidden md:block absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay for better content readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/30"></div>
      </div>

      {/* Modern Background Elements - Kept for additional decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Subtle geometric shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-yellow-200/10 to-amber-200/10 rounded-full blur-2xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-br from-gray-300/10 to-gray-400/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-gradient-to-br from-amber-200/10 to-yellow-200/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-gradient-to-br from-gray-400/10 to-gray-300/10 rounded-full blur-2xl"></div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-gradient-to-r from-yellow-300/30 to-amber-300/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${4 + Math.random() * 2}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className={`relative z-10 transition-all duration-1000 ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center py-16 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Decorative Elements */}
            <div className="absolute top-10 left-10 w-24 h-24 bg-yellow-300/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-orange-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            {/* Modern Logo/Brand */}
            <div className="mb-8">
              <div className="relative inline-block">
                <img
                  src="/stars.png"
                  alt="Little Stars Logo"
                  className="w-24 h-24 md:w-32 md:h-32 object-contain mx-auto mb-6 drop-shadow-2xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                  }}
                />
                <Star className="w-24 h-24 md:w-32 md:h-32 text-amber-400 hidden mx-auto mb-6 fill-current drop-shadow-2xl" />
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-2xl">
              <span className="bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 bg-clip-text text-transparent">
                {t('littleStarsTitle')}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white mb-8 font-medium leading-relaxed drop-shadow-lg">
              {t('littleStarsSubtitle')}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="flex items-center space-x-2 rtl:space-x-reverse backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <Heart className="w-6 h-6 text-rose-300 fill-current" />
                <span className="text-lg font-medium text-white drop-shadow">{t('love')}</span>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <Star className="w-6 h-6 text-amber-300 fill-current" />
                <span className="text-lg font-medium text-white drop-shadow">{t('learning')}</span>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                <span className="text-lg font-medium text-white drop-shadow">{t('growth')}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="backdrop-blur-lg bg-white/10 rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 text-center drop-shadow-lg">
              {t('magicalLearningGarden')}
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-10 leading-relaxed text-center max-w-4xl mx-auto drop-shadow">
              {t('magicalGardenDescription')}
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-10">
              <div className="backdrop-blur-md bg-amber-400/20 rounded-2xl p-6 border border-amber-300/30 hover:bg-amber-400/30 transition-all duration-300 transform hover:-translate-y-2 shadow-xl">
                <Music className="w-12 h-12 text-amber-200 mx-auto mb-4 drop-shadow" />
                <h3 className="text-xl font-bold text-white mb-3 text-center drop-shadow">{t('musicAndArts')}</h3>
                <p className="text-white/90 text-center leading-relaxed drop-shadow-sm">{t('musicAndArtsDesc')}</p>
              </div>

              <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-2 shadow-xl">
                <BookOpen className="w-12 h-12 text-white mx-auto mb-4 drop-shadow" />
                <h3 className="text-xl font-bold text-white mb-3 text-center drop-shadow">{t('storyTime')}</h3>
                <p className="text-white/90 text-center leading-relaxed drop-shadow-sm">{t('storyTimeDesc')}</p>
              </div>

              <div className="backdrop-blur-md bg-yellow-400/20 rounded-2xl p-6 border border-yellow-300/30 hover:bg-yellow-400/30 transition-all duration-300 transform hover:-translate-y-2 shadow-xl">
                <Users className="w-12 h-12 text-yellow-200 mx-auto mb-4 drop-shadow" />
                <h3 className="text-xl font-bold text-white mb-3 text-center drop-shadow">{t('playAndLearn')}</h3>
                <p className="text-white/90 text-center leading-relaxed drop-shadow-sm">{t('playAndLearnDesc')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                to="/courses?level=preschool"
                className="bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 flex items-center gap-3 shadow-xl"
              >
                <Star className="w-6 h-6 fill-current" />
                <span>{t('exploreMagicalCourses')}</span>
                <ArrowRight className="w-6 h-6" />
              </Link>

              <Link
                to="/contact"
                className="backdrop-blur-md bg-white/10 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all duration-300 hover:scale-105 border-2 border-white/30 shadow-xl"
              >
                {t('talkToStarTeam')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="relative z-10 px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-lg">
              {t('magicalLearningAdventures')}
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto leading-relaxed drop-shadow">
              {t('magicalAdventuresDesc')}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-yellow-300 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg drop-shadow">{t('loadingMagicalCourses')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course, index) => (
                <div
                  key={course.id}
                  className="backdrop-blur-lg bg-white/10 rounded-3xl p-6 shadow-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-amber-400/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-300/30">
                      <div className="text-2xl drop-shadow">
                        {index % 4 === 0 ? '🌟' : index % 4 === 1 ? '🎨' : index % 4 === 2 ? '🎵' : '🌈'}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 drop-shadow">{getCourseName(course)}</h3>
                    <p className="text-white/80 text-sm leading-relaxed drop-shadow-sm">{getCourseDescription(course)}</p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/70 font-medium">{t('price')}:</span>
                      <span className="font-bold text-amber-300 drop-shadow">
                        {course.pricing_info ? course.pricing_info.display_price : `${course.price} DA`}
                      </span>
                    </div>
                    {course.pricing_info && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/70 font-medium">Duration:</span>
                        <span className="font-bold text-amber-300 drop-shadow">
                          {course.pricing_info.session_duration_hours ? `${course.pricing_info.session_duration_hours}h ${course.pricing_info.pricing_type === 'session' ? 'per session' : 'monthly'}` : course.pricing_info.pricing_type === 'monthly' ? 'monthly' : 'per session'}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRegisterClick(course.id)}
                    className="w-full py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105 bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 hover:shadow-2xl"
                  >
                    {t('joinAdventure')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/courses?level=preschool"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105 gap-3"
            >
              <Sparkles className="w-6 h-6" />
              {t('discoverMoreAdventures')}
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </section>

      {/* Fun Facts Section */}
      <section className="relative z-10 px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-xl border border-gray-200/50">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-10">
              {t('didYouKnow')}
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/50">
                <div className="text-5xl mb-4">🧠</div>
                <h3 className="text-xl font-bold text-amber-800 mb-3">{t('brainDevelopment')}</h3>
                <p className="text-amber-700 leading-relaxed">
                  {t('brainDevelopmentDesc')}
                </p>
              </div>

              <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/50">
                <div className="text-5xl mb-4">🎨</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{t('creativeLearning')}</h3>
                <p className="text-gray-700 leading-relaxed">
                  {t('creativeLearningDesc')}
                </p>
              </div>

              <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200/50">
                <div className="text-5xl mb-4">👫</div>
                <h3 className="text-xl font-bold text-yellow-800 mb-3">{t('socialSkills')}</h3>
                <p className="text-yellow-700 leading-relaxed">
                  {t('socialSkillsDesc')}
                </p>
              </div>

              <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300/50">
                <div className="text-5xl mb-4">🌟</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{t('confidenceBuilding')}</h3>
                <p className="text-gray-700 leading-relaxed">
                  {t('confidenceBuildingDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LittleStars;
