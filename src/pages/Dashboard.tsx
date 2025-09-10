import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslatedCategory } from '../utils/categoryUtils';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BookOpen,
  Calendar,
  CreditCard,
  User,
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  TrendingUp,
  MessageSquare,
  Settings,
  Bell,
  DollarSign,
  Users as UsersIcon,
  Award,
  Search
} from 'lucide-react';

interface Registration {
  id: number;
  course: {
    id: number;
    name: string;
    name_en?: string;
    name_ar?: string;
    description: string;
    price: number;
    image_url?: string;
  };
  student: {
    id: number;
    name: string;
    date_of_birth: string;
  };
  status: string;
  notes: string;
  created_at: string;
}

interface SectionEnrollment {
  enrollment_id: number;
  section: {
    id: number;
    course_id: number;
    section_name: string;
    schedule: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
  };
  course: {
    id: number;
    name: string;
    name_en?: string;
    name_ar?: string;
    description: string;
    price: number;
    currency: string;
  };
  enrolled_at: string;
}

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

interface PaymentInfo {
  next_payment_due?: string;
  amount_due?: number;
  last_payment_date?: string;
  total_paid?: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { translateCategory, getCategoryColors } = useTranslatedCategory();
  const [activeTab, setActiveTab] = useState('overview');
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  // Helper functions for multilingual content
  const getCourseName = (course: Course | {name: string, name_en?: string, name_ar?: string}): string => {
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
  const [sectionEnrollments, setSectionEnrollments] = useState<SectionEnrollment[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({});
  const [loading, setLoading] = useState(true);
  const [registrationError, setRegistrationError] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedPricingType, setSelectedPricingType] = useState('All');
  const [filteredAvailableCourses, setFilteredAvailableCourses] = useState<Course[]>([]);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Filter available courses based on search and filter criteria
  useEffect(() => {
    let filtered = availableCourses;

    // Filter out courses the user is already registered for
    const registeredCourseIds = registrations.map(reg => reg.course.id);
    filtered = filtered.filter(course => 
      !registeredCourseIds.includes(course.id) && course.available_seats > 0
    );

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(course =>
        getCourseName(course).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCourseDescription(course).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(course => course.category === selectedCategory);
    }

    // Filter by level
    if (selectedLevel !== 'All') {
      filtered = filtered.filter(course => {
        const courseName = getCourseName(course);
        if (selectedLevel === 'preschool') {
          return courseName.includes('روضة') ||
                 courseName.includes('تمهيدي') ||
                 courseName.includes('تحضيري') ||
                 courseName.toLowerCase().includes('preschool') ||
                 courseName.toLowerCase().includes('preparatory');
        } else if (selectedLevel === 'primary') {
          return courseName.includes('ابتدائي') ||
                 courseName.toLowerCase().includes('primary');
        } else if (selectedLevel === 'middle') {
          return courseName.includes('متوسط') ||
                 courseName.toLowerCase().includes('middle');
        } else if (selectedLevel === 'high') {
          return courseName.includes('ثانوي') ||
                 courseName.toLowerCase().includes('high');
        }
        return false;
      });
    }

    // Filter by subject
    if (selectedSubject !== 'All') {
      filtered = filtered.filter(course => 
        getCourseName(course).includes(selectedSubject)
      );
    }

    // Filter by pricing type
    if (selectedPricingType !== 'All') {
      filtered = filtered.filter(course =>
        course.pricing_info?.pricing_type === selectedPricingType
      );
    }

    setFilteredAvailableCourses(filtered);
  }, [availableCourses, registrations, searchTerm, selectedCategory, selectedLevel, selectedGrade, selectedSubject, selectedPricingType]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setRegistrationError(false);
    try {
      const [regsRes, coursesRes, paymentRes, enrollmentsRes] = await Promise.all([
        axios.get('/api/courses/my-registrations').catch((error) => {
          console.error('Failed to fetch registrations:', error);
          if (error.response?.status === 503) {
            setRegistrationError(true);
            return { data: { registrations: [] } };
          }
          setRegistrationError(true);
          return { data: { registrations: [] } }; // Return empty array on error
        }),
        axios.get('/api/courses').catch((error) => {
          console.error('Failed to fetch courses:', error);
          return { data: { courses: [] } }; // Return empty array on error
        }),
        axios.get('/api/courses/payment-info').catch(() => ({ data: {} })), // Graceful fallback
        axios.get('/api/courses/my-enrollments').catch((error) => {
          console.error('Failed to fetch section enrollments:', error);
          return { data: { enrollments: [] } }; // Return empty array on error
        })
      ]);

      setRegistrations(regsRes.data.registrations || []);
      setAvailableCourses(coursesRes.data.courses || []);
      setPaymentInfo(paymentRes.data || {});
      setSectionEnrollments(enrollmentsRes.data.enrollments || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error(t('failedToLoadData'));
      // Set empty arrays to prevent crashes
      setRegistrations([]);
      setAvailableCourses([]);
      setPaymentInfo({});
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmittingContact(true);
    try {
      await axios.post('/api/contact', {
        name: user.full_name,
        email: user.email,
        subject: contactForm.subject,
        message: contactForm.message
      });
      toast.success(t('messageSent'));
      setContactForm({ subject: '', message: '' });
    } catch (error) {
      toast.error(t('failedToSendMessage'));
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleRegisterForCourse = async (courseId: number) => {
    try {
      const response = await axios.post('/api/courses/register', {
        course_id: courseId,
        student_id: user?.id // Use the logged-in user's ID directly
      });

      toast.success(t('registrationSuccessful'));
      // Refresh dashboard data to update the UI
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('registrationFailed'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-luxury flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('accessDenied')}</h1>
          <p className="text-muted-foreground">{t('pleaseLoginDashboard')}</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: t('overviewTab'), icon: TrendingUp },
    { id: 'courses', name: t('myCoursesTab'), icon: BookOpen },
    { id: 'sections', name: t('mySectionsTab'), icon: Calendar },
    { id: 'available', name: t('availableCoursesTab'), icon: Star },
    { id: 'payments', name: t('paymentsTab'), icon: CreditCard },
    { id: 'contact', name: t('contactTab'), icon: MessageSquare },
    { id: 'profile', name: t('profileTab'), icon: User },
  ];

  return (
    <div className="min-h-screen bg-gradient-luxury">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-gold bg-clip-text text-transparent">
                {t('welcomeBack')}, {user.full_name}!
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {t('dashboardSubtitle')}
              </p>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                title={t('refreshData')}
              >
                <svg className={`w-4 h-4 md:w-5 md:h-5 text-primary ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                <Bell className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </button>
              <button className="p-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                <Settings className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-card rounded-lg p-1 border border-border overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-gradient-gold text-secondary shadow-luxury'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                  <div className="flex items-center">
                    <div className="p-2 md:p-3 bg-gradient-gold rounded-lg">
                      <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-xs md:text-sm text-muted-foreground">{t('totalCoursesStat')}</p>
                      <p className="text-xl md:text-2xl font-bold text-foreground">{registrations.length + sectionEnrollments.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                  <div className="flex items-center">
                    <div className="p-2 md:p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-xs md:text-sm text-muted-foreground">{t('approvedStat')}</p>
                      <p className="text-xl md:text-2xl font-bold text-foreground">
                        {registrations.filter(r => r.status === 'approved').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                  <div className="flex items-center">
                    <div className="p-2 md:p-3 bg-yellow-100 rounded-lg">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-xs md:text-sm text-muted-foreground">{t('pendingStat')}</p>
                      <p className="text-xl md:text-2xl font-bold text-foreground">
                        {registrations.filter(r => r.status === 'pending').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                  <div className="flex items-center">
                    <div className="p-2 md:p-3 bg-blue-100 rounded-lg">
                      <UsersIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                    </div>
                    <div className="ml-3 md:ml-4">
                      <p className="text-xs md:text-sm text-muted-foreground">{t('studentsStat')}</p>
                      <p className="text-xl md:text-2xl font-bold text-foreground">
                        {new Set(registrations.map(r => r.student.id)).size}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Status */}
                <div className="bg-card rounded-xl shadow-luxury p-6 border border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-primary" />
                    {t('paymentStatus')}
                  </h3>
                  {paymentInfo.next_payment_due ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t('nextPaymentDueLabel')}</span>
                        <span className="font-semibold text-foreground">
                          {new Date(paymentInfo.next_payment_due).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">{t('amountDueLabel')}</span>
                        <span className="font-semibold text-primary">{paymentInfo.amount_due} DA</span>
                      </div>
                      <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-800">
                          💳 Please ensure payment is made before the due date to avoid any interruptions.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">All payments are up to date!</p>
                    </div>
                  )}

                  {/* Pending Courses Warning */}
                  {registrations.filter(r => r.status === 'pending').length > 0 && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-orange-800 mb-1">
                            Pending Course Registrations
                          </p>
                          <p className="text-sm text-orange-700 mb-2">
                            You have {registrations.filter(r => r.status === 'pending').length} course(s) with pending registration status.
                          </p>
                          <p className="text-sm text-orange-700">
                            Please complete payment and confirmation to secure your place. Contact us at 📞 0549322594 for assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-card rounded-xl shadow-luxury p-6 border border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                    {t('recentActivity')}
                  </h3>
                  <div className="space-y-3">
                    {registrations.slice(0, 3).map((reg) => (
                      <div key={reg.id} className="flex items-center space-x-3 p-3 bg-background rounded-lg">
                        <div className={`p-2 rounded-full ${getStatusColor(reg.status)}`}>
                          {getStatusIcon(reg.status)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground text-sm">{getCourseName(reg.course)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(reg.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {registrations.length === 0 && (
                      <div className="text-center py-4">
                        <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{t('noRecentActivity')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">{t('myCourseRegistrations')}</h2>
                <p className="text-muted-foreground mt-1">{t('trackEnrolledCourses')}</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">{t('loadingCourses')}</p>
                  </div>
                ) : registrations.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{t('noCourseRegistrations')}</p>
                    <button
                      onClick={() => setActiveTab('available')}
                      className="px-6 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300"
                    >
                      {t('browseAvailableCourses')}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {registrations.map((registration) => (
                      <div key={registration.id} className="bg-background rounded-lg p-6 border border-border hover:shadow-md transition-shadow duration-200">
                        {registration.course.image_url && (
                          <div className="mb-4">
                            <img
                              src={registration.course.image_url}
                              alt={getCourseName(registration.course)}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground mb-1">
                              {getCourseName(registration.course)}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {t('studentLabel')} {registration.student.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t('priceLabel')} ${registration.course.price}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(registration.status)} flex items-center space-x-1`}>
                            {getStatusIcon(registration.status)}
                            <span>{registration.status === 'approved' ? t('approvedStatus') : registration.status === 'pending' ? t('pendingStatus') : registration.status === 'rejected' ? t('rejectedStatus') : registration.status}</span>
                          </div>
                        </div>
                        {registration.notes && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">{registration.notes}</p>
                          </div>
                        )}
                        {registration.status === 'pending' && (
                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                              <strong>{t('seatReserved')}</strong> {t('comeToAcademy')}
                            </p>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              <strong>{t('contactInfo')}</strong>
                            </p>
                          </div>
                        )}
                        <div className="mt-4 flex items-center text-xs text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-1" />
                          {t('registeredLabel')} {new Date(registration.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">{t('mySectionEnrollments')}</h2>
                <p className="text-muted-foreground mt-1">{t('trackEnrolledSections')}</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">{t('loadingSections')}</p>
                  </div>
                ) : sectionEnrollments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{t('noSectionEnrollments')}</p>
                    <button
                      onClick={() => setActiveTab('available')}
                      className="px-6 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300"
                    >
                      Browse Available Courses
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sectionEnrollments.map((enrollment) => (
                      <div key={enrollment.enrollment_id} className="bg-background rounded-lg p-6 border border-border hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground mb-1">
                              {getCourseName(enrollment.course)} - {enrollment.section.section_name}
                            </h3>
                            <p className="text-sm font-medium text-primary mb-2">
                              {enrollment.section.schedule}
                            </p>
                            <p className="text-sm text-muted-foreground mb-2">
                              {enrollment.section.schedule}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t('priceLabel')} {enrollment.course.price} {enrollment.course.currency}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            enrollment.section.is_active
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}>
                            {enrollment.section.is_active ? t('activeLabel') : t('inactiveLabel')}
                          </div>
                        </div>
                        {enrollment.section.start_date && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <strong>{t('startDateLabel')}</strong> {new Date(enrollment.section.start_date).toLocaleDateString()}
                              {enrollment.section.end_date && (
                                <span> - <strong>{t('endDateLabel')}</strong> {new Date(enrollment.section.end_date).toLocaleDateString()}</span>
                              )}
                            </p>
                          </div>
                        )}
                        <div className="mt-4 flex items-center text-xs text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-1" />
                          {t('enrolledLabel')} {new Date(enrollment.enrolled_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'available' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">{t('availableCoursesTitle')}</h2>
                <p className="text-muted-foreground mt-1">{t('availableCoursesDesc')}</p>
              </div>
              
              {/* Search and Filter Section */}
              <div className="p-6 border-b border-border bg-background/50">
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex-1">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder={t('searchCourses')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Advanced Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Educational Level Filter */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t('filterByLevel')}
                      </label>
                      <select
                        value={selectedLevel}
                        onChange={(e) => {
                          setSelectedLevel(e.target.value);
                          setSelectedGrade('All'); // Reset grade when level changes
                          setSelectedSubject('All'); // Reset subject when level changes
                        }}
                        className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="All">{t('allLevelsCourses')}</option>
                        <option value="preschool">روضة</option>
                        <option value="primary">ابتدائي</option>
                        <option value="middle">متوسط</option>
                        <option value="high">ثانوي</option>
                      </select>
                    </div>

                    {/* Subject Filter */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t('filterBySubject')}
                      </label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        disabled={selectedLevel === 'All'}
                      >
                        <option value="All">{t('allSubjects')}</option>
                        {selectedLevel === 'preschool' && (
                          <>
                            <option value="الرياضيات">الرياضيات</option>
                            <option value="اللغة العربية">اللغة العربية</option>
                            <option value="اللغة الإنجليزية">اللغة الإنجليزية</option>
                          </>
                        )}
                        {selectedLevel === 'primary' && (
                          <>
                            <option value="الرياضيات">الرياضيات</option>
                            <option value="اللغة العربية">اللغة العربية</option>
                            <option value="العلوم">العلوم</option>
                            <option value="الدراسات الاجتماعية">الدراسات الاجتماعية</option>
                          </>
                        )}
                        {selectedLevel === 'middle' && (
                          <>
                            <option value="الرياضيات">الرياضيات</option>
                            <option value="الفيزياء">الفيزياء</option>
                            <option value="الكيمياء">الكيمياء</option>
                            <option value="الأحياء">الأحياء</option>
                          </>
                        )}
                        {selectedLevel === 'high' && (
                          <>
                            <option value="الرياضيات">الرياضيات</option>
                            <option value="الفيزياء">الفيزياء</option>
                            <option value="الكيمياء">الكيمياء</option>
                            <option value="الأحياء">الأحياء</option>
                            <option value="الفلسفة">الفلسفة</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t('courseCategory')}
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="All">{t('allCategories')}</option>
                        <option value="academic">{t('academicCategory')}</option>
                        <option value="skill">{t('skillsCategory')}</option>
                        <option value="language">{t('languagesCategory')}</option>
                      </select>
                    </div>

                    {/* Pricing Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t('pricingTypeLabel')}
                      </label>
                      <select
                        value={selectedPricingType}
                        onChange={(e) => setSelectedPricingType(e.target.value)}
                        className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="All">{t('allPricingTypes')}</option>
                        <option value="session">حسب الحصة</option>
                        <option value="monthly">شهري</option>
                      </select>
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedLevel('All');
                        setSelectedGrade('All');
                        setSelectedSubject('All');
                        setSelectedPricingType('All');
                        setSelectedCategory('All');
                      }}
                      className="px-4 py-2 text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      {t('clearAllFilters')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">{t('loadingCoursesText')}</p>
                  </div>
                ) : (() => {
                  // Filter out courses the user is already registered for
                  const registeredCourseIds = registrations.map(reg => reg.course.id);
                  const availableCoursesFiltered = availableCourses.filter(course => 
                    !registeredCourseIds.includes(course.id) && course.available_seats > 0
                  );

                  return availableCoursesFiltered.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">{t('noNewCoursesAvailable')}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('registeredForAllCourses')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {availableCoursesFiltered.map((course) => (
                        <div key={course.id} className="bg-background rounded-xl shadow-luxury overflow-hidden hover:shadow-dark transition-all duration-300 transform hover:-translate-y-2 border border-border">
                          {course.image_url && (
                            <div className="relative">
                              <img
                                src={course.image_url}
                                alt={getCourseName(course)}
                                className="w-full h-40 object-cover"
                              />
                              <div className="absolute top-3 right-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColors(course.category).bg} ${getCategoryColors(course.category).text}`}>
                                  {translateCategory(course.category)}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-medium px-2 py-1 rounded-full ${getCategoryColors(course.category).bg} ${getCategoryColors(course.category).text}`}>
                                {translateCategory(course.category)}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">{getCourseName(course)}</h3>
                            <p className="text-muted-foreground mb-4 line-clamp-3">{getCourseDescription(course)}</p>

                            <div className="space-y-2 mb-4">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">{t('priceLabel')}</span>
                                <span className="font-semibold text-primary">
                                  {course.pricing_info ? course.pricing_info.display_price : `${course.price} DA`}
                                </span>
                              </div>
                              {course.pricing_info && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-muted-foreground">{t('durationLabel')}</span>
                                  <span className="font-medium text-sm">
                                    {course.pricing_info.session_duration_hours ? `${course.pricing_info.session_duration_hours}h ${course.pricing_info.pricing_type === 'session' ? t('perSessionLabel') : t('monthlyLabel')}` : course.pricing_info.pricing_type === 'monthly' ? t('monthlyLabel') : t('perSessionLabel')}
                                  </span>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => handleRegisterForCourse(course.id)}
                              className="w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 bg-gradient-gold text-secondary hover:shadow-luxury"
                            >
                              {t('registerNowCourses')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">{t('paymentInformationTitle')}</h2>
                <p className="text-muted-foreground mt-1">{t('paymentInformationDesc')}</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Payment Summary */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">{t('paymentSummary')}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('totalPaidLabel')}</span>
                        <span className="font-semibold text-green-600">{paymentInfo.total_paid || 0} DA</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('outstandingBalanceLabel')}</span>
                        <span className="font-semibold text-red-600">{paymentInfo.amount_due || 0} DA</span>
                      </div>
                    </div>
                  </div>

                  {/* Next Payment */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">{t('nextPayment')}</h3>
                    {paymentInfo.next_payment_due ? (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center mb-2">
                          <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                          <span className="font-semibold text-yellow-800">{t('paymentDue')}</span>
                        </div>
                        <p className="text-yellow-800 mb-2">
                          Due Date: {new Date(paymentInfo.next_payment_due).toLocaleDateString()}
                        </p>
                        <p className="text-yellow-800 font-semibold">
                          Amount: {paymentInfo.amount_due} DA
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                          <span className="text-green-800 font-semibold">{t('allCaughtUp')}</span>
                        </div>
                        <p className="text-green-800 mt-2">{t('noOutstandingPayments')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Contact Information */}
              <div className="bg-card rounded-xl shadow-luxury p-6 border border-border">
                <h2 className="text-xl font-semibold text-foreground mb-4">{t('getInTouch')}</h2>
                <p className="text-muted-foreground mb-6">
                  {t('getInTouchDesc')}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Email</h3>
                      <p className="text-muted-foreground">info@lawsofsuccess.com</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Phone</h3>
                      <p className="text-muted-foreground">+1 (555) 123-4567</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Address</h3>
                      <p className="text-muted-foreground">123 Education Street<br />Learning City, LC 12345</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-card rounded-xl shadow-luxury p-6 border border-border">
                <h2 className="text-xl font-semibold text-foreground mb-4">Send us a Message</h2>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({...contactForm, subject: e.target.value})}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="What's this about?"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Message
                    </label>
                    <textarea
                      name="message"
                      value={contactForm.message}
                      onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                      rows={5}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="Tell us how we can help you..."
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="w-full py-3 px-4 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isSubmittingContact ? (
                      <>
                        <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">{t('profileInformation')}</h2>
                <p className="text-muted-foreground mt-1">{t('manageAccountDetails')}</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">{t('personalDetails')}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('fullNameLabel')}</span>
                        <span className="font-semibold text-foreground">{user.full_name}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('emailLabelProfile')}</span>
                        <span className="font-semibold text-foreground">{user.email || t('notProvided')}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('phoneLabelProfile')}</span>
                        <span className="font-semibold text-foreground">{user.phone || t('notProvided')}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('roleLabel')}</span>
                        <span className="font-semibold text-primary capitalize">{user.role}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('memberSinceLabel')}</span>
                        <span className="font-semibold text-foreground">
                          {(user as any).created_at ? new Date((user as any).created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Student Information */}
                  {user.students && user.students.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">{t('studentInfoLabel')} {t('personalDetails')}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-muted-foreground">{t('studentName')}</span>
                          <span className="font-semibold text-foreground">{user.students[0].name}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-muted-foreground">{t('dateOfBirth')}</span>
                          <span className="font-semibold text-foreground">
                            {user.students[0].date_of_birth ? new Date(user.students[0].date_of_birth).toLocaleDateString() : t('notProvided')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-muted-foreground">{t('mobileUsername')}</span>
                          <span className="font-semibold text-foreground">{user.students[0].mobile_username || t('notProvided')}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-muted-foreground">{t('mobileAccess')}</span>
                          <div className="flex items-center">
                            {user.students[0].mobile_app_enabled ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                            )}
                            <span className={`font-semibold ${user.students[0].mobile_app_enabled ? 'text-green-600' : 'text-yellow-600'}`}>
                              {user.students[0].mobile_app_enabled ? t('enabled') : t('disabled')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account Status */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">{t('accountStatus')}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('emailVerifiedLabel')}</span>
                        <div className="flex items-center">
                          {user.email_verified ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                          )}
                          <span className={`font-semibold ${user.email_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                            {user.email_verified ? t('verified') : t('pendingStatus')}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('activeCoursesLabel')}</span>
                        <span className="font-semibold text-primary">
                          {registrations.filter(r => r.status === 'approved').length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <span className="text-muted-foreground">{t('totalRegistrationsLabel')}</span>
                        <span className="font-semibold text-foreground">{registrations.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
