import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Star, Users, Award, BookOpen, Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  category?: string;
  image_url?: string;
  created_at?: string;
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
    fetchCourses();
  }, [selectedLevel]);

  const fetchCourses = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedLevel !== 'All') {
        params.append('level', selectedLevel);
      }
      const response = await axios.get(`/api/courses?${params.toString()}`);
      setCourses(response.data.courses);
    } catch (error) {
      console.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const getCoursesByLevel = (level: string) => {
    if (level === 'All') return courses.slice(0, 6); // Show first 6 for overview

    return courses.filter(course => {
      const courseName = getCourseName(course);
      if (level === 'preschool') {
        return courseName.includes('روضة') ||
               courseName.includes('تمهيدي') ||
               courseName.includes('تحضيري') ||
               courseName.toLowerCase().includes('preschool') ||
               courseName.toLowerCase().includes('preparatory');
      } else if (level === 'primary') {
        return courseName.includes('ابتدائي') ||
               courseName.toLowerCase().includes('primary');
      } else if (level === 'middle') {
        return courseName.includes('متوسط') ||
               courseName.toLowerCase().includes('middle');
      } else if (level === 'high') {
        return courseName.includes('ثانوي') ||
               courseName.toLowerCase().includes('high');
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

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Parent',
      content: 'The academy has transformed my child\'s learning experience. The teachers are amazing and the curriculum is outstanding.',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'Student',
      content: 'I\'ve learned so much here. The interactive classes and supportive environment make learning enjoyable.',
      rating: 5
    },
    {
      name: 'Emily Davis',
      role: 'Parent',
      content: 'Excellent communication and regular progress updates. My child is thriving in this nurturing environment.',
      rating: 5
    }
  ];

  return (
    <div className={`w-full min-h-screen bg-gradient-luxury ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Hero Section */}
      <section className="w-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-luxury opacity-90"></div>
        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              {t('welcomeTo')}
              <span className="block bg-gradient-gold bg-clip-text text-transparent">
                {t('lawsOfSuccess')}
              </span>
              <span className="text-2xl md:text-3xl lg:text-4xl text-primary/90 font-medium">
                {t('academy')}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              {t('empoweringStudents')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/courses"
                className="px-8 py-4 bg-gradient-gold text-secondary font-bold rounded-xl hover:shadow-luxury transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
              >
                {t('exploreCourses')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="px-8 py-4 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-secondary transition-all duration-300"
                >
                  {t('joinNow')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-20 bg-background">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t('whyChooseUs')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('whyChooseUsDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-card p-6 rounded-xl shadow-luxury hover:shadow-dark transition-all duration-300 transform hover:-translate-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-primary">{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="w-full py-20 bg-secondary">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t('availableCourses')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                      selectedLevel === level.id
                        ? 'bg-primary text-primary-foreground shadow-luxury'
                        : 'bg-card text-card-foreground hover:bg-card/80'
                    }`}
                  >
                    {level.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">{t('loadingCourses')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {getCoursesByLevel(selectedLevel).map((course) => (
                  <div key={course.id} className="bg-card rounded-xl shadow-luxury overflow-hidden hover:shadow-dark transition-all duration-300 transform hover:-translate-y-2">
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground mb-2">{getCourseName(course)}</h3>
                      <p className="text-muted-foreground mb-4 line-clamp-3">{getCourseDescription(course)}</p>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">{t('price')}</span>
                          <span className="font-semibold text-primary">
                            {course.pricing_info ? course.pricing_info.display_price : `${course.price} DA`}
                          </span>
                        </div>
                        {course.pricing_info && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{t('duration')}</span>
                            <span className="font-medium text-sm">
                              {course.pricing_info.session_duration_hours ? `${course.pricing_info.session_duration_hours}h ${course.pricing_info.pricing_type === 'session' ? t('perSession') : t('monthly')}` : course.pricing_info.pricing_type === 'monthly' ? t('monthly') : t('perSession')}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRegisterClick(course.id)}
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                          'bg-gradient-gold text-secondary hover:shadow-luxury transform hover:scale-105'
                        }`}
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
                className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:shadow-luxury transition-all duration-300 transform hover:scale-105"
              >
                {t('viewAllCourses')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full py-20 bg-background">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t('whatCommunitySays')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('communitySaysDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-card p-6 rounded-xl shadow-luxury">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-primary fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <p className="font-bold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="w-full py-20 bg-secondary">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t('getInTouch')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('getInTouchDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Information */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t('email')}</h3>
                      <p className="text-muted-foreground">info@lawsofsuccess.com</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t('phone')}</h3>
                      <p className="text-muted-foreground">+1 (555) 123-4567</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t('address')}</h3>
                      <p className="text-muted-foreground">123 Education Street<br />Learning City, LC 12345</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-card rounded-xl shadow-luxury p-8">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                        {t('fullName')}
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={contactForm.name}
                        onChange={handleContactChange}
                        required
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-foreground placeholder-muted-foreground"
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                        {t('emailAddress')}
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={contactForm.email}
                        onChange={handleContactChange}
                        required
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-foreground placeholder-muted-foreground"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                      {t('subject')}
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={contactForm.subject}
                      onChange={handleContactChange}
                      required
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-foreground placeholder-muted-foreground"
                      placeholder="What's this about?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                      {t('message')}
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-foreground placeholder-muted-foreground resize-none"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-gold text-secondary py-3 px-6 rounded-lg font-medium hover:shadow-luxury transition-all duration-300 transform hover:scale-105 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin mr-2"></div>
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

      {/* Gallery Section */}
      <section id="gallery" className="w-full py-20 bg-secondary">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t('ourGallery')}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('ourGalleryDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  id: 1,
                  src: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
                  alt: 'Classroom learning',
                  category: 'Classroom'
                },
                {
                  id: 2,
                  src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop',
                  alt: 'Students collaborating',
                  category: 'Activities'
                },
                {
                  id: 3,
                  src: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop',
                  alt: 'Library study area',
                  category: 'Facilities'
                },
                {
                  id: 4,
                  src: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
                  alt: 'Science laboratory',
                  category: 'Facilities'
                },
                {
                  id: 5,
                  src: 'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=400&h=300&fit=crop',
                  alt: 'Sports activities',
                  category: 'Activities'
                },
                {
                  id: 6,
                  src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop',
                  alt: 'Graduation ceremony',
                  category: 'Events'
                }
              ].map((image) => (
                <div key={image.id} className="group relative overflow-hidden rounded-xl shadow-luxury hover:shadow-dark transition-all duration-300 transform hover:-translate-y-2">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-white font-medium">{image.alt}</p>
                      <p className="text-white/80 text-sm">{image.category}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
