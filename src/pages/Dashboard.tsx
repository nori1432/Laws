import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslatedCategory } from '../utils/categoryUtils';
import { getCourseName, getCourseDescription } from '../utils/courseUtils';
import ProfilePictureUploader from '../components/ProfilePictureUploader';
import ProfileCompletionModal from '../components/ProfileCompletionModal';
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
  TrendingUp,
  MessageSquare,
  Settings,
  Bell,
  DollarSign,
  Users,
  Award,
  Edit,
  GraduationCap,
  Shield,
  XCircle,
  AlertTriangle,
  Lock,
  ChevronRight,
  Eye,
  EyeOff,
  Smartphone
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
  enrollment_status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  approved_at?: string | null;
  rejection_reason?: string | null;
  payment_type?: string;
  payment_status?: string;
  next_payment_due?: string;
  sessions_this_month?: number;
  total_debt?: number;
  debt_sessions?: number;
  class_name?: string;
  name?: string;
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
  enrollment_id: number;
  student_name: string;
  course_name: string;
  section_name: string;
  payment_type: string;
  unpaid_amount: number;
  payment_status_display: string;
  progress_percentage: number;
  sessions_this_month: number;
  is_overdue: boolean;
  registration_payment_status: string;
  monthly_payment_status: string;
  course_price: number;
}

