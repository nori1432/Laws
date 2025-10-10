import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Star, Users, Award, BookOpen, Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getCourseName, getCourseDescription } from '../utils/courseUtils';
import axios from 'axios';
import { toast } from 'sonner';

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
  category: string;
  image_url?: string;
  session_duration_hours?: number;
}

const Home: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, [selectedLevel]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedLevel !== 'All') {
        params.append('level', selectedLevel);
      }
      console.log('🔍 Fetching courses from:', `/api/courses?${params.toString()}`);
      const response = await axios.get(`/api/courses?${params.toString()}`);
      console.log('✅ Courses loaded successfully:', response.data);
      setCourses(response.data.courses || response.data || []);
    } catch (error: any) {
      console.error('❌ Failed to load courses:', error?.response?.data || error?.message);
      // Set empty courses array on error so UI doesn't break
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const getCoursesByLevel = (level: string) => {
    if (level === 'All') return courses.slice(0, 6); // Show first 6 for overview

    return courses.filter(course => {
      const courseName = getCourseName(course, language).toLowerCase();
      if (level === 'preschool') {
        return courseName.includes('روضة') ||
               courseName.includes('تمهيدي') ||
               courseName.includes('تحضيري') ||
               courseName.includes('preschool') ||
               courseName.includes('preparatory') ||
               courseName.includes('kindergarten');
      } else if (level === 'primary') {
        return courseName.includes('ابتدائي') ||
               courseName.includes('primary') ||
               courseName.includes('elementary');
      } else if (level === 'middle') {
        return courseName.includes('متوسط') ||
               courseName.includes('middle') ||
               courseName.includes('intermediate');
      } else if (level === 'high') {
        return courseName.includes('ثانوي') ||
               courseName.includes('high') ||
               courseName.includes('secondary');
      }
      return false;
    }).slice(0, 6);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axios.post('/api/contact', contactForm);
      toast.success('Message sent successfully! We will get back to you soon.');
      setContactForm({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContactForm({
      ...contactForm,
      [e.target.name]: e.target.value
    });
  };

  const handleRegisterClick = (courseId: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      toast.info('Please login to register for courses');
    } else {
      // Handle course registration
      toast.info('Please contact the academy to register for this course');
    }
  };

  const features = [
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: 'Expert Courses',
      description: 'Learn from industry experts with comprehensive, up-to-date curriculum'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Small Classes',
      description: 'Personalized attention in small class sizes for better learning outcomes'
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Certified Programs',
      description: 'Earn recognized certificates that boost your career prospects'
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: 'Quality Education',
      description: 'Top-tier educational experience with modern teaching methods'
    }
  ];

  return (
    <div className={`w-full min-h-screen relative bg-gradient-to-br from-gray-800 via-gray-900 to-slate-900 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Responsive Background Images */}
      <div className="fixed inset-0 z-0">
        {/* Mobile/Vertical Background */}
        <img
          src="/lawsofsuccessvertical.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover md:hidden"
        />
        {/* Desktop/Horizontal Background */}
        <img
          src="/lawsofsuccesshorizontal.png"
          alt=""
          className="hidden md:block absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay for better content readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/30"></div>
      </div>

      {/* Hero Section */}
      <section className="w-full relative overflow-hidden z-10">
        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-7xl mx-auto text-center">
            {/* Decorative Elements */}
            <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-2xl">
              {t('welcomeTo')}
              <span className="block bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 bg-clip-text text-transparent animate-gradient-x">
                {t('lawsOfSuccess')}
              </span>
              <span className="text-2xl md:text-3xl lg:text-4xl text-yellow-300/90 font-medium drop-shadow-lg">
                {t('academy')}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed drop-shadow-lg">
              {t('empoweringStudents')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/courses"
                className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-xl"
              >
                {t('exploreCourses')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="px-8 py-4 backdrop-blur-md bg-white/10 border-2 border-white/50 text-white font-bold rounded-2xl hover:bg-white/20 transition-all duration-300 transform hover:scale-105 shadow-xl"
                >
                  {t('joinNow')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-20 relative z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-lg">
                {t('whyChooseUs')}
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow">
                {t('whyChooseUsDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="backdrop-blur-lg bg-white/10 p-6 rounded-2xl border border-white/20 shadow-2xl hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-3xl">
                  <div className="w-12 h-12 bg-yellow-400/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                    <div className="text-yellow-300">{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 drop-shadow">{feature.title}</h3>
                  <p className="text-white/80 drop-shadow-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="w-full py-20 relative z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-lg">
                {t('availableCourses')}
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow">
                {t('exploreCoursesDesc')}
              </p>
            </div>

            {/* Level Filter */}
            <div className="flex justify-center mb-12">
              <div className="flex flex-wrap gap-4">
                {[
                  { id: 'All', name: t('allLevels'), nameEn: 'All Levels' },
                  { id: 'preschool', name: t('preschoolLevel'), nameEn: 'Preschool' },
                  { id: 'primary', name: t('primaryLevel'), nameEn: 'Primary' },
                  { id: 'middle', name: t('middleLevel'), nameEn: 'Middle School' },
                  { id: 'high', name: t('highLevel'), nameEn: 'High School' }
                ].map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setSelectedLevel(level.id)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                      selectedLevel === level.id
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-2xl'
                        : 'backdrop-blur-md bg-white/10 text-white border border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {level.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white/80">{t('loadingCourses')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {getCoursesByLevel(selectedLevel).map((course) => (
                  <div key={course.id} className="backdrop-blur-lg bg-white/10 rounded-2xl border border-white/20 shadow-2xl overflow-hidden hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-3xl">
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-white mb-2 drop-shadow">{getCourseName(course, language)}</h3>
                      <p className="text-white/80 mb-4 line-clamp-3 drop-shadow-sm">{getCourseDescription(course, language)}</p>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-white/70">{t('price')}</span>
                          <span className="font-semibold text-yellow-300 drop-shadow">
                            {course.pricing_info ? course.pricing_info.display_price : `${course.price} DA`}
                          </span>
                        </div>
                        {course.pricing_info && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-white/70">{t('duration')}</span>
                            <span className="font-medium text-sm text-white/90">
                              {course.pricing_info.session_duration_hours ? `${course.pricing_info.session_duration_hours}h ${course.pricing_info.pricing_type === 'session' ? t('perSession') : t('monthly')}` : course.pricing_info.pricing_type === 'monthly' ? t('monthly') : t('perSession')}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRegisterClick(course.id)}
                        className="w-full py-3 px-4 rounded-xl font-medium transition-all duration-300 bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 hover:shadow-2xl transform hover:scale-105"
                      >
                        {t('registerNow')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center">
              <Link
                to="/courses"
                className="inline-flex items-center px-8 py-4 backdrop-blur-md bg-white/10 border-2 border-white/30 text-white font-bold rounded-2xl hover:bg-white/20 transition-all duration-300 transform hover:scale-105 shadow-xl"
              >
                {t('viewAllCourses')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="w-full py-20 relative z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-lg">
                {t('getInTouch')}
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow">
                {t('getInTouchDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Information */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <div className="w-12 h-12 bg-yellow-400/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Mail className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white drop-shadow">{t('email')}</h3>
                      <p className="text-white/80 drop-shadow-sm">successroadacademy@outlook.fr</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <div className="w-12 h-12 bg-yellow-400/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <Phone className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white drop-shadow">{t('phone')}</h3>
                      <p className="text-white/80 drop-shadow-sm">0791 19 74 30 / +213 791 19 74 30</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <div className="w-12 h-12 bg-yellow-400/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white drop-shadow">{t('address')}</h3>
                      <p className="text-white/80 drop-shadow-sm">CENTRE COMMERCIAL SIRABAH (قيصارية سي رابح)<br />Centre ville nedroma</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="backdrop-blur-lg bg-white/10 rounded-2xl border border-white/20 shadow-2xl p-8">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-white mb-2 drop-shadow">
                        {t('fullName')}
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={contactForm.name}
                        onChange={handleContactChange}
                        required
                        className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all duration-200 text-white placeholder-white/50"
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-white mb-2 drop-shadow">
                        {t('emailAddress')}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={contactForm.email}
                        onChange={handleContactChange}
                        required
                        className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all duration-200 text-white placeholder-white/50"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-white mb-2 drop-shadow">
                      {t('subject')}
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={contactForm.subject}
                      onChange={handleContactChange}
                      required
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all duration-200 text-white placeholder-white/50"
                      placeholder="What's this about?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-white mb-2 drop-shadow">
                      {t('message')}
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all duration-200 text-white placeholder-white/50 resize-none"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 py-3 px-6 rounded-xl font-medium hover:shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mr-2"></div>
                        {t('sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('sendMessage')}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="w-full py-20 bg-background">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t('aboutAcademy')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('aboutAcademyDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="bg-card p-6 rounded-xl shadow-luxury">
                  <h3 className="text-2xl font-bold text-foreground mb-4">{t('ourMission')}</h3>
                  <p className="text-muted-foreground">
                    {t('ourMissionDesc')}
                  </p>
                </div>

                <div className="bg-card p-6 rounded-xl shadow-luxury">
                  <h3 className="text-2xl font-bold text-foreground mb-4">{t('ourVision')}</h3>
                  <p className="text-muted-foreground">
                    {t('ourVisionDesc')}
                  </p>
                </div>
              </div>

              <div className="bg-card p-8 rounded-xl shadow-luxury">
                <h3 className="text-2xl font-bold text-foreground mb-6">{t('ourValues')}</h3>
                <ul className="space-y-4">
                  <li className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">{t('excellenceEducation')}</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">{t('personalizedLearning')}</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">{t('integrityHonesty')}</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">{t('innovationCreativity')}</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">{t('communityCollaboration')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