const Dashboard: React.FC = () => {
  const { user, updateUser, profileIncomplete } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { translateCategory, getCategoryColors } = useTranslatedCategory();
  const [activeTab, setActiveTab] = useState('overview');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [sectionEnrollments, setSectionEnrollments] = useState<SectionEnrollment[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo[]>([]);
  const [attendanceLog, setAttendanceLog] = useState<any[]>([]);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registrationError, setRegistrationError] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Profile management state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [isEditingParent, setIsEditingParent] = useState(false);
  const [isUpdatingParent, setIsUpdatingParent] = useState(false);
  const [parentForm, setParentForm] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [parentInfo, setParentInfo] = useState<{
    full_name?: string;
    email?: string;
    phone?: string;
  } | null>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isEditingEnrollments, setIsEditingEnrollments] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showParentPassword, setShowParentPassword] = useState(false);
  const [showStudentPasswords, setShowStudentPasswords] = useState<{[key: number]: boolean}>({});
  const [isEditingStudentInfo, setIsEditingStudentInfo] = useState<{[key: number]: boolean}>({});
  const [studentBirthdays, setStudentBirthdays] = useState<{[key: number]: string}>({});
  const [credentialsEligibility, setCredentialsEligibility] = useState<any>(null);
  const [isGeneratingCredentials, setIsGeneratingCredentials] = useState<{[key: number]: boolean}>({});

  // Memoized payment calculations - updated to use real debt data
  const paymentSummary = useMemo(() => {
    // Calculate from attendance log (which has course prices and payment status)
    const totalUnpaidFromAttendance = attendanceLog
      .filter(a => a.status === 'present' && a.payment_status === 'unpaid')
      .reduce((total, a) => total + (a.course_price || 0), 0);
    
    // Use student total debt as the primary source
    const studentTotalDebt = studentInfo?.total_debt || 0;
    
    // Calculate paid sessions
    const totalPaidSessions = attendanceLog
      .filter(a => a.status === 'present' && a.payment_status === 'paid')
      .reduce((total, a) => total + (a.course_price || 0), 0);
    
    // Get enrollment debts for course breakdown
    const enrollmentDebts = sectionEnrollments
      .filter(e => e.total_debt && e.total_debt > 0)
      .map(e => ({
        course_name: e.class_name || e.name,
        debt_amount: e.total_debt,
        debt_sessions: e.debt_sessions || 0
      }));
    
    return {
      totalPaid: totalPaidSessions,
      outstandingBalance: studentTotalDebt, // Use student's total debt
      attendanceDebt: totalUnpaidFromAttendance, // Debt calculated from attendance
      enrollmentDebts: enrollmentDebts,
      nextPayments: enrollmentDebts.filter(e => e.debt_amount > 0),
      allClearCount: sectionEnrollments.filter(e => !e.total_debt || e.total_debt === 0).length,
      coursesWithDebt: enrollmentDebts.length,
      highestDebt: enrollmentDebts.length > 0 ? Math.max(...enrollmentDebts.map(e => e.debt_amount)) : 0
    };
  }, [attendanceLog, studentInfo, sectionEnrollments]);

  // Check if essential profile information is missing
  const isEssentialInfoMissing = (userData: any) => {
    if (!userData) return false;

    // Check user essential info (phone is critical)
    const userNameMissing = !userData.full_name || userData.full_name.trim() === '';
    const userPhoneMissing = !userData.phone || userData.phone.trim() === '';

    // Check parent info (parent_info must exist and have name/phone)
    let parentInfoMissing = false;
    if (!userData.parent_info) {
      // No parent_info at all = incomplete
      parentInfoMissing = true;
    } else {
      const parentNameMissing = !userData.parent_info.full_name || userData.parent_info.full_name.trim() === '';
      const parentPhoneMissing = !userData.parent_info.phone || userData.parent_info.phone.trim() === '';
      parentInfoMissing = parentNameMissing || parentPhoneMissing;
    }

    // Check student info (birth date is essential)
    let studentInfoMissing = false;
    if (userData.students && userData.students.length > 0) {
      const student = userData.students[0];
      const studentBirthDateMissing = !student?.date_of_birth || student.date_of_birth.trim() === '';
      studentInfoMissing = studentBirthDateMissing;
    }

    return userNameMissing || userPhoneMissing || parentInfoMissing || studentInfoMissing;
  };

  // Check for profile completion on mount and user changes
  useEffect(() => {
    if (user && profileIncomplete && isEssentialInfoMissing(user)) {
      // Redirect to profile tab and show modal
      setActiveTab('profile');
      setShowProfileModal(true);
    }
  }, [user, profileIncomplete]);

  useEffect(() => {
    fetchDashboardData();
    fetchEnrollments();
    fetchCredentialsEligibility();
  }, [user]);

  // Update profile form when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
      // Initialize parent info and form with parent info from user object
      if (user.parent_info) {
        setParentInfo(user.parent_info);
        setParentForm({
          full_name: user.parent_info.full_name || '',
          email: user.parent_info.email || '',
          phone: user.parent_info.phone || ''
        });
      }
      // Initialize student birthdays
      if (user.students) {
        const birthdays: {[key: number]: string} = {};
        user.students.forEach(student => {
          if (student.date_of_birth) {
            birthdays[student.id] = student.date_of_birth;
          }
        });
        setStudentBirthdays(birthdays);
      }
    }
  }, [user]);

  useEffect(() => {
    if (parentInfo) {
      setParentForm({
        full_name: parentInfo.full_name || '',
        email: parentInfo.email || '',
        phone: parentInfo.phone || ''
      });
    }
  }, [parentInfo]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setRegistrationError(false);
    try {
      const [regsRes, paymentRes, attendanceRes, enrollmentsRes, parentRes] = await Promise.all([
        axios.get('/api/courses/my-registrations').catch((error) => {
          console.error('Failed to fetch registrations:', error);
          if (error.response?.status === 503) {
            setRegistrationError(true);
            return { data: { registrations: [] } };
          }
          setRegistrationError(true);
          return { data: { registrations: [] } }; // Return empty array on error
        }),
        axios.get('/api/payments/student-payments').catch(() => ({ data: [] })), // Graceful fallback
        axios.get('/api/attendance/my-attendance').catch(() => ({ data: { attendance: [] } })), // Attendance log
        axios.get('/api/courses/my-enrollments').catch((error) => {
          console.error('Failed to fetch section enrollments:', error);
          return { data: { enrollments: [] } }; // Return empty array on error
        }),
        axios.get('/api/auth/me/profile/parent').catch((error) => {
          console.error('Failed to fetch parent info:', error);
          return { data: null }; // Return null on error
        })
      ]);

      setRegistrations(regsRes.data.registrations || []);
      setPaymentInfo(paymentRes.data || []);
      setAttendanceLog(attendanceRes.data.attendance || []);
      setStudentInfo(attendanceRes.data.student || null);
      setSectionEnrollments(enrollmentsRes.data.enrollments || []);
      
      // Update parent form and info with fetched data
      if (parentRes.data) {
        setParentInfo(parentRes.data);
        setParentForm({
          full_name: parentRes.data.full_name || '',
          email: parentRes.data.email || '',
          phone: parentRes.data.phone || ''
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load data');
      // Set empty arrays to prevent crashes
      setRegistrations([]);
      setPaymentInfo([]);
      setSectionEnrollments([]);
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
      toast.error('Failed to send message');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Profile management handlers
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!profileForm.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    
    if (profileForm.email && !profileForm.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsUpdatingProfile(true);
    try {
      await axios.put('/api/auth/me/profile', profileForm);
      toast.success(t('profileUpdated') || 'Profile updated successfully');
      setIsEditingProfile(false);
      // Refresh user data
      fetchDashboardData();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleParentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!parentForm.full_name.trim()) {
      toast.error('Parent name is required');
      return;
    }
    
    if (parentForm.email && !parentForm.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsUpdatingParent(true);
    try {
      const response = await axios.put('/api/auth/me/profile/parent', parentForm);
      toast.success('Parent information updated successfully');
      setIsEditingParent(false);
      // Update parent info with response data
      if (response.data && response.data.parent) {
        setParentInfo(response.data.parent);
      } else {
        // Fallback: update with form data if response doesn't contain parent info
        setParentInfo(parentForm);
      }
      // Refresh user data to ensure consistency and generate mobile credentials if needed
      fetchDashboardData();
      // Trigger mobile credentials generation
      await checkAndGenerateMobileCredentials();
    } catch (error: any) {
      console.error('Failed to update parent info:', error);
      toast.error(error.response?.data?.error || 'Failed to update parent information');
    } finally {
      setIsUpdatingParent(false);
    }
  };

  const handleStudentBirthdayUpdate = async (studentId: number) => {
    const birthday = studentBirthdays[studentId];
    if (!birthday) {
      toast.error('Please enter a valid birthday');
      return;
    }

    try {
      await axios.put(`/api/auth/me/profile/students/${studentId}/birthday`, {
        date_of_birth: birthday
      });
      toast.success('Birthday updated successfully');
      setIsEditingStudentInfo({ ...isEditingStudentInfo, [studentId]: false });
      // Refresh user data
      fetchDashboardData();
      // Trigger mobile credentials generation
      await checkAndGenerateMobileCredentials();
    } catch (error: any) {
      console.error('Failed to update birthday:', error);
      toast.error(error.response?.data?.error || 'Failed to update birthday');
    }
  };

  const checkAndGenerateMobileCredentials = async () => {
    try {
      // Check if user has approved enrollments and parent data
      const response = await axios.post('/api/auth/generate-mobile-credentials');
      if (response.data.credentials_generated) {
        toast.success('Mobile app credentials generated successfully!');
        // Refresh user data to show new credentials
        const token = localStorage.getItem('access_token');
        const userResponse = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        updateUser(userResponse.data.user);
      }
    } catch (error: any) {
      console.error('Failed to generate mobile credentials:', error);
      // Don't show error toast as this is automatic
    }
  };

  const fetchCredentialsEligibility = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('/api/auth/mobile-credentials/check-eligibility', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCredentialsEligibility(response.data);
    } catch (error: any) {
      console.error('Failed to check credentials eligibility:', error);
    }
  };

  const handleGenerateCredentials = async (studentId?: number) => {
    if (studentId) {
      setIsGeneratingCredentials({ ...isGeneratingCredentials, [studentId]: true });
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post('/api/auth/mobile-credentials/generate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success(
          language === 'ar' 
            ? 'تم إنشاء بيانات الدخول بنجاح! 🎉' 
            : 'Mobile credentials generated successfully! 🎉'
        );
        // Refresh data
        await fetchDashboardData();
        await fetchCredentialsEligibility();
      } else {
        toast.error(
          language === 'ar' 
            ? response.data.reason || 'فشل إنشاء بيانات الدخول' 
            : response.data.reason || 'Failed to generate credentials'
        );
      }
    } catch (error: any) {
      console.error('Failed to generate credentials:', error);
      toast.error(
        language === 'ar' 
          ? 'حدث خطأ أثناء إنشاء بيانات الدخول' 
          : 'Error generating credentials'
      );
    } finally {
      if (studentId) {
        setIsGeneratingCredentials({ ...isGeneratingCredentials, [studentId]: false });
      }
    }
  };



  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!passwordForm.current.trim()) {
      toast.error('Current password is required');
      return;
    }
    
    if (passwordForm.new.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error(t('passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    try {
      await axios.put('/api/auth/change-password', {
        current_password: passwordForm.current,
        new_password: passwordForm.new
      });
      toast.success(t('passwordChanged') || 'Password changed successfully');
      setIsChangingPassword(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      console.error('Failed to change password:', error);
      toast.error(error.response?.data?.error || 'Failed to change password');
    }
  };

  const fetchEnrollments = async () => {
    try {
      const response = await axios.get('/api/auth/me/profile/students');
      setEnrollments(response.data.enrollments || []);
    } catch (error) {
      console.error('Failed to fetch enrollments:', error);
      setEnrollments([]);
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

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) {
    return null; // Return null while redirecting
  }

  const tabs = [
    { id: 'overview', name: t('overviewTab'), icon: TrendingUp },
    { id: 'my-learning', name: t('myLearningTab'), icon: BookOpen },
    { id: 'attendance', name: t('attendanceTab'), icon: Calendar },
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
                {t('dashboardTitle')}
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
              const isLocked = profileIncomplete && tab.id !== 'profile';
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (!isLocked) {
                      setActiveTab(tab.id);
                    } else {
                      toast.error('Please complete your profile first');
                    }
                  }}
                  disabled={isLocked}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-gradient-gold text-secondary shadow-luxury'
                      : isLocked
                      ? 'text-muted-foreground/50 cursor-not-allowed opacity-50'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                  {isLocked && <Lock className="w-3 h-3 ml-1" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{t('welcomeBack')}, {user.full_name}!</h2>
                    <p className="text-muted-foreground mb-4">{t('dashboardOverviewDescription')}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{t('lastLoginToday')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>{t('accountActive')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-10 h-10 text-primary" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-xl shadow-luxury p-6 border border-border hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('totalCourses')}</p>
                      <p className="text-3xl font-bold text-foreground">{registrations.length}</p>
                      <p className="text-xs text-green-600 mt-1">
                        +{registrations.filter(r => r.status === 'approved').length} {t('activeCourses')}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-gold rounded-lg">
                      <BookOpen className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl shadow-luxury p-6 border border-border hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('approvedCourses')}</p>
                      <p className="text-3xl font-bold text-green-600">
                        {registrations.filter(r => r.status === 'approved').length}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('readyToStart')}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl shadow-luxury p-6 border border-border hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('pendingApprovals')}</p>
                      <p className="text-3xl font-bold text-yellow-600">
                        {registrations.filter(r => r.status === 'pending').length}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('awaitingConfirmation')}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </div>

                <div className={`rounded-xl shadow-luxury p-6 border hover:shadow-xl transition-all duration-300 ${
                  paymentSummary.outstandingBalance > 0 
                    ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200 hover:border-red-300 animate-pulse' 
                    : 'bg-card border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('outstandingBalance')}</p>
                      <div className="flex items-center space-x-2">
                        <p className={`text-3xl font-bold ${
                          paymentSummary.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {paymentSummary.outstandingBalance} DA
                        </p>
                        {paymentSummary.outstandingBalance > 0 && (
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {paymentSummary.outstandingBalance > 0 ? t('dueThisMonth') : 'All Clear!'}
                        </p>
                        {paymentSummary.outstandingBalance > 0 && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                            {paymentInfo.filter(payment => payment.unpaid_amount > 0).length} courses
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      paymentSummary.outstandingBalance > 0 
                        ? 'bg-red-100 animate-pulse' 
                        : 'bg-green-100'
                    }`}>
                      {paymentSummary.outstandingBalance > 0 ? (
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                  </div>
                  {paymentSummary.outstandingBalance > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <button
                        onClick={() => setActiveTab('attendance')}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        👁️ {t('viewAttendanceLog')}
                      </button>
                    </div>
                  )}
                </div>
              </div>



              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('attendance')}
                  className="bg-card rounded-xl shadow-luxury p-6 border border-border hover:shadow-xl transition-all duration-300 hover:border-primary/50 group"
                >
                  <div className="flex items-center gap-3 rtl:space-x-reverse">
                    <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors flex-shrink-0">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left rtl:text-right min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{t('viewAttendanceLog')}</p>
                      <p className="text-sm text-muted-foreground truncate">{t('checkDailyAttendance')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('schedule')}
                  className="bg-card rounded-xl shadow-luxury p-6 border border-border hover:shadow-xl transition-all duration-300 hover:border-primary/50 group"
                >
                  <div className="flex items-center gap-3 rtl:space-x-reverse">
                    <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors flex-shrink-0">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-left rtl:text-right min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{t('viewSchedule')}</p>
                      <p className="text-sm text-muted-foreground truncate">{t('checkClassTimings')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('contact')}
                  className="bg-card rounded-xl shadow-luxury p-6 border border-border hover:shadow-xl transition-all duration-300 hover:border-primary/50 group"
                >
                  <div className="flex items-center gap-3 rtl:space-x-reverse">
                    <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors flex-shrink-0">
                      <MessageSquare className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="text-left rtl:text-right min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{t('contactSupport')}</p>
                      <p className="text-sm text-muted-foreground truncate">{t('getHelpSupport')}</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Course Status & Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Course Status Overview */}
                  <div className="bg-card rounded-xl shadow-luxury border border-border">
                    <div className="p-6 border-b border-border">
                      <h3 className="text-xl font-semibold text-foreground flex items-center">
                        <BookOpen className="w-5 h-5 mr-2 text-primary" />
                        {t('courseStatusOverview')}
                      </h3>
                      <p className="text-muted-foreground mt-1">{t('courseStatusDescription')}</p>
                    </div>
                    <div className="p-6">
                      {registrations.length > 0 ? (
                        <div className="space-y-4">
                          {registrations.slice(0, 5).map((reg) => (
                            <div key={reg.id} className="flex items-center justify-between p-4 bg-background rounded-lg border border-border hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-4 rtl:space-x-reverse min-w-0 flex-1">
                                <div className={`p-3 rounded-lg flex-shrink-0 ${getStatusColor(reg.status)}`}>
                                  {getStatusIcon(reg.status)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-semibold text-foreground truncate">{getCourseName(reg.course, language)}</h4>
                                  <p className="text-sm text-muted-foreground truncate">
                                    Student: {reg.student.name} • Registered: {new Date(reg.created_at).toLocaleDateString()}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Price: {reg.course.price} DA • Status: {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(reg.status)}`}>
                                  {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                                </span>
                              </div>
                            </div>
                          ))}
                          {registrations.length > 5 && (
                            <button
                              onClick={() => setActiveTab('courses')}
                              className="w-full py-2 text-primary hover:text-primary/80 font-medium"
                            >
                              View all {registrations.length} courses →
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h4 className="text-lg font-semibold text-foreground mb-2">No Course Registrations</h4>
                          <p className="text-muted-foreground mb-4">You haven't registered for any courses yet.</p>
                          <button
                            onClick={() => setActiveTab('available')}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                          >
                            Browse Available Courses
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Payment Status & Quick Info */}
                <div className="space-y-6">
                  {/* Payment Status */}
                  <div className="bg-card rounded-xl shadow-luxury border border-border">
                    <div className="p-6 border-b border-border">
                      <h3 className="text-lg font-semibold text-foreground flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-primary" />
                        {t('paymentStatusSection')}
                      </h3>
                      <p className="text-muted-foreground mt-1">{t('outstandingBalancesDesc')}</p>
                    </div>
                    <div className="p-6">
                      {paymentInfo.length > 0 ? (
                        <div className="space-y-4">
                          {paymentInfo.slice(0, 3).map((payment, index) => (
                            <div key={index} className="p-4 bg-background rounded-lg border border-border">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-foreground text-sm">{payment.course_name}</p>
                                  <p className="text-xs text-muted-foreground">{payment.section_name}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  payment.is_overdue ? 'bg-red-100 text-red-800' :
                                  payment.unpaid_amount > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {payment.payment_status_display}
                                </span>
                              </div>

                              {/* Progress bar for monthly courses */}
                              {payment.payment_type === 'monthly' && (
                                <div className="mb-2">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Monthly Progress</span>
                                    <span>{payment.progress_percentage}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${
                                        payment.progress_percentage >= 100 ? 'bg-green-500' :
                                        payment.progress_percentage >= 75 ? 'bg-yellow-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${Math.min(payment.progress_percentage, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>{t('paymentTypeLabel')}: {payment.payment_type}</p>
                                {payment.unpaid_amount > 0 && (
                                  <p className="text-red-600 font-medium">{t('owedLabel')}: {payment.unpaid_amount} DA</p>
                                )}
                                {payment.payment_type === 'monthly' && (
                                  <p>{t('sessionsLabel')}: {payment.sessions_this_month}/4 {t('thisMonth')}</p>
                                )}
                                {payment.is_overdue && (
                                  <p className="text-red-600 font-medium flex items-center">
                                    <AlertTriangle className="w-4 h-4 mr-1" />
                                    {t('paymentOverdue')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}

                          <div className="pt-4 border-t border-border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-foreground">{t('totalOutstanding')}</span>
                              <span className="font-bold text-red-600">{paymentSummary.outstandingBalance} DA</span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-3">
                              <p>{t('overduePayments')}: {paymentInfo.filter(p => p.is_overdue).length} payments</p>
                              <p>{t('allClearCourses')}: {paymentSummary.allClearCount} courses</p>
                            </div>
                            <button
                              onClick={() => setActiveTab('payments')}
                              className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium"
                            >
                              {t('viewPaymentDetail')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                          <h4 className="text-lg font-semibold text-foreground mb-2">All Paid Up!</h4>
                          <p className="text-muted-foreground text-sm">No outstanding payments at this time.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Support Contact */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Phone className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-800">{t('needHelp')}</h4>
                        <p className="text-sm text-blue-600">{t('contactOurSupportTeam')}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-blue-700">
                      <p>📞 {t('contactPhone')}: {t('contactPhoneValue')}</p>
                      <p>📧 {t('contactEmail')}: {t('contactEmailValue')}</p>
                      <p>🕒 Hours: Mon-Fri 9AM-6PM</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('contact')}
                      className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      {t('contactSupport')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'my-learning' && (
            <div className="space-y-6">
              {/* Unified Learning Dashboard */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground flex items-center">
                        <BookOpen className="w-6 h-6 mr-2 text-primary" />
                        {t('myLearningDashboard')}
                      </h2>
                      <p className="text-muted-foreground mt-1">{t('learningDashboardDescription')}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {sectionEnrollments.length} {t('activeEnrollments')}
                      </span>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-4">{t('loadingLearningData')}</p>
                  </div>
                ) : sectionEnrollments.length === 0 && registrations.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">{t('noLearningActivities')}</h3>
                    <p className="text-muted-foreground mb-6">{t('startLearningJourney')}</p>
                    <button
                      onClick={() => setActiveTab('available')}
                      className="px-6 py-3 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300 font-medium"
                    >
                      {t('browseAvailableCourses')}
                    </button>
                  </div>
                ) : (
                  <div className="p-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 rounded-lg p-4 border border-blue-200/20">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-muted-foreground">{t('activeSchedules')}</p>
                            <p className="text-xl font-bold text-blue-600">{sectionEnrollments.filter(e => e.section.is_active).length}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 rounded-lg p-4 border border-green-200/20">
                        <div className="flex items-center">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-muted-foreground">{t('completedRegistrations')}</p>
                            <p className="text-xl font-bold text-green-600">{registrations.filter(r => r.status === 'approved').length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-lg p-4 border border-yellow-200/20">
                        <div className="flex items-center">
                          <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <Clock className="w-5 h-5 text-yellow-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-muted-foreground">{t('pendingRegistrations')}</p>
                            <p className="text-xl font-bold text-yellow-600">{registrations.filter(r => r.status === 'pending').length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 rounded-lg p-4 border border-purple-200/20">
                        <div className="flex items-center">
                          <div className="p-2 bg-purple-500/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-muted-foreground">{t('monthlyProgress')}</p>
                            <p className="text-xl font-bold text-purple-600">
                              {sectionEnrollments.reduce((sum, e) => sum + (e.sessions_this_month || 0), 0)} {t('dashboardSessions')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pending Enrollments Alert */}
                    {sectionEnrollments.some(e => e.enrollment_status === 'pending') && (
                      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-yellow-800">
                              Pending Enrollment Approval
                            </h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              You have {sectionEnrollments.filter(e => e.enrollment_status === 'pending').length} enrollment(s) awaiting admin approval. 
                              An admin will contact you with academy details to complete your registration.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Schedule */}
                    {sectionEnrollments.length > 0 && (
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-foreground flex items-center">
                            <Calendar className="w-5 h-5 mr-2 text-primary" />
                            {t('currentSchedule')}
                          </h3>
                          <span className="text-sm text-muted-foreground">
                            {sectionEnrollments.filter(e => e.enrollment_status === 'approved').length} {t('activeSections')}
                          </span>
                        </div>
                        
                        <div className="bg-background rounded-lg border border-border overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('courseSection')}</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('scheduleTime')}</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('dashboardPaymentType')}</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Progress/Debt</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('statusLabel')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sectionEnrollments.map((enrollment) => {
                                  const paymentData = paymentInfo.find(p => p.enrollment_id === enrollment.enrollment_id);
                                  return (
                                    <tr key={enrollment.enrollment_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                      <td className="px-4 py-4">
                                        <div>
                                          <p className="text-sm font-medium text-foreground">
                                            {getCourseName(enrollment.course, language)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {enrollment.section.section_name}
                                          </p>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="flex items-center">
                                          <Clock className="w-4 h-4 mr-1 text-muted-foreground" />
                                          <span className="text-sm text-foreground">
                                            {enrollment.section.schedule}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          enrollment.payment_type === 'monthly'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        }`}>
                                          {enrollment.payment_type === 'monthly' ? t('monthlyPayment') : t('perSessionPayment')}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="space-y-1">
                                          {enrollment.payment_type === 'monthly' ? (
                                            <div className="flex items-center space-x-2">
                                              <span className="text-sm text-foreground">
                                                {enrollment.sessions_this_month || 0}/4
                                              </span>
                                              <div className="w-16 bg-muted rounded-full h-2">
                                                <div 
                                                  className="bg-primary rounded-full h-2 transition-all duration-300"
                                                  style={{ width: `${Math.min(((enrollment.sessions_this_month || 0) / 4) * 100, 100)}%` }}
                                                ></div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center text-muted-foreground">
                                              <span className="text-sm">
                                                Pay per session
                                              </span>
                                            </div>
                                          )}
                                          
{/* Debt Information */}
                                          {enrollment.total_debt && enrollment.total_debt > 0 ? (
                                            <div className="flex items-center space-x-1">
                                              <AlertTriangle className="w-3 h-3 text-red-500" />
                                              <span className="text-xs text-red-600 font-medium">
                                                {enrollment.total_debt} DA debt ({enrollment.debt_sessions || 0} sessions)
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center space-x-1">
                                              <CheckCircle className="w-3 h-3 text-green-500" />
                                              <span className="text-xs text-green-600">
                                                No debt
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4">
                                        <div className="flex items-center">
                                          {enrollment.enrollment_status === 'approved' ? (
                                            <span className="flex items-center text-green-600 text-sm">
                                              <CheckCircle className="w-4 h-4 mr-1" />
                                              Approved
                                            </span>
                                          ) : enrollment.enrollment_status === 'pending' ? (
                                            <span className="flex items-center text-yellow-600 text-sm">
                                              <Clock className="w-4 h-4 mr-1" />
                                              Pending Approval
                                            </span>
                                          ) : enrollment.enrollment_status === 'rejected' ? (
                                            <span className="flex items-center text-red-600 text-sm">
                                              <XCircle className="w-4 h-4 mr-1" />
                                              Rejected
                                            </span>
                                          ) : (
                                            <span className="flex items-center text-gray-600 text-sm">
                                              <AlertCircle className="w-4 h-4 mr-1" />
                                              Unknown
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Course Registrations */}
                    {registrations.length > 0 && (
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-foreground flex items-center">
                            <BookOpen className="w-5 h-5 mr-2 text-primary" />
                            {t('courseRegistrations')}
                          </h3>
                          <span className="text-sm text-muted-foreground">
                            {registrations.length} {t('totalRegistrations')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {registrations.map((registration) => (
                            <div key={registration.id} className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-all duration-200">
                              {registration.course.image_url && (
                                <div className="mb-3">
                                  <img
                                    src={registration.course.image_url}
                                    alt={getCourseName(registration.course, language)}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                </div>
                              )}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-foreground mb-1">
                                    {getCourseName(registration.course, language)}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {t('dashboardStudent')}: {registration.student.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {registration.course.price} {t('currencyLabel')}
                                  </p>
                                </div>
                                <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(registration.status)} flex items-center space-x-1`}>
                                  {getStatusIcon(registration.status)}
                                  <span>{registration.status === 'approved' ? t('dashboardApproved') : registration.status === 'pending' ? t('dashboardPending') : registration.status === 'rejected' ? t('dashboardRejected') : registration.status}</span>
                                </div>
                              </div>
                              
                              {registration.status === 'pending' && (
                                <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                    {t('seatReservedNotice')}
                                  </p>
                                </div>
                              )}
                              
                              <div className="mt-3 flex items-center text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(registration.created_at).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'en-US')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Summary for Learning Dashboard */}
                    {paymentInfo.length > 0 && (
                      <div className="bg-gradient-to-r from-muted/30 to-muted/50 rounded-lg p-6 border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                          <CreditCard className="w-5 h-5 mr-2 text-primary" />
                          {t('learningPaymentSummary')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-card rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground mb-1">{t('totalOutstandingBalance')}</p>
                            <p className="text-2xl font-bold text-red-600">
                              {paymentSummary.outstandingBalance.toFixed(2)} {t('currencyLabel')}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-card rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground mb-1">{t('totalPaidAmount')}</p>
                            <p className="text-2xl font-bold text-green-600">
                              {paymentSummary.totalPaid.toFixed(2)} {t('currencyLabel')}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-card rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground mb-1">{t('upcomingPaymentCount')}</p>
                            <p className="text-2xl font-bold text-primary">
                              {paymentSummary.nextPayments.length}
                            </p>
                          </div>
                        </div>
                        
                        {paymentSummary.nextPayments.length > 0 && (
                          <div className="mt-4 text-center">
                            <button
                              onClick={() => setActiveTab('payments')}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                            >
                              {t('viewPaymentDetails')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground flex items-center space-x-2">
                      <Calendar className="w-6 h-6 text-blue-600" />
                      <span><Calendar className="w-4 h-4 mr-2 inline" />{t('attendanceLogTitle')}</span>
                    </h2>
                    <p className="text-muted-foreground mt-1">{t('attendanceLogSubtitle')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t('totalSessions')}</p>
                    <p className="text-2xl font-bold text-blue-600">{attendanceLog.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* Attendance Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600 font-medium">{t('presentSessions')}</p>
                        <p className="text-2xl font-bold text-green-800">
                          {attendanceLog.filter(a => a.status === 'present').length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-red-100 rounded-lg">
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-red-600 font-medium">{t('absentSessions')}</p>
                        <p className="text-2xl font-bold text-red-800">
                          {attendanceLog.filter(a => a.status === 'absent').length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-orange-100 rounded-lg">
                        <DollarSign className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-orange-600 font-medium">{t('unpaidSessionsCount')}</p>
                        <p className="text-2xl font-bold text-orange-800">
                          {attendanceLog.filter(a => a.payment_status === 'unpaid').length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Attendance Log */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">📋 {t('dailyAttendanceRecords')}</h3>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span>{t('present')}</span>
                      <span className="w-3 h-3 bg-red-500 rounded-full ml-4"></span>
                      <span>{t('absent')}</span>
                      <span className="w-3 h-3 bg-orange-500 rounded-full ml-4"></span>
                      <span>{t('unpaid')}</span>
                    </div>
                  </div>
                  
                  {attendanceLog.length > 0 ? (
                    <div className="space-y-3">
                      {attendanceLog
                        .sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime())
                        .map((attendance, index) => (
                          <div key={index} className="bg-background rounded-lg border border-border p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                  attendance.status === 'present' 
                                    ? 'bg-green-100' 
                                    : 'bg-red-100'
                                }`}>
                                  {attendance.status === 'present' ? (
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                  ) : (
                                    <XCircle className="w-6 h-6 text-red-600" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-foreground">
                                    {new Date(attendance.attendance_date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'en-US', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {t('course')}: {attendance.class_name || t('course')}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    attendance.status === 'present'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {attendance.status === 'present' ? (
                                      <span className="flex items-center text-green-600">
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        {t('present').toUpperCase()}
                                      </span>
                                    ) : (
                                      <span className="flex items-center text-red-600">
                                        <XCircle className="w-4 h-4 mr-1" />
                                        {t('absent').toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    attendance.payment_status === 'paid'
                                      ? 'bg-green-100 text-green-800'
                                      : attendance.payment_status === 'unpaid'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {attendance.payment_status === 'paid' 
                                      ? `💰 ${t('paid').toUpperCase()}` 
                                      : attendance.payment_status === 'unpaid'
                                      ? `💸 ${t('unpaid').toUpperCase()}`
                                      : `⏳ ${t('pending').toUpperCase()}`
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Additional Details */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border">
                              <div>
                                <p className="text-xs text-muted-foreground">{t('paymentAmount')}</p>
                                <p className="font-medium">
                                  {attendance.payment_amount ? `${attendance.payment_amount} DA` : t('notSpecified')}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">{t('paymentDate')}</p>
                                <p className="font-medium">
                                  {attendance.payment_date 
                                    ? new Date(attendance.payment_date).toLocaleDateString(language === 'ar' ? 'ar-DZ' : 'en-US')
                                    : t('notPaid')
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">{t('courseType')}</p>
                                <p className="font-medium capitalize">
                                  {attendance.course_type || t('session')}
                                </p>
                              </div>
                            </div>
                            
                            {/* Debt Status */}
                            {attendance.payment_status === 'unpaid' && attendance.status === 'present' && (
                              <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-center space-x-2">
                                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                                  <span className="text-sm font-medium text-orange-800">
                                    <span className="flex items-center">
                                      <AlertCircle className="w-4 h-4 mr-1" />
                                      {t('paymentRequiredMessage')}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">{t('noAttendanceRecords')}</h3>
                      <p className="text-gray-500">{t('attendanceHistoryWillAppear')}</p>
                    </div>
                  )}
                </div>

                {/* Summary Footer */}
                {attendanceLog.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">📊 {t('attendanceSummary')}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-blue-600">{t('attendanceRateLabel')}:</span>
                          <span className="font-bold ml-2">
                            {attendanceLog.length > 0 
                              ? Math.round((attendanceLog.filter(a => a.status === 'present').length / attendanceLog.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600">{t('paymentRateLabel')}:</span>
                          <span className="font-bold ml-2">
                            {attendanceLog.length > 0 
                              ? Math.round((attendanceLog.filter(a => a.payment_status === 'paid').length / attendanceLog.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600">{t('totalSessionsLabel')}:</span>
                          <span className="font-bold ml-2">{attendanceLog.length}</span>
                        </div>
                        <div>
                          <span className="text-blue-600">{t('outstandingDebtLabel')}:</span>
                          <span className="font-bold ml-2 text-red-600">
                            {paymentSummary.outstandingBalance} DA
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
                      <h3 className="font-semibold text-foreground">{t('contactEmail')}</h3>
                      <p className="text-muted-foreground">successroadacademy@outlook.fr</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t('contactPhone')}</h3>
                      <p className="text-muted-foreground">0791 19 74 30 / +213 791 19 74 30</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Address</h3>
                      <p className="text-muted-foreground">CENTRE COMMERCIAL SIRABAH (قيصارية سي رابح)<br />Centre ville nedroma</p>
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
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-6 border border-primary/20">
                <div className="flex items-center space-x-4">
                  {/* Profile Picture */}
                  <ProfilePictureUploader
                    currentImageUrl={user.profile_picture_url}
                    onImageUpdate={(newImageUrl) => {
                      // Update the user context with new profile picture URL
                      updateUser({ profile_picture_url: newImageUrl });
                    }}
                    size="lg"
                    className="flex-shrink-0"
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{user.full_name}</h2>
                    <p className="text-muted-foreground">{user.email || t('noEmailProvided')}</p>
                    <p className="text-sm text-primary font-medium capitalize">{user.role} {t('account')}</p>
                  </div>
                </div>
              </div>

              {/* Profile Management Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Information Card */}
                <div className={`bg-card rounded-xl shadow-luxury border p-6 transition-all duration-200 ${
                  isEditingProfile ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <User className="w-5 h-5 mr-2 text-primary" />
                      {t('personalDetails')}
                    </h3>
                    <button
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className="bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-md"
                      title={t('editPersonalInformation')}
                    >
                      <Edit className="w-4 h-4" />
                      {isEditingProfile ? t('cancel') : t('edit')}
                    </button>
                  </div>

                  {isEditingProfile ? (
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('fullNameLabel')}
                        </label>
                        <input
                          type="text"
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})}
                          className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('emailLabelProfile')}
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                          className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('phoneLabelProfile')}
                        </label>
                        <input
                          type="tel"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                          className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                          required
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          disabled={isUpdatingProfile}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-md"
                        >
                          {isUpdatingProfile ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {t('saveChanges')}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          disabled={isUpdatingProfile}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {t('cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">{t('fullNameLabel')}</span>
                        <span className="font-semibold text-foreground">{user.full_name}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">{t('emailLabelProfile')}</span>
                        <span className="font-semibold text-foreground">{user.email || t('notProvided')}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">{t('phoneLabelProfile')}</span>
                        <span className="font-semibold text-foreground">{user.phone || t('notProvided')}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">{t('memberSinceLabel')}</span>
                        <span className="font-semibold text-foreground">
                          {(user as any).created_at ? new Date((user as any).created_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Parent Information Card - Show for regular users and if profile tab is active */}
                <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <Users className="w-5 h-5 mr-2 text-secondary" />
                      {t('parentInformation')}
                    </h3>
                    <button
                      onClick={() => setIsEditingParent(!isEditingParent)}
                      className="bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-md"
                      type="button"
                    >
                      <Edit className="w-4 h-4" />
                      {isEditingParent ? t('cancel') : t('edit')}
                    </button>
                  </div>

                  {isEditingParent ? (
                    <form onSubmit={handleParentUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('parentFullName')}
                        </label>
                        <input
                          type="text"
                          value={parentForm.full_name}
                          onChange={(e) => setParentForm({...parentForm, full_name: e.target.value})}
                          className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent placeholder:text-muted-foreground"
                          placeholder={t('enterParentFullName')}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('parentEmailLabel')}
                        </label>
                        <input
                          type="email"
                          value={parentForm.email}
                          onChange={(e) => setParentForm({...parentForm, email: e.target.value})}
                          className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent placeholder:text-muted-foreground"
                          placeholder={t('enterParentEmail')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('parentPhoneLabel')}
                        </label>
                        <input
                          type="tel"
                          value={parentForm.phone}
                          onChange={(e) => setParentForm({...parentForm, phone: e.target.value})}
                          className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent placeholder:text-muted-foreground"
                          placeholder={t('enterParentPhone')}
                          required
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          disabled={isUpdatingParent}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-md"
                        >
                          {isUpdatingParent ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              {t('saving')}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {t('saveParentInfo')}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingParent(false)}
                          disabled={isUpdatingParent}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {t('cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">{t('parentNameLabel')}</span>
                        <span className="font-semibold text-foreground">{parentInfo?.full_name || t('notProvided')}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">{t('parentEmailLabel')}</span>
                        <span className="font-semibold text-foreground">{parentInfo?.email || t('notProvided')}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">{t('parentPhoneLabel')}</span>
                        <span className="font-semibold text-foreground">{parentInfo?.phone || t('notProvided')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Enrollments Management Card */}
              {enrollments.length > 0 && (
                <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                  <div className="flex items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <GraduationCap className="w-5 h-5 mr-2 text-accent" />
                      {t('myEnrollments')}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {enrollments.map((enrollment) => (
                      <div key={enrollment.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-foreground">{enrollment.course_name}</h4>
                          <span className="text-sm text-muted-foreground">
                            {enrollment.section_name}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="flex justify-between items-center py-2">
                            <span className="text-muted-foreground">{t('enrollmentDate')}</span>
                            <span className="font-semibold text-foreground">
                              {enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-muted-foreground">{t('paymentType')}</span>
                            <span className="font-semibold text-foreground capitalize">{enrollment.payment_type}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-muted-foreground">Status</span>
                            <span className={`font-semibold ${enrollment.is_active ? 'text-green-600' : 'text-red-600'}`}>
                              {enrollment.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>

                        {enrollment.payment_type === 'monthly' && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="flex justify-between items-center py-1">
                                <span className="text-sm text-muted-foreground">{t('sessionsAttended')}</span>
                                <span className="font-semibold text-foreground">{enrollment.monthly_sessions_attended}/4</span>
                              </div>
                              <div className="flex justify-between items-center py-1">
                                <span className="text-sm text-muted-foreground">{t('paymentStatus')}</span>
                                <span className={`font-semibold ${enrollment.monthly_payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {enrollment.monthly_payment_status}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account Security Card */}
              <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center mb-4">
                  <Shield className="w-5 h-5 mr-2 text-green-600" />
                  {t('accountSecurity')}
                </h3>
                <div className="space-y-4">
                  {/* Parent Mobile Credentials */}
                  {credentialsEligibility?.parent && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-foreground flex items-center">
                          <Smartphone className="w-4 h-4 mr-2 text-primary" />
                          {language === 'ar' ? '📱 بيانات دخول ولي الأمر' : '📱 Parent Mobile App Credentials'}
                        </h4>
                      </div>
                      {credentialsEligibility.parent.has_credentials ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between bg-background p-3 rounded-lg">
                            <span className="text-muted-foreground">
                              📱 {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}:
                            </span>
                            <span className="font-mono font-semibold text-foreground">
                              {credentialsEligibility.parent.phone || 'Not set'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between bg-background p-3 rounded-lg">
                            <span className="text-muted-foreground">
                              🔑 {language === 'ar' ? 'كلمة المرور' : 'Password'}:
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-semibold text-foreground">
                                {showParentPassword ? credentialsEligibility.parent.credentials?.password : '••••••••'}
                              </span>
                              <button
                                onClick={() => setShowParentPassword(!showParentPassword)}
                                className="p-1 hover:bg-muted rounded"
                                type="button"
                              >
                                {showParentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            💡 {language === 'ar' 
                              ? 'استخدم رقم هاتفك وكلمة المرور هذه لتسجيل الدخول إلى التطبيق'
                              : 'Use your phone number and this password to login to the mobile app'}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {language === 'ar' 
                              ? '💡 سيتم إنشاء بيانات الدخول تلقائياً بمجرد استيفاء جميع المتطلبات للطلاب'
                              : '💡 Parent credentials will be generated automatically once student requirements are met'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Students Mobile Credentials and Information */}
                  {credentialsEligibility?.students && credentialsEligibility.students.length > 0 && (
                    <div className="space-y-3">
                      {credentialsEligibility.students.map((studentElig: any) => {
                        const student = user.students?.find(s => s.id === studentElig.student_id);
                        if (!student) return null;
                        
                        return (
                          <div key={student.id} className="p-4 bg-muted/30 rounded-lg border border-border">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-foreground flex items-center">
                                <GraduationCap className="w-4 h-4 mr-2 text-accent" />
                                🎓 {student.name}
                              </h4>
                              <button
                                onClick={() => setIsEditingStudentInfo({ 
                                  ...isEditingStudentInfo, 
                                  [student.id]: !isEditingStudentInfo[student.id] 
                                })}
                                className="text-primary hover:text-primary/80 text-sm flex items-center gap-1"
                                type="button"
                              >
                                <Edit className="w-3 h-3" />
                                {isEditingStudentInfo[student.id] 
                                  ? (language === 'ar' ? 'إلغاء' : 'Cancel')
                                  : (language === 'ar' ? 'تعديل المعلومات' : 'Edit Info')}
                              </button>
                            </div>
                            
                            {/* Student Birthday Section */}
                            <div className="mb-3 pb-3 border-b border-border">
                              <label className="text-xs text-muted-foreground block mb-1">
                                🎂 {language === 'ar' ? 'تاريخ الميلاد' : 'Date of Birth'}
                              </label>
                              {isEditingStudentInfo[student.id] ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="date"
                                    value={studentBirthdays[student.id] || ''}
                                    onChange={(e) => setStudentBirthdays({ 
                                      ...studentBirthdays, 
                                      [student.id]: e.target.value 
                                    })}
                                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
                                  />
                                  <button
                                    onClick={() => handleStudentBirthdayUpdate(student.id)}
                                    className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
                                    type="button"
                                  >
                                    {language === 'ar' ? 'حفظ' : 'Save'}
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-background p-2 rounded-lg">
                                  <span className="font-medium text-foreground">
                                    {student.date_of_birth 
                                      ? new Date(student.date_of_birth).toLocaleDateString() 
                                      : (language === 'ar' 
                                        ? 'غير محدد - انقر على تعديل المعلومات لإضافته'
                                        : 'Not set - Click Edit Info to add')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Mobile App Credentials or Generation UI */}
                            {studentElig.has_credentials ? (
                              <div className="space-y-2 text-sm">
                                <p className="text-xs font-semibold text-green-600 mb-2">
                                  ✅ {language === 'ar' ? 'بيانات الدخول جاهزة' : 'Credentials Ready'}
                                </p>
                                <div className="flex items-center justify-between bg-background p-3 rounded-lg">
                                  <span className="text-muted-foreground">
                                    📱 {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}:
                                  </span>
                                  <span className="font-mono font-semibold text-foreground">
                                    {studentElig.credentials?.phone || user.phone || 'Not set'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between bg-background p-3 rounded-lg">
                                  <span className="text-muted-foreground">
                                    🔑 {language === 'ar' ? 'كلمة المرور' : 'Password'}:
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-semibold text-foreground">
                                      {showStudentPasswords[student.id] 
                                        ? studentElig.credentials?.password 
                                        : '••••••••'}
                                    </span>
                                    <button
                                      onClick={() => setShowStudentPasswords({ 
                                        ...showStudentPasswords, 
                                        [student.id]: !showStudentPasswords[student.id] 
                                      })}
                                      className="p-1 hover:bg-muted rounded"
                                      type="button"
                                    >
                                      {showStudentPasswords[student.id] 
                                        ? <EyeOff className="w-4 h-4" /> 
                                        : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground italic mt-2">
                                  💡 {language === 'ar' 
                                    ? 'استخدم رقم الهاتف وكلمة المرور للدخول إلى التطبيق'
                                    : 'Use the phone number and password to login to the mobile app'}
                                </p>
                              </div>
                            ) : studentElig.eligible ? (
                              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                                  ✅ {language === 'ar' 
                                    ? 'جميع المتطلبات مستوفاة! يمكنك الآن إنشاء بيانات الدخول'
                                    : 'All requirements met! You can now generate mobile credentials'}
                                </p>
                                <button
                                  onClick={() => handleGenerateCredentials(student.id)}
                                  disabled={isGeneratingCredentials[student.id]}
                                  className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  type="button"
                                >
                                  {isGeneratingCredentials[student.id] ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                      {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
                                    </>
                                  ) : (
                                    <>
                                      <Smartphone className="w-4 h-4" />
                                      {language === 'ar' ? 'إنشاء بيانات الدخول' : 'Generate Credentials'}
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                                  ⚠️ {language === 'ar' 
                                    ? 'المتطلبات المفقودة:'
                                    : 'Missing Requirements:'}
                                </p>
                                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                                  {studentElig.missing_requirements?.includes('approved_enrollment') && (
                                    <li className="flex items-start gap-2">
                                      <span>❌</span>
                                      <span>
                                        {language === 'ar' 
                                          ? 'يجب أن يكون لدى الطالب تسجيل معتمد ونشط'
                                          : 'Student must have an approved and active enrollment'}
                                      </span>
                                    </li>
                                  )}
                                  {studentElig.missing_requirements?.includes('parent_info') && (
                                    <li className="flex items-start gap-2">
                                      <span>❌</span>
                                      <span>
                                        {language === 'ar' 
                                          ? 'يجب إكمال معلومات ولي الأمر (الاسم، الهاتف، البريد الإلكتروني)'
                                          : 'Parent information must be complete (name, phone, email)'}
                                      </span>
                                    </li>
                                  )}
                                  {studentElig.missing_requirements?.includes('birth_date') && (
                                    <li className="flex items-start gap-2">
                                      <span>❌</span>
                                      <span>
                                        {language === 'ar' 
                                          ? 'يجب إضافة تاريخ ميلاد الطالب (انقر على "تعديل المعلومات" أعلاه)'
                                          : 'Student birth date must be set (click "Edit Info" above)'}
                                      </span>
                                    </li>
                                  )}
                                  {studentElig.missing_requirements?.includes('student_name') && (
                                    <li className="flex items-start gap-2">
                                      <span>❌</span>
                                      <span>
                                        {language === 'ar' 
                                          ? 'يجب إضافة اسم الطالب'
                                          : 'Student name is required'}
                                      </span>
                                    </li>
                                  )}
                                </ul>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3 italic">
                                  💡 {language === 'ar' 
                                    ? 'بمجرد استيفاء جميع المتطلبات، سيظهر زر إنشاء بيانات الدخول'
                                    : 'Once all requirements are met, a button to generate credentials will appear'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Password Change Card */}
                  <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                    <button
                      onClick={() => setIsChangingPassword(!isChangingPassword)}
                      className="w-full flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center">
                        <Lock className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span className="font-medium text-foreground">{t('changePassword')}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {isChangingPassword && (
                      <form onSubmit={handlePasswordChange} className="mt-4 p-4 bg-muted/30 rounded-lg space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            {t('currentPassword')}
                          </label>
                          <input
                            type="password"
                            value={passwordForm.current}
                            onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                            className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            {t('newPassword')}
                          </label>
                          <input
                            type="password"
                            value={passwordForm.new}
                            onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                            className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            {t('confirmNewPassword')}
                          </label>
                          <input
                            type="password"
                            value={passwordForm.confirm}
                            onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                            className="w-full px-3 py-2 bg-input text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                            required
                          />
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            {t('updatePassword')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsChangingPassword(false)}
                            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        open={showProfileModal}
        onComplete={async () => {
          // Refresh user data after profile completion
          try {
            const token = localStorage.getItem('access_token');
            const response = await axios.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            updateUser(response.data.user);
            setShowProfileModal(false);
            toast.success('Profile completed successfully!');
            // Refresh dashboard data
            fetchDashboardData();
          } catch (error) {
            console.error('Failed to refresh user data:', error);
          }
        }}
        userData={{ user }}
      />
    </div>
  );
};

export default Dashboard;
