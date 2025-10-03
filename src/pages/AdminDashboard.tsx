import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslatedCategory } from '../utils/categoryUtils';
import ProfilePictureUploader from '../components/ProfilePictureUploader';
import axios from 'axios';
import { toast } from 'sonner';
import EnhancedScheduler from '../components/EnhancedScheduler';
import { createPortal } from 'react-dom';
import {
  Users,
  BookOpen,
  FileText,
  BarChart3,
  Mail,
  Settings,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  UserPlus,
  Calendar,
  DollarSign,
  QrCode,
  X,
  TrendingUp,
  User,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Clock,
  AlertTriangle,
  GraduationCap,
  Phone,
  Mail as MailIcon,
  MapPin,
  Star,
  Award,
  Activity,
  PieChart,
  Target,
  Zap,
  Shield,
  Lock,
  Unlock,
  UserCheck,
  RefreshCw,
  UserX,
  Smartphone,
  Bell,
  Minus,
  AlertCircle,
  CheckCircle,
  Search,
  Languages,
  Info
} from 'lucide-react';
import AttendanceOverview from '../components/AttendanceOverview';

// Add pulse animation styles
const pulseAnimation = `
  @keyframes pulse {
    0% {
      box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);
    }
    50% {
      box-shadow: 0 6px 25px rgba(249, 115, 22, 0.8);
    }
    100% {
      box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);
    }
  }
`;

// Inject the animation into the document head if not already present
if (!document.querySelector('#pulse-animation-styles')) {
  const style = document.createElement('style');
  style.id = 'pulse-animation-styles';
  style.textContent = pulseAnimation;
  document.head.appendChild(style);
}

interface Registration {
  id: number;
  parent: {
    id: number;
    full_name: string;
    email: string;
    phone: string;
  };
  student: {
    id: number;
    name: string;
    date_of_birth: string;
  };
  course: {
    id: number;
    name: string;
    price: number;
  };
  status: string;
  payment_status?: string;
  payment_date?: string;
  notes: string;
  created_at: string;
}

interface Course {
  id: number;
  name: string;
  description: string;
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
  created_at?: string;
}

interface CourseSection {
  id: number;
  course_id: number;
  name?: string;
  section_name: string;
  schedule: string;
  multi_day_schedule?: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  max_students: number;
  current_students: number;
  enrolled_students?: number;
  is_active: boolean;
  created_at: string;
  course_name?: string;
  course_category?: string;
  course?: {
    id: number;
    name: string;
    category: string;
    is_active: boolean;
  };
}

interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
}

interface ContactMessage {
  id: number;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  name?: string;
  email?: string;
  subject: string;
  message: string;
  status: string;
  admin_response?: string;
  admin_response_at?: string;
  created_at: string;
  updated_at?: string;
}

interface Student {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  date_of_birth: string;
  age?: number;
  profile_picture_url?: string | null;
  parent?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    profile_picture_url?: string | null;
    mobile_username?: string;
    mobile_app_enabled: boolean;
    user_role: string;
    user_email_verified: boolean;
  };
  mobile_credentials: {
    username?: string;
    app_enabled: boolean;
    password_set: boolean;
    password?: string;
  };
  enrollment_info: {
    total_enrollments: number;
    active_enrollments: number;
    courses: Array<{
      id: number;
      name: string;
      class_name: string;
      day_of_week?: string;
      start_time?: string;
      end_time?: string;
      enrollment_date?: string;
      total_debt?: number;
      debt_sessions?: number;
    }>;
  };
  attendance_stats: {
    total_records: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    attendance_rate: number;
  };
  payment_status?: Array<{
    id: number;
    status: 'paid' | 'pending' | 'overdue';
    amount: number;
    due_date: string;
    payment_date?: string;
    type: 'session' | 'monthly';
    description?: string;
  }>;
  status: {
    has_parent: boolean;
    has_mobile_credentials: boolean;
    mobile_app_enabled: boolean;
    is_enrolled: boolean;
  };
  created_at?: string;
}

interface MobileCredential {
  id: number;
  name: string;
  email: string;
  mobile_username: string;
  mobile_password?: string;
  mobile_app_enabled: boolean;
  type: 'parent' | 'student';
  parent_name?: string;
  student_name?: string;
  course_name?: string;
  students?: Array<{
    id: number;
    name: string;
    course_name?: string;
  }>;
  created_at: string;
}

interface StudentCardProps {
  student: Student;
  onEdit: () => void;
  onDelete: () => void;
  onToggleMobile: () => void;
  onViewDetails: () => void;
  selectedSection: string;
}

const StudentCard: React.FC<StudentCardProps> = ({
  student,
  onEdit,
  onDelete,
  onToggleMobile,
  onViewDetails,
  selectedSection
}) => {
  // Calculate payment status
  const getPaymentStatus = () => {
    if (!student.payment_status || student.payment_status.length === 0) {
      return { status: 'unknown', color: 'gray', bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-200' };
    }
    
    const hasPending = student.payment_status.some((p: any) => p.status === 'pending');
    const hasOverdue = student.payment_status.some((p: any) => p.status === 'overdue');
    const allPaid = student.payment_status.every((p: any) => p.status === 'paid');
    
    if (hasOverdue) {
      return { status: 'overdue', color: 'red', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' };
    } else if (hasPending) {
      return { status: 'pending', color: 'yellow', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' };
    } else if (allPaid) {
      return { status: 'paid', color: 'green', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' };
    }
    return { status: 'unknown', color: 'gray', bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-200' };
  };

  const paymentInfo = getPaymentStatus();
  const attendanceRate = student.attendance_stats.attendance_rate || 0;

  return (
    <div className="bg-gradient-to-br from-card to-card/80 rounded-xl shadow-luxury border-2 border-border/30 p-6 hover:shadow-2xl hover:border-primary/20 transition-all duration-300 group">
      {/* Header with Profile and Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <ProfilePictureUploader
              currentImageUrl={student.profile_picture_url || null}
              size="md"
              editable={false}
              className="flex-shrink-0 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300"
            />
            {/* Status Indicator */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              student.status.mobile_app_enabled ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
              {student.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Age: {student.age || 'N/A'} • DOB: {new Date(student.date_of_birth).toLocaleDateString()}
            </p>
            {student.parent && (
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <User className="w-3 h-3 mr-1" />
                Parent: {student.parent.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Enrollment Status */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3 text-center">
          <BookOpen className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-800">{student.enrollment_info.active_enrollments}</div>
          <div className="text-xs text-blue-600">Active Courses</div>
        </div>

        {/* Attendance Rate */}
        <div className={`bg-gradient-to-br rounded-lg p-3 text-center border ${
          attendanceRate >= 90 ? 'from-green-50 to-green-100 border-green-200' :
          attendanceRate >= 75 ? 'from-yellow-50 to-yellow-100 border-yellow-200' :
          attendanceRate >= 60 ? 'from-orange-50 to-orange-100 border-orange-200' :
          'from-red-50 to-red-100 border-red-200'
        }`}>
          <Activity className={`w-5 h-5 mx-auto mb-1 ${
            attendanceRate >= 90 ? 'text-green-600' :
            attendanceRate >= 75 ? 'text-yellow-600' :
            attendanceRate >= 60 ? 'text-orange-600' :
            'text-red-600'
          }`} />
          <div className={`text-lg font-bold ${
            attendanceRate >= 90 ? 'text-green-800' :
            attendanceRate >= 75 ? 'text-yellow-800' :
            attendanceRate >= 60 ? 'text-orange-800' :
            'text-red-800'
          }`}>
            {attendanceRate.toFixed(1)}%
          </div>
          <div className={`text-xs ${
            attendanceRate >= 90 ? 'text-green-600' :
            attendanceRate >= 75 ? 'text-yellow-600' :
            attendanceRate >= 60 ? 'text-orange-600' :
            'text-red-600'
          }`}>
            Attendance
          </div>
        </div>
      </div>

      {/* Payment Status Section */}
      <div className={`${paymentInfo.bgColor} ${paymentInfo.borderColor} border rounded-lg p-3 mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className={`w-4 h-4 ${paymentInfo.textColor}`} />
            <span className={`text-sm font-medium ${paymentInfo.textColor}`}>
              Payment Status
            </span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${paymentInfo.textColor} ${paymentInfo.bgColor}`}>
            {paymentInfo.status === 'paid' ? '✓ All Paid' :
             paymentInfo.status === 'overdue' ? '⚠️ Overdue' :
             '💰 Payment Due'}
          </span>
        </div>
        
        {/* Payment Details */}
        {student.payment_status && student.payment_status.length > 0 && (
          <div className="mt-2 space-y-1">
            {student.payment_status.slice(0, 2).map((payment: any, index: number) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{payment.type}</span>
                <span className={`font-medium ${
                  payment.status === 'paid' ? 'text-green-600' :
                  payment.status === 'overdue' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {payment.amount} DA - {payment.status}
                </span>
              </div>
            ))}
            {student.payment_status.length > 2 && (
              <div className="text-xs text-muted-foreground text-center">
                +{student.payment_status.length - 2} more...
              </div>
            )}
          </div>
        )}

        {/* Debt Information */}
        {student.enrollment_info.courses.some(course => (course.total_debt || 0) > 0) && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-red-600 font-medium mb-1">Outstanding Debt:</div>
            {student.enrollment_info.courses
              .filter(course => (course.total_debt || 0) > 0)
              .map((course, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate">{course.name}</span>
                  <span className="text-red-600 font-medium">
                    {course.total_debt} DA ({course.debt_sessions} sessions)
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Attendance Progress Section - Check if Kindergarten or Monthly Course */}
      {student.enrollment_info?.courses?.some((c: any) => c.is_kindergarten) ? (
        <div className="bg-gradient-to-br from-purple-50 to-pink-100 border border-purple-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🧸</span>
              <span className="text-sm font-medium text-purple-700">Kindergarten Subscription</span>
            </div>
            <span className="text-xs px-2 py-1 bg-purple-600 text-white rounded-full font-semibold">
              Monthly Attendance Tracking
            </span>
          </div>
          
          {/* Attendance Rate Display for Kindergarten */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-600 font-medium">This Month:</span>
            <span className="text-purple-800 font-bold">
              {((student as any).attendance_stats as any)?.monthly_sessions_attended || 0} Days Present
            </span>
          </div>
          
          {/* Payment Status */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-purple-600">Next Payment:</span>
            <span className="text-purple-800 font-semibold">
              {student.enrollment_info?.courses?.find((c: any) => c.is_kindergarten)?.next_subscription_date || 'Not Set'}
            </span>
          </div>
        </div>
      ) : student.payment_status && student.payment_status.some((p: any) => p.type === 'monthly') ? (
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700">Monthly Progress</span>
            </div>
            <span className="text-xs text-indigo-600 font-semibold">
              {((student as any).attendance_stats as any)?.monthly_sessions_attended || 0}/4 Sessions
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-indigo-200 rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(((((student as any).attendance_stats as any)?.monthly_sessions_attended || 0) / 4) * 100, 100)}%` }}
            ></div>
          </div>
          
          {/* Session Indicators */}
          <div className="flex justify-between">
            {Array.from({ length: 4 }).map((_, index) => {
              const sessionNumber = index + 1;
              const isCompleted = ((((student as any).attendance_stats as any)?.monthly_sessions_attended || 0)) >= sessionNumber;
              const wasPresent = student.attendance_stats.present_count && 
                               student.attendance_stats.present_count >= sessionNumber;
              
              return (
                <div
                  key={index}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    isCompleted
                      ? wasPresent
                        ? 'bg-green-500 text-white border-green-600' // Present
                        : 'bg-red-500 text-white border-red-600'     // Absent
                      : 'bg-white text-indigo-400 border-indigo-300'   // Not completed
                  }`}
                >
                  {sessionNumber}
                </div>
              );
            })}
          </div>
          
          {/* Payment Due Warning */}
          {((((student as any).attendance_stats as any)?.monthly_sessions_attended || 0)) >= 4 && (
            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-xs text-yellow-700 font-medium">Payment Due - Cycle Complete</span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Course Enrollment Display - Read-only */}
      {(student as any).enrollments && (student as any).enrollments.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Current Enrollments</span>
            <span className="text-xs text-slate-500">
              {(student as any).enrollments.length} Course{(student as any).enrollments.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="space-y-3">
            {(student as any).enrollments.map((enrollment: any, index: number) => (
              <div key={index} className={`border rounded-lg p-3 ${
                enrollment.is_kindergarten 
                  ? 'border-pink-300 bg-gradient-to-br from-pink-50 to-purple-50' 
                  : 'border-slate-200 bg-white/50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 truncate">
                    {enrollment.is_kindergarten && '🧸 '}
                    {enrollment.course_name}
                  </span>
                  <div className="flex items-center space-x-2">
                    {enrollment.is_kindergarten ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm">
                        🧸 Kindergarten
                      </span>
                    ) : (
                      <>
                        {(enrollment.total_debt || 0) > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm">
                            💰 {enrollment.total_debt} DA
                            {enrollment.debt_sessions && enrollment.debt_sessions > 0 && (
                              <span className="ml-1 opacity-90">({enrollment.debt_sessions} sessions)</span>
                            )}
                          </span>
                        )}
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded ${
                          (enrollment.pricing_type || 'session') === 'monthly' 
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {(enrollment.pricing_type || 'session') === 'monthly' ? 'Monthly' : 'Session'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile App Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Mobile Access:</span>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          student.status.mobile_app_enabled
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-muted text-muted-foreground border border-border'
        }`}>
          {student.status.mobile_app_enabled ? '✓ Enabled' : '✗ Disabled'}
        </span>
      </div>

      {/* Enhanced Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex space-x-2">
          <button
            onClick={onViewDetails}
            className="px-3 py-1.5 text-sm bg-gradient-to-r from-primary/10 to-primary/20 text-primary rounded-lg hover:from-primary/20 hover:to-primary/30 transition-all duration-300 border border-primary/20"
          >
            <Eye className="w-4 h-4 inline mr-1" />
            View
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500/10 to-blue-500/20 text-blue-600 rounded-lg hover:from-blue-500/20 hover:to-blue-500/30 transition-all duration-300 border border-blue-500/20"
          >
            <Edit className="w-4 h-4 inline mr-1" />
            Edit
          </button>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onToggleMobile}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all duration-300 border ${
              student.status.mobile_app_enabled
                ? 'bg-gradient-to-r from-red-500/10 to-red-500/20 text-red-600 hover:from-red-500/20 hover:to-red-500/30 border-red-500/20'
                : 'bg-gradient-to-r from-green-500/10 to-green-500/20 text-green-600 hover:from-green-500/20 hover:to-green-500/30 border-green-500/20'
            }`}
          >
            {student.status.mobile_app_enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm bg-gradient-to-r from-red-500/10 to-red-500/20 text-red-600 rounded-lg hover:from-red-500/20 hover:to-red-500/30 transition-all duration-300 border border-red-500/20"
          >
            <Trash2 className="w-4 h-4 inline mr-1" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { translateCategory, getCategoryColors } = useTranslatedCategory();

  // Check if user is authenticated and has admin role
  if (!user) {
    // Redirect to login page
    useEffect(() => {
      navigate('/login');
    }, [navigate]);
    
    return (
      <div className="min-h-screen bg-gradient-luxury flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Please log in to access the admin dashboard.</p>
          <p className="text-sm text-muted-foreground mt-2">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    // Redirect non-admin users to regular dashboard
    useEffect(() => {
      navigate('/dashboard');
    }, [navigate]);
    
    return (
      <div className="min-h-screen bg-gradient-luxury flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access the admin dashboard.</p>
          <p className="text-sm text-muted-foreground mt-2">Redirecting to user dashboard...</p>
        </div>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState('people-management');
  const [activeSubTab, setActiveSubTab] = useState('students');
  const [activeContentSubTab, setActiveContentSubTab] = useState('contact');
  const [activeAttendanceSubTab, setActiveAttendanceSubTab] = useState('overview');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [approvedRegistrations, setApprovedRegistrations] = useState<Registration[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseSections, setCourseSections] = useState<{[courseId: number]: CourseSection[]}>({});
  const [allSections, setAllSections] = useState<CourseSection[]>([]);
  const [activeSections, setActiveSections] = useState<CourseSection[]>([]);
  const [lastActiveSessionsUpdate, setLastActiveSessionsUpdate] = useState<number>(0);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [selectedCourseForSections, setSelectedCourseForSections] = useState<Course | null>(null);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [sectionForm, setSectionForm] = useState({
    section_name: '',
    schedule: '',
    day_of_week: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    max_students: '',
    multi_day_schedule: null as string | null,
    is_active: true
  });
  const [users, setUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  
  // Contact message modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // Language tab state for notifications
  const [activeLanguageTab, setActiveLanguageTab] = useState<'en' | 'ar'>('en');
  
  const [mobileCredentials, setMobileCredentials] = useState<MobileCredential[]>([]);
  const [regeneratingCredentials, setRegeneratingCredentials] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  
  const [qrCodes, setQrCodes] = useState<{[courseId: number]: string}>({});
  const [generatingQRs, setGeneratingQRs] = useState<Set<number>>(new Set());
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    name: '',
    description: '',
    price: '',
    max_students: '',
    image: null as File | null
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalCourses: 0,
    pendingRegistrations: 0,
    approvedRegistrations: 0,
    unreadMessages: 0
  });
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  
  // Enhanced Student Management State
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [activeSessionsFilter, setActiveSessionsFilter] = useState<string>('all'); // New filter for active sessions
  const [filteredStudentsCount, setFilteredStudentsCount] = useState<number>(0);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [studentsViewMode, setStudentsViewMode] = useState<'table' | 'cards'>('table');
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [markingAttendance, setMarkingAttendance] = useState<Set<number>>(new Set());
  const [processingPayments, setProcessingPayments] = useState<Set<number>>(new Set());
  const [currentSessions, setCurrentSessions] = useState<CourseSection[]>([]);
  const [studentsTableData, setStudentsTableData] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Pending Registrations State
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<string>('pending');
  const [registrationCourseFilter, setRegistrationCourseFilter] = useState<string>('all');
  const [registrationSearchTerm, setRegistrationSearchTerm] = useState<string>('');
  const [showRegistrationDetailsModal, setShowRegistrationDetailsModal] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);

  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [monthlyPaymentsDue, setMonthlyPaymentsDue] = useState<any[]>([]);
  const [processingPayment, setProcessingPayment] = useState<number | null>(null);
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  
  // Notification State - Bilingual support
  const [notificationTitleEn, setNotificationTitleEn] = useState('');
  const [notificationTitleAr, setNotificationTitleAr] = useState('');
  const [notificationMessageEn, setNotificationMessageEn] = useState('');
  const [notificationMessageAr, setNotificationMessageAr] = useState('');
  // Legacy fields for backward compatibility
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTarget, setNotificationTarget] = useState('all');
  const [notificationType, setNotificationType] = useState('info');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [showBilingualForm, setShowBilingualForm] = useState(true);  // Default to bilingual form
  
  // Attendance Modal States
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedStudentAttendance, setSelectedStudentAttendance] = useState<any>(null);
  
  // Time Restriction Modal States
  const [showTimeRestrictionModal, setShowTimeRestrictionModal] = useState(false);
  const [timeRestrictionData, setTimeRestrictionData] = useState<any>(null);
  const [pendingAttendanceAction, setPendingAttendanceAction] = useState<any>(null);
  
  // Debt Clearance Modal States
  const [showDebtClearanceModal, setShowDebtClearanceModal] = useState(false);
  const [debtClearanceData, setDebtClearanceData] = useState<any>(null);

  // Kindergarten Management States
  const [selectedKindergartenView, setSelectedKindergartenView] = useState<'all' | 'active' | 'pending' | 'expired'>('all');
  const [selectedKindergartenEnrollment, setSelectedKindergartenEnrollment] = useState<any>(null);
  const [showKindergartenDetailModal, setShowKindergartenDetailModal] = useState(false);
  const [showKindergartenAttendanceModal, setShowKindergartenAttendanceModal] = useState(false);
  const [showKindergartenPaymentModal, setShowKindergartenPaymentModal] = useState(false);
  
  // Test modal visibility with a simple state
  const [testModalVisible, setTestModalVisible] = useState(false);
  
  // Test function to force trigger time restriction modal
  const testTimeRestrictionModal = () => {
    // Test removed - alert('Test modal triggered!');
    setPendingAttendanceAction({
      studentId: 1,
      sectionId: 1,
      isPresent: true,
      courseType: 'session',
      action: 'mark',
      addAsAbsent: false
    });
    setTimeRestrictionData({
      error: 'Time restriction violation',
      message: 'TEST: Too early to mark attendance. Class starts at 14:00, marking allowed from 13:30',
      warning_needed: true,
      current_time: '23:57',
      class_schedule: {
        start_time: '14:00',
        end_time: '15:30',
        day: 'Monday'
      }
    });
    setShowTimeRestrictionModal(true);
  };
  
  const [paymentFilterType, setPaymentFilterType] = useState('all'); // 'all', 'session', 'monthly'
  
  // Attendance Management State
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [paymentSortBy, setPaymentSortBy] = useState('date'); // 'date', 'amount', 'name'
  const [paymentSortOrder, setPaymentSortOrder] = useState('desc'); // 'asc', 'desc'
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  
  // Payment Modal States - REPLACED WITH TOAST NOTIFICATIONS
  // const [showPaymentModal, setShowPaymentModal] = useState(false);
  // const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  // const [processingSessionPayment, setProcessingSessionPayment] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Comprehensive student filtering with optimized performance
  const filteredStudentsData = useMemo(() => {
    if (!studentsTableData) return [];
    
    return studentsTableData.filter(student => {
      // Search filter
      const searchMatch = debouncedSearchTerm === '' || 
        student.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        student.phone?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        student.parent?.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      // Course filter  
      const courseMatch = selectedCourse === 'all' || 
        student.enrollments?.some((enrollment: any) => 
          enrollment.course_id?.toString() === selectedCourse
        );

      // Section filter (regular sections only)
      const sectionMatch = selectedSection === 'all' || 
        student.enrollments?.some((enrollment: any) => 
          enrollment.class_id?.toString() === selectedSection
        );

      // Active Sessions filter (new dedicated filter)
      let activeSessionMatch = true;
      if (activeSessionsFilter !== 'all') {
        activeSessionMatch = student.enrollments?.some((enrollment: any) => {
          const section = allSections.find(s => s.id === enrollment.class_id);
          if (!section) return false;

          switch (activeSessionsFilter) {
            case 'live':
              return isCurrentlyLive(section);
            case 'starting-soon':
              return isStartingSoon(section);
            case 'ending-soon':
              return isEndingSoon(section);
            case 'active-window':
              return isInActiveWindow(section);
            default:
              return true;
          }
        });
      }

      // Status filter
      const statusMatch = studentStatusFilter === 'all' || 
        (studentStatusFilter === 'active' && student.status?.is_enrolled) ||
        (studentStatusFilter === 'pending' && !student.status?.is_enrolled) ||
        (studentStatusFilter === 'inactive' && student.status?.is_inactive);

      // Payment filter
      const paymentMatch = paymentStatusFilter === 'all' || 
        (paymentStatusFilter === 'paid' && student.payment_status?.every((payment: any) => payment.status === 'paid')) ||
        (paymentStatusFilter === 'pending' && student.payment_status?.some((payment: any) => payment.status === 'pending')) ||
        (paymentStatusFilter === 'overdue' && student.payment_status?.some((payment: any) => payment.status === 'overdue'));

      return searchMatch && courseMatch && sectionMatch && activeSessionMatch && statusMatch && paymentMatch;
    });
  }, [studentsTableData, debouncedSearchTerm, selectedCourse, selectedSection, activeSessionsFilter, allSections, studentStatusFilter, paymentStatusFilter]);

  // Update counts when filtered data changes
  useEffect(() => {
    setFilteredStudentsCount(filteredStudentsData.length);
    setTotalStudentsCount(studentsTableData.length);
  }, [filteredStudentsData, studentsTableData]);

  // Filtered registrations for pending registrations tab
  const filteredRegistrations = useMemo(() => {
    if (!registrations) return [];
    
    return registrations.filter(registration => {
      // Status filter
      const statusMatch = registrationStatusFilter === 'all' || registration.status === registrationStatusFilter;
      
      // Course filter
      const courseMatch = registrationCourseFilter === 'all' || registration.course_id?.toString() === registrationCourseFilter;
      
      // Search filter
      const searchMatch = registrationSearchTerm === '' ||
        registration.first_name?.toLowerCase().includes(registrationSearchTerm.toLowerCase()) ||
        registration.last_name?.toLowerCase().includes(registrationSearchTerm.toLowerCase()) ||
        registration.email?.toLowerCase().includes(registrationSearchTerm.toLowerCase()) ||
        registration.phone?.toLowerCase().includes(registrationSearchTerm.toLowerCase()) ||
        registration.course_name?.toLowerCase().includes(registrationSearchTerm.toLowerCase());
      
      return statusMatch && courseMatch && searchMatch;
    }).sort((a, b) => {
      // Sort by registration date (newest first)
      return new Date(b.registration_date).getTime() - new Date(a.registration_date).getTime();
    });
  }, [registrations, registrationStatusFilter, registrationCourseFilter, registrationSearchTerm]);

  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsData, setCredentialsData] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [sectionSelectionData, setSectionSelectionData] = useState<{
    registrationId: number;
    availableSections: Array<{
      id: number;
      name: string;
      schedule: string;
      available_seats: number;
    }>;
  } | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Attendance-related state variables
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [indebtedUsers, setIndebtedUsers] = useState<any[]>([]);
  const [showIndebtedUsers, setShowIndebtedUsers] = useState(false);
  const [selectedIndebtedUser, setSelectedIndebtedUser] = useState<any>(null);
  const [showClearDebtDialog, setShowClearDebtDialog] = useState(false);
  const [clearDebtAmount, setClearDebtAmount] = useState(0);
  
  // Enhanced attendance and payment state
  const [bulkAttendanceAction, setBulkAttendanceAction] = useState<'clear_attendance' | 'clear_payments' | 'clear_both' | null>(null);
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [processingBulkAction, setProcessingBulkAction] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      setLoading(true);
      fetchDashboardData().finally(() => setLoading(false));
    }
  }, [user]);

  // Enhanced Students Management Effects
  useEffect(() => {
    if (user?.role === 'admin' && activeTab === 'people-management' && activeSubTab === 'students') {
      Promise.all([
        fetchStudentsTableData(),
        fetchCurrentSessions()
      ]);
      
      // Refresh current sessions every 5 minutes
      const interval = setInterval(fetchCurrentSessions, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, activeTab, activeSubTab, selectedSection]);

  // Notifications Management Effects
  useEffect(() => {
    if (user?.role === 'admin' && activeTab === 'people-management' && activeSubTab === 'notifications') {
      fetchRecentNotifications();
    }
  }, [user, activeTab, activeSubTab]);

  useEffect(() => {
    if (selectedSection !== 'all') {
      fetchStudentsTableData();
    }
  }, [selectedSection]);

  const [dataCache, setDataCache] = useState<{[key: string]: {data: any, timestamp: number}}>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const fetchDashboardData = async (forceRefresh = false) => {
    const now = Date.now();

    // Check if we should use cached data
    if (!forceRefresh && (now - lastFetchTime) < CACHE_DURATION && Object.keys(dataCache).length > 0) {
      return;
    }

    setLoading(true);
    try {

      // Create individual error handlers for each API call
      const apiCalls = [
        { key: 'registrations', call: axios.get('/api/admin/registrations?status=pending') },
        { key: 'approvedRegistrations', call: axios.get('/api/admin/registrations?status=approved') },
        { key: 'courses', call: axios.get('/api/admin/courses') },
        { key: 'users', call: axios.get('/api/admin/users') },
        { key: 'contactMessages', call: axios.get('/api/contact/messages') },
        { key: 'students', call: axios.get('/api/admin/students') },
        { key: 'mobileCredentials', call: axios.get('/api/admin/mobile-credentials') }
      ];

      // Execute API calls with individual error handling
      const results = await Promise.allSettled(apiCalls.map(item => item.call));

      const newCache: {[key: string]: any} = {};

      results.forEach((result, index) => {
        const apiCall = apiCalls[index];
        if (result.status === 'fulfilled') {
          newCache[apiCall.key] = result.value.data;
        } else {
          console.error(`Failed to fetch ${apiCall.key}:`, result.reason);
          // Use cached data if available, otherwise use empty array/object
          if (apiCall.key === 'contactMessages') {
            newCache[apiCall.key] = { messages: dataCache[apiCall.key]?.data?.messages || [] };
          } else {
            newCache[apiCall.key] = dataCache[apiCall.key]?.data || [];
          }
        }
      });

      // Update state with new data
      setRegistrations(newCache.registrations?.registrations || []);
      setApprovedRegistrations(newCache.approvedRegistrations?.registrations || []);
      setCourses(newCache.courses?.courses || []);
      setUsers(newCache.users?.users || []);
      setContactMessages(newCache.contactMessages?.messages || newCache.contactMessages || []);
      setStudents(newCache.students?.students || []);
      setAllStudents(newCache.students?.students || []); // Also set allStudents for payment modal
      setMobileCredentials(newCache.mobileCredentials?.credentials || []);

      // Update cache
      const cacheUpdate: {[key: string]: {data: any, timestamp: number}} = {};
      Object.keys(newCache).forEach(key => {
        cacheUpdate[key] = { data: newCache[key], timestamp: now };
      });
      setDataCache(cacheUpdate);
      setLastFetchTime(now);

      // Calculate stats with memoized computation
      const totalUsers = newCache.users?.length || 0;
      const totalStudents = newCache.students?.length || 0;
      const totalCourses = newCache.courses?.length || 0;
      const pendingRegs = newCache.registrations?.length || 0;
      const approvedRegs = newCache.approvedRegistrations?.length || 0;
      const contactMessagesArray = newCache.contactMessages?.messages || newCache.contactMessages || [];
      const unreadMessages = Array.isArray(contactMessagesArray) ? contactMessagesArray.filter((msg: ContactMessage) => msg.status === 'unread').length : 0;

      setStats({
        totalUsers,
        totalStudents,
        totalCourses,
        pendingRegistrations: pendingRegs,
        approvedRegistrations: approvedRegs,
        unreadMessages
      });

      // Fetch sections and payments only if courses data changed
      const coursesChanged = JSON.stringify(newCache.courses) !== JSON.stringify(dataCache.courses?.data);
      if (coursesChanged || forceRefresh) {
        await fetchAllSections(newCache.courses || []);
      }

      // Always fetch fresh payment data as it's time-sensitive
      await fetchPendingPayments();

    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data. Some features may not work properly.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentNotifications = async () => {
    try {
      const response = await axios.get('/api/admin/notifications/recent');
      setRecentNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch recent notifications:', error);
    }
  };

  const fetchAllSections = async (courses: Course[]) => {
    try {
      // Use the new bulk endpoint instead of individual calls
      const response = await axios.get('/api/courses/sections/all');
      const sections = response.data.sections || [];

      const allSectionsData: CourseSection[] = [];
      const courseSectionsData: {[courseId: number]: CourseSection[]} = {};

      // Group sections by course_id
      sections.forEach((section: CourseSection) => {
        const courseId = section.course_id;
        if (!courseSectionsData[courseId]) {
          courseSectionsData[courseId] = [];
        }
        courseSectionsData[courseId].push(section);
        allSectionsData.push(section);
      });

      setCourseSections(courseSectionsData);
      setAllSections(allSectionsData);
    } catch (error) {
      console.error('Failed to fetch all sections:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  const handleApproveRegistration = async (registrationId: number, selectedSectionId?: number) => {
    try {
      const payload: any = {};
      if (selectedSectionId) {
        payload.section_id = selectedSectionId;
      }

      const response = await axios.post(`/api/admin/registrations/${registrationId}/approve`, payload);

      if (response.data.requires_section_choice) {
        // Show section selection modal
        setSectionSelectionData({
          registrationId,
          availableSections: response.data.available_sections
        });
        return;
      }

      toast.success('Registration approved successfully');
      fetchDashboardData();
    } catch (error: any) {
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to approve registration');
      }
    }
  };

  // handleUpdatePaymentStatus function removed - actions disabled in read-only mode
  // Payment data can be viewed but not modified
  const handleUpdatePaymentStatus_DISABLED = async (registrationId: number, paymentStatus: string) => {
    toast.info('Payment status updates are disabled - Dashboard is in read-only mode for payment management');
    return;
  };

  const handleRejectRegistration = (registrationId: number) => {
    const reason = prompt('Please provide a reason for rejection (optional):');
    if (reason !== null) { // User didn't cancel
      handleRegistrationAction(registrationId, 'reject', reason);
    }
  };

  const handleRegistrationAction = async (registrationId: number, action: 'approve' | 'reject', reason?: string) => {
    try {
      await axios.post('/api/admin/registrations/action', {
        registration_id: registrationId,
        action,
        reason
      });

      // Refresh registrations data
      fetchRegistrations();
      toast.success(`Registration ${action}d successfully!`);
      
      // Close modal if open
      setShowRegistrationDetailsModal(false);
    } catch (error) {
      console.error(`Error ${action}ing registration:`, error);
      toast.error(`Error ${action}ing registration`);
    }
  };

  const handleViewRegistrationDetails = (registration: any) => {
    setSelectedRegistration(registration);
    setShowRegistrationDetailsModal(true);
  };

  const fetchRegistrations = async () => {
    try {
      const response = await axios.get('/api/admin/registrations');
      setRegistrations(response.data.registrations || []);
      // Also update courses for filtering if they are included in the response
      if (response.data.courses) {
        setCourses(response.data.courses);
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
      toast.error('Error fetching registrations');
    }
  };

  // Fetch registrations when tab is active
  useEffect(() => {
    if (activeSubTab === 'pending-registrations') {
      fetchRegistrations();
    }
  }, [activeSubTab]);

  const handleGenerateQR = async (courseId: number) => {
    setGeneratingQRs(prev => new Set(prev).add(courseId));
    try {
      const response = await axios.post(`/api/admin/courses/${courseId}/generate-qr`);
      setQrCodes(prev => ({
        ...prev,
        [courseId]: response.data.qr_code_data
      }));
      toast.success('QR code generated successfully');
    } catch (error) {
      toast.error('Failed to generate QR code');
    } finally {
      setGeneratingQRs(prev => {
        const newSet = new Set(prev);
        newSet.delete(courseId);
        return newSet;
      });
    }
  };

  const handleRegenerateCredentials = async (userId: number, userType: 'parent' | 'student') => {
    try {
      setRegeneratingCredentials(prev => new Set(prev).add(userId));

      const response = await axios.post(`/api/admin/regenerate-mobile-credentials/${userId}`, {
        user_type: userType
      });

      const newCredentials = response.data.credentials;

      // Update the credentials in the state
      setMobileCredentials(prev => prev.map(cred =>
        cred.id === userId && cred.type === userType
          ? {
              ...cred,
              mobile_username: newCredentials.username,
              mobile_password: newCredentials.password
            }
          : cred
      ));

      toast.success(`${userType === 'parent' ? t('parent') : t('student')} ${t('credentialsRegenerated')}`);
    } catch (error: any) {
      console.error('Failed to regenerate credentials:', error);
      toast.error(t('regenerateCredentialsFailed'));
    } finally {
      setRegeneratingCredentials(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', courseForm.name);
      formData.append('description', courseForm.description);
      formData.append('price', courseForm.price);
      formData.append('max_students', courseForm.max_students);
      if (courseForm.image) {
        formData.append('image', courseForm.image);
      }

      // Create the course first
      const courseResponse = await axios.post('/api/admin/courses', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const newCourse = courseResponse.data.course;

      // Automatically create a default section with 30 seats
      try {
        await axios.post(`/api/courses/${newCourse.id}/sections`, {
          section_name: 'Section A',
          schedule: 'TBD', // To be determined via visual scheduler
          start_date: null,
          end_date: null,
          max_students: 30,
          is_active: true
        });

        toast.success('Course and default section created successfully');
      } catch (sectionError) {
        console.error('Failed to create default section:', sectionError);
        toast.success('Course created successfully (default section creation failed)');
      }

      setShowCourseModal(false);
      setCourseForm({ name: '', description: '', price: '', max_students: '', image: null });
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to create course');
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    try {
      const formData = new FormData();
      formData.append('name', courseForm.name);
      formData.append('description', courseForm.description);
      formData.append('price', courseForm.price);
      formData.append('max_students', courseForm.max_students);
      formData.append('category', editingCourse.category);
      formData.append('is_active', editingCourse.is_active.toString());
      if (courseForm.image) {
        formData.append('image', courseForm.image);
      }

      await axios.put(`/api/admin/courses/${editingCourse.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Course updated successfully');
      setShowCourseModal(false);
      setEditingCourse(null);
      setCourseForm({ name: '', description: '', price: '', max_students: '', image: null });
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update course');
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (confirm('Are you sure you want to delete this course? This will permanently delete the course and ALL related classes, registrations, and associated data. This action cannot be undone.')) {
      try {
        await axios.delete(`/api/admin/courses/${courseId}`);
        toast.success('Course deleted successfully');
        fetchDashboardData();
      } catch (error) {
        toast.error('Failed to delete course');
      }
    }
  };

  const handleManageSections = async (course: Course) => {
    setSelectedCourseForSections(course);
    
    // Fetch sections if not already loaded
    if (!courseSections[course.id]) {
      try {
        const response = await axios.get(`/api/courses/${course.id}/sections`);
        const sections = response.data.sections || [];
        
        // Add course name to each section
        const sectionsWithCourseName = sections.map((section: CourseSection) => ({
          ...section,
          course_name: course.name
        }));
        
        setCourseSections(prev => ({
          ...prev,
          [course.id]: sectionsWithCourseName
        }));
        
        // Update allSections as well
        setAllSections(prev => {
          // Remove existing sections for this course
          const filtered = prev.filter(s => s.course_id !== course.id);
          // Add the new sections
          return [...filtered, ...sectionsWithCourseName];
        });
      } catch (error) {
        console.error('Failed to fetch course sections:', error);
      }
    }
    
    setShowSectionModal(true);
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForSections) return;

    try {
      const response = await axios.post(`/api/courses/${selectedCourseForSections.id}/sections`, {
        section_name: sectionForm.section_name,
        schedule: sectionForm.schedule,
        start_date: sectionForm.start_date || null,
        end_date: sectionForm.end_date || null,
        max_students: parseInt(sectionForm.max_students) || 30,
        is_active: sectionForm.is_active
      });

      toast.success('Section created successfully');
      
      // Add course name to the new section
      const newSection = {
        ...response.data.section,
        course_name: selectedCourseForSections.name
      };
      
      // Update sections state
      setCourseSections(prev => ({
        ...prev,
        [selectedCourseForSections.id]: [
          ...(prev[selectedCourseForSections.id] || []),
          newSection
        ]
      }));
      
      // Update allSections state
      setAllSections(prev => [...prev, newSection]);

      // Reset form
      setSectionForm({
        section_name: '',
        schedule: '',
        day_of_week: '',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        max_students: '',
        multi_day_schedule: null,
        is_active: true
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create section');
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (!selectedCourseForSections) return;
    
    if (confirm('Are you sure you want to delete this section?')) {
      try {
        await axios.delete(`/api/courses/sections/${sectionId}`);
        toast.success('Section deleted successfully');
        
        // Update sections state
        setCourseSections(prev => ({
          ...prev,
          [selectedCourseForSections.id]: prev[selectedCourseForSections.id]?.filter(s => s.id !== sectionId) || []
        }));
        
        // Update allSections state
        setAllSections(prev => prev.filter(s => s.id !== sectionId));
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete section');
      }
    }
  };

  const handleScheduleUpdate = async (sectionId: number, timeSlot: { day: string; time: string; duration: number }) => {
    try {
      let scheduleString: string;

      if (timeSlot.day === 'TBD') {
        scheduleString = 'TBD';
      } else {
        const endTime = new Date(new Date(`2000-01-01T${timeSlot.time}`).getTime() + timeSlot.duration * 60 * 1000).toTimeString().slice(0, 5);
        scheduleString = `${timeSlot.day} ${timeSlot.time}-${endTime}`;
      }

      await axios.put(`/api/courses/sections/${sectionId}`, {
        schedule: scheduleString
      });

      toast.success('Section schedule updated successfully');

      // Update local state
      setAllSections(prev => prev.map(section =>
        section.id === sectionId
          ? { ...section, schedule: scheduleString }
          : section
      ));

      // Also update courseSections
      setCourseSections(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(courseId => {
          updated[parseInt(courseId)] = updated[parseInt(courseId)]?.map(section => 
            section.id === sectionId 
              ? { ...section, schedule: scheduleString }
              : section
          ) || [];
        });
        return updated;
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update section schedule');
    }
  };

  const handleEditSection = (section: CourseSection) => {
    setEditingSection(section);
    setSectionForm({
      section_name: section.section_name || section.name || '',
      day_of_week: '', // Will be handled by multi-day schedule
      start_time: section.start_time || section.start_date || '',
      end_time: section.end_time || section.end_date || '',
      max_students: section.max_students.toString(),
      multi_day_schedule: section.multi_day_schedule || null,
      is_active: section.is_active
    });
    setShowSectionModal(true);
  };

  const handleSectionUpdate = async (section: CourseSection) => {
    try {
      await axios.put(`/api/courses/sections/${section.id}`, section);
      toast.success('Section updated successfully');

      // Update local state
      setAllSections(prev => prev.map(s => s.id === section.id ? section : s));

      // Also update courseSections
      setCourseSections(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(courseId => {
          updated[parseInt(courseId)] = updated[parseInt(courseId)]?.map(s =>
            s.id === section.id ? section : s
          ) || [];
        });
        return updated;
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update section');
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const [pendingRes, monthlyRes] = await Promise.all([
        axios.get('/api/payments/admin/pending'),
        axios.get('/api/payments/admin/monthly-due')
      ]);

      setPendingPayments(pendingRes.data.pending_payments || []);
      setMonthlyPaymentsDue(monthlyRes.data.monthly_payments_due || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      toast.error('Failed to load payment data');
    }
  };

  // Payment processing function removed - Admin dashboard is read-only for payments

  // Payment filtering and sorting functions
  const filterPayments = (payments: any[], type: string) => {
    return payments.filter(payment => {
      const matchesSearch = paymentSearchTerm === '' ||
        payment.student_name.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
        payment.parent_name.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
        payment.course_name.toLowerCase().includes(paymentSearchTerm.toLowerCase());

      const matchesType = paymentFilterType === 'all' || type === paymentFilterType;

      return matchesSearch && matchesType;
    });
  };

  const sortPayments = (payments: any[], type: string) => {
    return [...payments].sort((a, b) => {
      let aValue, bValue;

      switch (paymentSortBy) {
        case 'amount':
          aValue = a.amount_due;
          bValue = b.amount_due;
          break;
        case 'name':
          aValue = a.student_name.toLowerCase();
          bValue = b.student_name.toLowerCase();
          break;
        case 'date':
        default:
          aValue = type === 'session' ? new Date(a.attendance_date) : new Date();
          bValue = type === 'session' ? new Date(b.attendance_date) : new Date();
          break;
      }

      if (paymentSortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  // Bulk payment processing functions removed - Admin dashboard shows payment data only

  const fetchPaymentHistory = async () => {
    try {
      // This would need a new API endpoint for payment history
      // For now, we'll show a placeholder
      setPaymentHistory([]);
      setShowPaymentHistory(true);
    } catch (error) {
      toast.error('Failed to load payment history');
    }
  };

  const handleSendReminders = async (reminderType: string) => {
    try {
      const response = await axios.post('/api/payments/admin/send-reminders', {
        reminder_type: reminderType,
        days_overdue: 7
      });

      toast.success(`Successfully sent ${response.data.reminders_sent} payment reminders`);

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Some reminders failed to send:', response.data.errors);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send payment reminders');
    }
  };

  const handleSendNotification = async () => {
    // Check if using bilingual or legacy form
    const isUsingBilingual = showBilingualForm && (notificationTitleEn || notificationTitleAr || notificationMessageEn || notificationMessageAr);
    
    if (isUsingBilingual) {
      // Validate bilingual form - at least one language must have both title and message
      const hasEnglishContent = notificationTitleEn.trim() && notificationMessageEn.trim();
      const hasArabicContent = notificationTitleAr.trim() && notificationMessageAr.trim();
      
      if (!hasEnglishContent && !hasArabicContent) {
        toast.error('Please fill in both title and message for at least one language (English or Arabic)');
        return;
      }
    } else {
      // Validate legacy form
      if (!notificationTitle.trim() || !notificationMessage.trim()) {
        toast.error('Please fill in both title and message');
        return;
      }
    }

    setSendingNotification(true);
    try {
      let requestData;
      
      if (isUsingBilingual) {
        requestData = {
          title_en: notificationTitleEn.trim() || null,
          title_ar: notificationTitleAr.trim() || null,
          message_en: notificationMessageEn.trim() || null,
          message_ar: notificationMessageAr.trim() || null,
          target_users: notificationTarget,
          type: notificationType
        };
      } else {
        // Legacy format
        requestData = {
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
          target_users: notificationTarget,
          type: notificationType
        };
      }

      const response = await axios.post('/api/admin/send-notification', requestData);

      toast.success(`Notification sent successfully to ${response.data.sent_count} recipients`);

      // Clear form
      if (isUsingBilingual) {
        setNotificationTitleEn('');
        setNotificationTitleAr('');
        setNotificationMessageEn('');
        setNotificationMessageAr('');
      } else {
        setNotificationTitle('');
        setNotificationMessage('');
      }
      setNotificationTarget('all');
      setNotificationType('info');

      // Refresh recent notifications
      fetchRecentNotifications();
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error.response?.data?.message || 'Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  // Filtered and sorted payments with memoization
  const filteredPendingPayments = useMemo(() =>
    sortPayments(filterPayments(pendingPayments, 'session'), 'session'),
    [pendingPayments, paymentSearchTerm, paymentFilterType, paymentSortBy, paymentSortOrder]
  );

  const filteredMonthlyPaymentsDue = useMemo(() =>
    sortPayments(filterPayments(monthlyPaymentsDue, 'monthly'), 'monthly'),
    [monthlyPaymentsDue, paymentSearchTerm, paymentFilterType, paymentSortBy, paymentSortOrder]
  );

  // Memoized stats calculations
  const paymentStats = useMemo(() => ({
    sessionPaymentsDue: filteredPendingPayments.filter(p => p.payment_type === 'session').reduce((total, payment) => total + payment.amount_due, 0),
    monthlyPaymentsDue: filteredPendingPayments.filter(p => p.payment_type === 'monthly').reduce((total, payment) => total + payment.amount_due, 0),
    totalRevenueDue: filteredPendingPayments.reduce((total, payment) => total + payment.amount_due, 0),
    totalPaymentsCount: filteredPendingPayments.length
  }), [filteredPendingPayments]);

  // Memoized filtered data for other sections
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    return students.filter(student =>
      (student.name && student.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (student.parent?.name && student.parent.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [students, searchTerm]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    return users.filter(user =>
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [users, searchTerm]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const matchesSearch = !searchTerm ||
        (course.name && course.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesLevel = selectedLevel === 'All' || course.category === selectedLevel;
      const matchesGrade = selectedGrade === 'All' || course.category === selectedGrade;
      const matchesSubject = selectedSubject === 'All' || course.category === selectedSubject;
      return matchesSearch && matchesLevel && matchesGrade && matchesSubject;
    });
  }, [courses, searchTerm, selectedLevel, selectedGrade, selectedSubject]);

  // Optimized callback functions
  const handleRefreshData = useCallback(() => {
    fetchDashboardData(true); // Force refresh
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleSectionFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setSectionForm({
      ...sectionForm,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleCourseFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCourseForm({
      ...courseForm,
      [e.target.name]: e.target.value
    });
  };

  // Enhanced Student Management Handlers
  const handleResetMonthlyAttendance = async (studentId: number, sectionId: number) => {
    if (!studentId || !sectionId) {
      toast.error('Missing student or section ID');
      return;
    }
    
    setMarkingAttendance(prev => new Set(prev).add(studentId));
    
    try {
      const response = await axios.post('/api/admin/monthly-attendance/reset', {
        student_id: studentId,
        class_id: sectionId
      });

      if (response.status === 200) {
        toast.success('✅ Monthly payment marked as paid! Attendance reset to 0/4');
        
        // Refresh students data
        await Promise.all([
          fetchStudentsTableData(),
          fetchDashboardData(),
        ]);
      }
    } catch (error: any) {
      console.error('Error resetting monthly attendance:', error);
      toast.error(error.response?.data?.error || 'Failed to reset monthly attendance');
    } finally {
      setMarkingAttendance(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const handleMarkAttendance = async (studentId: number, sectionId: number, isPresent: boolean, courseType: 'session' | 'monthly' = 'session', addAsAbsent: boolean = false, forceAttendance: boolean = false) => {
    setMarkingAttendance(prev => new Set(prev).add(studentId));
    
    try {
      // Step 0: 🛑 CHECK FOR DUPLICATE ATTENDANCE TODAY
      console.log('🔍 [DUPLICATE_CHECK] Checking if attendance already marked today...', { studentId, sectionId });
      
      try {
        const duplicateCheckResponse = await axios.get(`/api/admin/students/${studentId}/attendance-today/${sectionId}`);
        
        if (duplicateCheckResponse.data && duplicateCheckResponse.data.attendance_id) {
          const existingAttendance = duplicateCheckResponse.data;
          console.log('🚨 [DUPLICATE_FOUND] Attendance already marked today!', existingAttendance);
          
          toast.error('⚠️ Attendance Already Marked Today!', {
            description: `This student's attendance for this session was already recorded today. Cannot mark again.`,
            duration: 5000
          });
          
          setMarkingAttendance(prev => {
            const newSet = new Set(prev);
            newSet.delete(studentId);
            return newSet;
          });
          return; // 🛑 EXIT - Don't allow duplicate marking
        }
        
        console.log('✅ [NO_DUPLICATE] No attendance marked today, proceeding...');
      } catch (duplicateError: any) {
        // If 404 or no attendance found, that's good - we can proceed
        if (duplicateError.response?.status === 404) {
          console.log('✅ [NO_DUPLICATE] No attendance found today (404), proceeding...');
        } else {
          console.error('⚠️ [DUPLICATE_CHECK_ERROR] Error checking duplicate:', duplicateError);
          // Continue anyway - don't block on check error
        }
      }
      
      // Step 1: Check time window first (unless forcing)
      // FIXED: Only check time window if not already forced to avoid double warnings
      if (!forceAttendance) {
        try {
          const windowCheckResponse = await axios.post('/api/admin/attendance/check-window', {
            class_id: sectionId,
            student_id: studentId
          });
          
          const { is_allowed, message, warning_needed, debt_warning, has_unpaid_debt } = windowCheckResponse.data;
          
          // FIXED: Only block if warning is needed AND not allowed
          // If warning_needed=false or is_allowed=true, continue to payment check
          if (warning_needed && !is_allowed) {
            // Show time restriction warning modal
            setPendingAttendanceAction({
              studentId,
              sectionId,
              isPresent,
              courseType,
              action: 'mark',
              addAsAbsent
            });
            setTimeRestrictionData({
              message,
              warning_needed: true,
              can_force: true,
              debt_info: has_unpaid_debt,
              debt_warning: debt_warning
            });
            
            // CRITICAL: Show the time restriction modal
            setShowTimeRestrictionModal(true);
            
            console.log('🚨 [TIME_RESTRICTION] Modal triggered:', {
              message,
              debt_warning,
              has_unpaid_debt,
              studentId,
              sectionId,
              isPresent,
              courseType,
              modalShown: true
            });
            
            // Show toast with force option
            toast.error(`🚨 ${has_unpaid_debt ? 'DEBT WARNING' : 'TIME RESTRICTION'}: ${message}`, {
              duration: 15000,
              action: {
                label: 'Force Mark',
                onClick: () => handleForceAttendanceAction()
              }
            });
            
            setMarkingAttendance(prev => {
              const newSet = new Set(prev);
              newSet.delete(studentId);
              return newSet;
            });
            return; // Exit early ONLY when there's a real restriction
          }
          
          // If we reach here, time window is OK - continue to payment check
          console.log('✅ [TIME_WINDOW] Time window check passed, proceeding to payment check', {
            is_allowed,
            warning_needed,
            studentId,
            sectionId
          });
          
        } catch (windowError: any) {
          console.error('Error checking time window:', windowError);
          // Continue with attendance marking if window check fails
        }
      }
      
      // Step 2: ✅ CHECK PAYMENT - ONLY FOR SESSION-BASED COURSES!
      console.log('🔄 [PAYMENT_MODAL_CHECK] Payment modal evaluation:', {
        courseType,
        isPresent,
        addAsAbsent,
        shouldShowModal: isPresent && !addAsAbsent && courseType === 'session', // ✅ ONLY show for SESSION payments!
        forceAttendance,
        timestamp: new Date().toISOString()
      });
      
      // ✅ SHOW PAYMENT MODAL ONLY FOR SESSION-BASED COURSES when marking present
      // Monthly courses should skip payment modal - they handle payment differently (after 4 sessions)
      if (isPresent && !addAsAbsent && courseType === 'session') {
        // For session-based attendance, show payment notification
        let student = allStudents.find(s => s.id === studentId);
        let section = allSections.find(s => s.id === sectionId);
        let course = courses.find(c => c.id === section?.course_id);
        
        // Fallback: get data from students array if allStudents is empty
        if (!student && students.length > 0) {
          const studentEnrollments = students.flatMap(s => 
            s.enrollment_info?.courses?.map(enrollment => ({
              ...s,
              enrollment: enrollment
            })) || []
          );
          const studentData = studentEnrollments.find(se => se.id === studentId);
          if (studentData) {
            student = studentData;
            section = { id: sectionId, name: studentData.enrollment.section_name, course_id: studentData.enrollment.course_id };
            course = { 
              id: studentData.enrollment.course_id, 
              name_en: studentData.enrollment.course_name, 
              name_ar: studentData.enrollment.course_name,
              price: studentData.enrollment.course_price,
              session_price: studentData.enrollment.course_price
            };
          }
        }
        
        console.log('🔄 [PAYMENT_NOTIFICATION_CHECK] Payment notification data:', {
          student: student?.name,
          section: section?.name,
          course: course?.name_en || course?.name_ar,
          studentId,
          sectionId,
          allStudentsLength: allStudents.length,
          allSectionsLength: allSections.length,
          coursesLength: courses.length,
          studentsLength: students.length,
          fallbackUsed: !allStudents.length && students.length > 0
        });
        
        // Show payment notification for session-based courses - use fallback data if needed
        const courseName = course?.name_en || course?.name_ar || section?.name || 'Session Course';
        const coursePrice = course?.price || course?.session_price || 400; // Default session price
        const studentName = student?.name || `Student ${studentId}`;
        
        console.log('💰 [PAYMENT_TOAST_SESSION] Setting up payment toast for SESSION course:', {
          studentName,
          courseName,
          coursePrice,
          courseType: 'session',
          timestamp: new Date().toISOString()
        });
        
        // Show payment toast notification with action buttons
        toast.info(`� Payment Required: ${studentName} - ${courseName} (${coursePrice} DA)`, {
          duration: 10000,
          action: {
            label: '✅ PAID',
            onClick: async () => {
              console.log('💰 [PAYMENT_TOAST] PAID clicked');
              await markAttendanceDirectly(studentId, sectionId, true, courseType, false, forceAttendance || false, 'paid');
              toast.success(`✅ Marked as PAID and PRESENT for ${studentName}`);
            }
          },
          cancel: {
            label: '❌ NOT PAID',
            onClick: async () => {
              console.log('💰 [PAYMENT_TOAST] NOT PAID clicked');
              await markAttendanceDirectly(studentId, sectionId, true, courseType, false, forceAttendance || false, 'unpaid');
              toast.warning(`⚠️ Marked as PRESENT but NOT PAID for ${studentName}`);
            }
          }
        });
        
        setMarkingAttendance(prev => {
          const newSet = new Set(prev);
          newSet.delete(studentId);
          return newSet;
        });
        return; // EXIT EARLY - Toast handlers will mark attendance (SESSION ONLY)
      }
      
      // Step 3: For MONTHLY courses or ABSENT marking, skip payment modal and mark directly
      console.log('📝 [DIRECT_MARK] Skipping payment modal - marking directly:', {
        courseType,
        reason: courseType === 'monthly' ? 'Monthly payment handled after 4 sessions' : 'Absent marking or other status',
        isPresent,
        addAsAbsent,
        studentId,
        sectionId,
        timestamp: new Date().toISOString()
      });
      
      await markAttendanceDirectly(studentId, sectionId, isPresent, courseType, addAsAbsent, forceAttendance);
      
    } catch (error: any) {
      console.error('Error in handleMarkAttendance:', error);
      toast.error('Failed to mark attendance');
    } finally {
      setMarkingAttendance(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // Separate function to handle the actual API call for marking attendance
  const markAttendanceDirectly = async (studentId: number, sectionId: number, isPresent: boolean, courseType: 'session' | 'monthly' = 'session', addAsAbsent: boolean = false, forceAttendance: boolean = false, paymentStatus: string = 'unpaid') => {
    console.log('💾 [MARK_ATTENDANCE_DIRECTLY] ⚠️ ACTUAL ATTENDANCE MARKING STARTING NOW!', { 
      studentId, 
      sectionId, 
      isPresent, 
      courseType, 
      forceAttendance,
      addAsAbsent,
      paymentStatus,
      timestamp: new Date().toISOString()
    });
    
    const requestData = {
      student_id: studentId,
      class_id: sectionId,
      status: addAsAbsent ? 'absent' : (isPresent ? 'present' : 'absent'),
      course_type: courseType,
      date: new Date().toISOString().split('T')[0],
      add_as_absent: addAsAbsent,
      force: forceAttendance,
      payment_status: paymentStatus
    };
    
    console.log('📝 [MARK_ATTENDANCE_DIRECT]', {
      action: 'MARK_ATTENDANCE_DIRECT',
      timestamp: new Date().toISOString(),
      studentId,
      sectionId,
      isPresent,
      courseType,
      addAsAbsent,
      forceAttendance,
      requestData
    });
    
    try {
      const response = await axios.post('/api/admin/attendance/mark', requestData);

      console.log('✅ [ATTENDANCE_API_SUCCESS]', response.data);

      if (courseType === 'monthly') {
        const { monthly_progress, payment_due, cycle_complete } = response.data;
        
        console.log('📊 [MONTHLY_PROGRESS]', { monthly_progress, payment_due, cycle_complete });
        
        if (cycle_complete) {
          toast.success(`Attendance marked! Monthly cycle complete (4/4). Payment now due.`);
        } else {
          const status = addAsAbsent ? 'added as absent' : (isPresent ? 'marked as present' : 'marked as absent');
          toast.success(`Attendance ${status}! Progress: ${monthly_progress}/4`);
        }
        
        if (payment_due) {
          toast.info(`Monthly payment is now due for this student.`);
        }
      } else {
        const status = addAsAbsent ? 'added as absent' : (isPresent ? 'marked as present' : 'marked as absent');
        toast.success(`Session attendance ${status}`);
        
        console.log('🎯 [SESSION_ATTENDANCE_MARKED]', {
          studentId,
          sectionId,
          status,
          courseType
        });
      }
      
      console.log('🔄 [REFRESHING_STUDENT_DATA]');
      await fetchStudentsTableData();
      
    } catch (error: any) {
      console.error('❌ [ATTENDANCE_MARKING_ERROR]', {
        studentId,
        sectionId,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        requestData
      });
      
      // Handle debt warning
      if (error.response?.status === 400 && error.response?.data?.warning_needed && error.response?.data?.debt_info) {
        const debtData = error.response.data;
        
        // Show debt warning modal
        setPendingAttendanceAction({
          studentId,
          sectionId,
          isPresent,
          courseType,
          action: 'mark',
          addAsAbsent
        });
        setTimeRestrictionData({
          message: debtData.message,
          warning_needed: true,
          can_force: debtData.can_force,
          debt_info: debtData.debt_info,
          retry_data: debtData.retry_data
        });
        
        // CRITICAL: Show the debt warning modal
        setShowTimeRestrictionModal(true);
        
        console.log('💰 [DEBT_WARNING] Modal triggered:', {
          message: debtData.message,
          studentId,
          sectionId,
          isPresent,
          courseType,
          debtInfo: debtData.debt_info,
          modalShown: true
        });
        
        // Show toast with force option
        toast.error(`💰 DEBT WARNING: ${debtData.message}`, {
          duration: 15000,
          action: {
            label: 'Force Mark',
            onClick: () => handleForceAttendanceAction()
          }
        });
        
        setMarkingAttendance(prev => {
          const newSet = new Set(prev);
          newSet.delete(studentId);
          return newSet;
        });
        return; // Exit early due to debt warning
      }
      
      // Handle any remaining errors (this should be rare now due to pre-checks)
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        toast.error(errorData.error || 'Failed to mark attendance');
      } else {
        toast.error('Failed to mark attendance');
      }
      throw error; // Re-throw to be handled by caller
    }
  };

  const handleRemoveSession = async (studentId: number, classId: number) => {
    setMarkingAttendance(prev => new Set(prev).add(studentId));
    try {
      const response = await axios.post('/api/admin/attendance/remove', {
        student_id: studentId,
        class_id: classId
      });

      if (response.data.monthly_progress !== undefined) {
        toast.success(`Session removed! Progress: ${response.data.monthly_progress}/4`);
      } else {
        toast.success('Session removed successfully');
      }
      
      await fetchStudentsTableData();
    } catch (error: any) {
      console.error('Error removing session:', error);
      if (error.response?.status === 404) {
        toast.error('No attendance record found to remove');
      } else {
        toast.error('Failed to remove session');
      }
    } finally {
      setMarkingAttendance(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const handleForceAttendanceAction = async () => {
    console.log('💰 [DEBT_MODAL] handleForceAttendanceAction called');
    if (!pendingAttendanceAction) {
      console.log('🚨 [FORCE_ATTENDANCE] No pending attendance action found');
      return;
    }
    
    const { studentId, sectionId, isPresent, courseType, addAsAbsent } = pendingAttendanceAction;
    console.log('🚨 [FORCE_ATTENDANCE] Force marking attendance:', { studentId, sectionId, isPresent, courseType, addAsAbsent });
    
    try {
      // Check if student has unpaid debts before proceeding
      let student = allStudents.find(s => s.id === studentId);
      console.log('🚨 [FORCE_ATTENDANCE] Looking for student:', studentId, 'in allStudents:', allStudents.length);
      
      if (!student && students.length > 0) {
        const studentEnrollments = students.flatMap(s => 
          s.enrollment_info?.courses?.map(enrollment => ({
            ...s,
            enrollment: enrollment
          })) || []
        );
        student = studentEnrollments.find(se => se.id === studentId);
        console.log('🚨 [FORCE_ATTENDANCE] Found student in enrollments:', student ? student.name : 'not found');
      }
      
      console.log('🚨 [FORCE_ATTENDANCE] Student found:', student ? { id: student.id, name: student.name, total_debt: student.total_debt } : 'null');
      const hasDebts = student?.total_debt > 0;
      console.log('🚨 [FORCE_ATTENDANCE] Has debts check:', hasDebts, 'total_debt value:', student?.total_debt);
      
      if (hasDebts) {
        console.log('🚨 [FORCE_ATTENDANCE] Student has debts, showing debt clearance modal');
        
        // Show debt clearance modal instead of proceeding
        setDebtClearanceData({
          studentId,
          studentName: student?.name || `Student ${studentId}`,
          totalDebt: student?.total_debt || 0,
          pendingAttendanceAction
        });
        setShowDebtClearanceModal(true);
        console.log('🚨 [FORCE_ATTENDANCE] Modal state set:', { showDebtClearanceModal: true, debtClearanceData: { studentId, studentName: student?.name, totalDebt: student?.total_debt } });
        console.log('💰 [DEBT_MODAL] setShowDebtClearanceModal(true) called');
        return;
      }
      
      // No debts, proceed with normal flow
      await proceedWithAttendanceMarking(pendingAttendanceAction);
      
    } catch (error) {
      console.error('🚨 [FORCE_ATTENDANCE] Error in force attendance action:', error);
      toast.error('Failed to process attendance marking');
    }
  };

  const proceedWithAttendanceMarking = async (attendanceAction: any) => {
    const { studentId, sectionId, isPresent, courseType, addAsAbsent } = attendanceAction;
    
    try {
      // Clear time restriction modal but keep pending action for payment flow
      console.log('🚨 [ATTENDANCE_MARKING] Clearing time restriction modal');
      setTimeRestrictionData(null);
      setShowTimeRestrictionModal(false);
      // Don't clear pending action yet - we need it for payment flow
      
      console.log('🚨 [ATTENDANCE_MARKING] Proceeding with attendance after force', {
        studentId,
        sectionId,
        isPresent,
        courseType,
        addAsAbsent
      });
      
      // Show confirmation that we're proceeding
      toast.info('⏳ Processing forced attendance...', { duration: 2000 });
      
      // Small delay to ensure modal state is cleared before showing payment prompt
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // ✅ SHOW PAYMENT TOAST FOR PRESENT ATTENDANCE (session OR monthly)
      if (isPresent && !addAsAbsent) {
        console.log('🚨 [ATTENDANCE_MARKING] Need payment TOAST for attendance (courseType: ' + courseType + ')');
        
        // Get student and course data
        let student = allStudents.find(s => s.id === studentId);
        let section = allSections.find(s => s.id === sectionId);
        let course = courses.find(c => c.id === section?.course_id);
        
        // Fallback: get data from students array if allStudents is empty
        if (!student && students.length > 0) {
          const studentEnrollments = students.flatMap(s => 
            s.enrollment_info?.courses?.map(enrollment => ({
              ...s,
              enrollment: enrollment
            })) || []
          );
          const studentData = studentEnrollments.find(se => se.id === studentId);
          if (studentData) {
            student = studentData;
            section = { id: sectionId, name: studentData.enrollment.section_name, course_id: studentData.enrollment.course_id };
            course = { 
              id: studentData.enrollment.course_id, 
              name_en: studentData.enrollment.course_name, 
              name_ar: studentData.enrollment.course_name,
              price: studentData.enrollment.course_price,
              session_price: studentData.enrollment.course_price
            };
          }
        }
        
        // Get payment info
        const courseName = course?.name_en || course?.name_ar || section?.name || 'Session Course';
        const coursePrice = course?.price || course?.session_price || 400; // Default price
        const studentName = student?.name || `Student ${studentId}`;
        
        console.log('🚨 [ATTENDANCE_MARKING] Showing payment TOAST with:', {
          studentName,
          courseName,
          coursePrice,
          studentId,
          sectionId
        });
        
        // Show payment toast notification with action buttons
        toast.info(`💰 Payment Required: ${studentName} - ${courseName} (${coursePrice} DA)`, {
          duration: 10000,
          action: {
            label: '✅ PAID',
            onClick: async () => {
              console.log('💰 [PAYMENT_TOAST] PAID clicked');
              await markAttendanceDirectly(studentId, sectionId, true, courseType, false, true, 'paid');
              toast.success(`✅ Marked as PAID and PRESENT for ${studentName}`);
            }
          },
          cancel: {
            label: '❌ NOT PAID',
            onClick: async () => {
              console.log('💰 [PAYMENT_TOAST] NOT PAID clicked');
              await markAttendanceDirectly(studentId, sectionId, true, courseType, false, true, 'unpaid');
              toast.warning(`⚠️ Marked as PRESENT but NOT PAID for ${studentName}`);
            }
          }
        });
      } else {
        // For non-session or absent marking, go directly to attendance
        console.log('🚨 [ATTENDANCE_MARKING] Direct attendance marking (no payment needed)');
        await markAttendanceDirectly(studentId, sectionId, isPresent, courseType, addAsAbsent, true);
      }
      
      // Clear pending action after processing
      setPendingAttendanceAction(null);
      
    } catch (error) {
      console.error('❌ [ATTENDANCE_MARKING] Error:', error);
      toast.error('Failed to mark attendance');
      
      // Clean up state on error
      setPendingAttendanceAction(null);
      setTimeRestrictionData(null);
      setShowTimeRestrictionModal(false);
    }
  };

  // PAYMENT MODAL HANDLERS - REPLACED WITH TOAST NOTIFICATIONS
  /* const handleConfirmSessionPayment = async () => {
    // ... handler code commented out - using toast notifications now
  };

  const handleMarkAttendanceWithoutPayment = async () => {
    // ... handler code commented out - using toast notifications now
  };

  const handleCancelSessionPayment = () => {
    // ... handler code commented out - using toast notifications now
  }; */

  const handleMarkAttendancePayment = async (attendanceId: number, paymentStatus: 'paid' | 'unpaid') => {
    const studentId = 0; // We'll get this from the attendance record
    setProcessingPayments(prev => new Set(prev).add(studentId));
    
    console.log('💰 [MARK_ATTENDANCE_PAYMENT]', {
      action: 'MARK_ATTENDANCE_PAYMENT',
      timestamp: new Date().toISOString(),
      attendanceId,
      paymentStatus,
      requestData: {
        attendance_id: attendanceId,
        payment_status: paymentStatus
      }
    });
    
    try {
      const response = await axios.post('/api/admin/attendance/mark-payment', {
        attendance_id: attendanceId,
        payment_status: paymentStatus
      });

      console.log('✅ [PAYMENT_STATUS_UPDATED]', {
        attendanceId,
        paymentStatus,
        response: response.data
      });

      if (paymentStatus === 'paid') {
        toast.success('Payment marked as paid successfully');
        console.log('✅ [PAYMENT_MARKED_PAID]', { attendanceId });
      } else {
        toast.success('Payment marked as unpaid - debt added');
        console.log('📊 [DEBT_ADDED]', { attendanceId, status: paymentStatus });
      }
      
      console.log('🔄 [REFRESHING_DATA_AFTER_PAYMENT]');
      await fetchStudentsTableData();
    } catch (error: any) {
      console.error('❌ [PAYMENT_UPDATE_ERROR]', {
        attendanceId,
        paymentStatus,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      toast.error(error.response?.data?.error || 'Failed to update payment status');
    } finally {
      setProcessingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // Attendance and payment action functions removed - Admin dashboard now displays stats only

  const handleRemoveSessionFixed = async (studentId: number, classId: number) => {
    setMarkingAttendance(prev => new Set(prev).add(studentId));
    try {
      const response = await axios.post('/api/admin/attendance/remove', {
        student_id: studentId,
        class_id: classId,
        date: new Date().toISOString().split('T')[0]
      });

      toast.success(response.data.message || 'Session removed successfully');
      await fetchStudentsTableData();
    } catch (error: any) {
      console.error('Error removing session:', error);
      toast.error(error.response?.data?.error || 'Failed to remove session');
    } finally {
      setMarkingAttendance(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const handleQuickPayment = async (studentId: number, sectionId: number, amount: number, paymentType: 'session' | 'monthly' = 'session') => {
    setProcessingPayments(prev => new Set(prev).add(studentId));
    try {
      const response = await axios.post('/api/admin/payments/quick', {
        student_id: studentId,
        section_id: sectionId,
        amount: amount,
        payment_type: paymentType,
        payment_date: new Date().toISOString().split('T')[0]
      });

      if (paymentType === 'monthly') {
        const { cycle_reset, new_progress } = response.data;
        if (cycle_reset) {
          toast.success(`Monthly payment processed! Attendance progress reset to ${new_progress}/4`);
        } else {
          toast.success('Monthly payment recorded successfully');
        }
      } else {
        toast.success('Session payment recorded successfully');
      }
      
      await fetchStudentsTableData();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    } finally {
      setProcessingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const handleClearPayment = async (studentId: number, sectionId: number) => {
    if (!confirm('Are you sure you want to clear this payment? This action cannot be undone.')) {
      return;
    }

    setProcessingPayments(prev => new Set(prev).add(studentId));
    try {
      await axios.delete(`/api/admin/payments/clear`, {
        data: {
          student_id: studentId,
          section_id: sectionId
        }
      });
      toast.success('Payment cleared successfully');
      await fetchStudentsTableData();
    } catch (error) {
      console.error('Error clearing payment:', error);
      toast.error('Failed to clear payment');
    } finally {
      setProcessingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  // Bulk clearing functions removed - Admin dashboard is now read-only for attendance/payments

  const fetchStudentsTableData = async (showLoadingToast = false) => {
    setStudentsLoading(true);
    
    if (showLoadingToast) {
      toast.loading('Loading students data...', { id: 'students-loading' });
    }
    
    try {
      const response = await axios.get('/api/admin/students/detailed', {
        params: { 
          section_id: selectedSection !== 'all' ? selectedSection : undefined,
          include_attendance: true,
          include_payments: true 
        }
      });
      setStudentsTableData(response.data.students || []);
      
      if (showLoadingToast) {
        toast.success(`Loaded ${response.data.students?.length || 0} students`, { id: 'students-loading' });
      }
    } catch (error) {
      console.error('Error fetching detailed students data:', error);
      toast.error('Failed to load students data', { id: 'students-loading' });
      setStudentsTableData([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const fetchCurrentSessions = async () => {
    try {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      const response = await axios.get('/api/admin/sections/current', {
        params: { day: currentDay, time: currentTime }
      });
      setCurrentSessions(response.data.sections || []);
    } catch (error) {
      console.error('Error fetching current sessions:', error);
      setCurrentSessions([]);
    }
  };

  const isCurrentSession = (section: CourseSection) => {
    return currentSessions.some(cs => cs.id === section.id);
  };

  // Check if a session should be highlighted with gold (starting soon, ongoing, or ending soon)
  const shouldHighlightSession = (section: any) => {
    const { currentDay, currentTimeMinutes } = getAlgerianDayAndTime();
    
    // Check if it's the correct day first
    if (!section.day_of_week) {
      return false;
    }
    
    // Compare day names directly (case insensitive)
    if (section.day_of_week.toLowerCase() !== currentDay.toLowerCase()) {
      return false;
    }
    
    if (!section.start_time || !section.end_time) {
      return false;
    }
    
    try {
      // Parse start and end times
      const [startHour, startMin] = section.start_time.split(':').map(Number);
      const [endHour, endMin] = section.end_time.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      // Highlight if:
      // 1. Starting within 30 minutes (30 minutes before start)
      // 2. Currently ongoing (between start and end)
      // 3. Ending within 30 minutes (30 minutes after end)
      const highlightStart = startTime - 30;
      const highlightEnd = endTime + 30;
      
      return currentTimeMinutes >= highlightStart && currentTimeMinutes <= highlightEnd;
    } catch (error) {
      console.error('Error parsing times for session highlighting:', section, error);
      return false;
    }
  };

  // Enhanced helper functions for active session detection with Algerian timezone
  const getAlgerianTime = (): Date => {
    // Algeria is UTC+1 (CET)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const algerianTime = new Date(utc + (1 * 3600000)); // UTC+1
    return algerianTime;
  };

  const getAlgerianDayAndTime = () => {
    const algerianTime = getAlgerianTime();
    const currentDay = algerianTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Africa/Algiers' });
    const currentTimeMinutes = algerianTime.getHours() * 60 + algerianTime.getMinutes();
    
    return { currentDay, currentTimeMinutes, algerianTime };
  };

  const isCurrentlyLive = (section: any): boolean => {
    const { currentDay, currentTimeMinutes } = getAlgerianDayAndTime();
    
    if (!section.day_of_week || section.day_of_week.toLowerCase() !== currentDay.toLowerCase()) {
      return false;
    }
    
    if (!section.start_time || !section.end_time) {
      return false;
    }
    
    try {
      const [startHour, startMin] = section.start_time.split(':').map(Number);
      const [endHour, endMin] = section.end_time.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      const isLive = currentTimeMinutes >= startTime && currentTimeMinutes <= endTime;
      
      // Debug logging
      if (section.course_name) {
        console.log(`🔴 Live Check - ${section.course_name} (${section.section_name}):`, {
          currentDay,
          sectionDay: section.day_of_week,
          dayMatch: section.day_of_week.toLowerCase() === currentDay.toLowerCase(),
          currentTimeMinutes,
          startTime,
          endTime,
          isLive
        });
      }
      
      return isLive;
    } catch (error) {
      console.error('Error parsing time for section:', section, error);
      return false;
    }
  };

  const isStartingSoon = (section: any): boolean => {
    const { currentDay, currentTimeMinutes } = getAlgerianDayAndTime();
    
    if (!section.day_of_week || section.day_of_week.toLowerCase() !== currentDay.toLowerCase()) {
      return false;
    }
    
    if (!section.start_time) {
      return false;
    }
    
    try {
      const [startHour, startMin] = section.start_time.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      
      // Starting within next 30 minutes
      return currentTimeMinutes <= startTime && (startTime - currentTimeMinutes) <= 30;
    } catch (error) {
      console.error('Error parsing start time for section:', section, error);
      return false;
    }
  };

  const isEndingSoon = (section: any): boolean => {
    const { currentDay, currentTimeMinutes } = getAlgerianDayAndTime();
    
    if (!section.day_of_week || section.day_of_week.toLowerCase() !== currentDay.toLowerCase()) {
      return false;
    }
    
    if (!section.end_time) {
      return false;
    }
    
    try {
      const [endHour, endMin] = section.end_time.split(':').map(Number);
      const endTime = endHour * 60 + endMin;
      
      // Ending within next 30 minutes
      return currentTimeMinutes <= endTime && (endTime - currentTimeMinutes) <= 30;
    } catch (error) {
      console.error('Error parsing end time for section:', section, error);
      return false;
    }
  };

  const isInActiveWindow = (section: any): boolean => {
    return isCurrentlyLive(section) || isStartingSoon(section) || isEndingSoon(section);
  };

  // Function to update active sessions (smart caching)
  const updateActiveSections = useCallback(() => {
    const now = Date.now();
    
    // Only update if it's been more than 3 minutes since last update
    if (now - lastActiveSessionsUpdate < 3 * 60 * 1000) {
      return;
    }
    
    const activeSessionsList = allSections.filter(section => shouldHighlightSession(section));
    setActiveSections(activeSessionsList);
    setLastActiveSessionsUpdate(now);
    
    console.log(`Updated active sessions: ${activeSessionsList.length} active out of ${allSections.length} total`);
  }, [allSections, lastActiveSessionsUpdate]);

  // Auto-update active sessions every 3 minutes
  useEffect(() => {
    if (allSections.length === 0) return;
    
    // Initial update
    updateActiveSections();
    
    // Set up interval for every 3 minutes
    const interval = setInterval(() => {
      updateActiveSections();
    }, 3 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [updateActiveSections]);

  // Update active sections when allSections changes
  useEffect(() => {
    if (allSections.length > 0) {
      updateActiveSections();
    }
  }, [allSections, updateActiveSections]);

  // Check if attendance can be marked (30 minutes before or during or after class)
  const canMarkAttendance = (section: any) => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Convert section day to match JavaScript's getDay() format
    const sectionDay = section.day_of_week; // Assuming 0=Monday in your system
    const adjustedSectionDay = (sectionDay + 1) % 7; // Convert to JS format where 0=Sunday
    
    // Only check time if it's the correct day
    if (currentDay !== adjustedSectionDay) {
      return false;
    }
    
    // Parse start and end times
    const startTime = section.start_time ? 
      parseInt(section.start_time.split(':')[0]) * 60 + parseInt(section.start_time.split(':')[1]) : 0;
    const endTime = section.end_time ? 
      parseInt(section.end_time.split(':')[0]) * 60 + parseInt(section.end_time.split(':')[1]) : 0;
    
    // Allow 30 minutes before and after
    const allowedStart = startTime - 30;
    const allowedEnd = endTime + 30;
    
    return currentTime >= allowedStart && currentTime <= allowedEnd;
  };

  // Bulk attendance and payment marking functions removed - Admin dashboard is read-only

  const handleBulkSendNotification = async () => {
    if (selectedStudents.size === 0) return;

    try {
      const selectedStudentData = studentsTableData.filter(s => selectedStudents.has(s.id));
      
      await axios.post('/api/admin/notifications/bulk', {
        student_ids: Array.from(selectedStudents),
        title: 'Important Notice',
        message: 'This is a bulk notification from the administration.',
        type: 'general'
      });
      
      toast.success(`Notification sent to ${selectedStudents.size} students`);
      setSelectedStudents(new Set());
    } catch (error) {
      console.error('Error sending bulk notification:', error);
      toast.error('Failed to send notifications');
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
      name: course.name,
      description: course.description,
      price: course.price.toString(),
      max_students: course.max_students.toString(),
      image: null
    });
    setShowCourseModal(true);
  };

  const handleToggleCourseStatus = async (courseId: number) => {
    try {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      await axios.put(`/api/admin/courses/${courseId}`, {
        ...course,
        is_active: !course.is_active
      });

      toast.success(`Course ${!course.is_active ? 'activated' : 'deactivated'} successfully`);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update course status');
    }
  };

  // Student management handlers - DISABLED in read-only mode
  const handleEditStudent = (student: any) => {
    toast.info('Student editing is disabled - Dashboard is in read-only mode for student management');
    return;
  };

  const handleToggleStudentMobile = async (studentId: number) => {
    try {
      const response = await axios.put(`/api/admin/students/${studentId}/toggle-mobile`);
      if (response.data.success) {
        await fetchDashboardData();
        toast.success('Student mobile access updated successfully');
      }
    } catch (error) {
      console.error('Error toggling student mobile access:', error);
      toast.error('Failed to update student mobile access');
    }
  };

  // handleDeleteStudent function removed - actions disabled in read-only mode
  // Student data can be viewed but not deleted
  const handleDeleteStudent = async (studentId: number) => {
    toast.info('Student deletion is disabled - Dashboard is in read-only mode for student management');
    return;
  };

  const handleViewStudentDetails = (student: Student) => {
    setSelectedStudentForModal(student);
    setShowStudentDetailModal(true);
  };

  // Student detail modal handlers
  const handleAssignParent = (studentId: number) => {
    // TODO: Implement parent assignment functionality
    toast.info('Parent assignment feature coming soon');
  };

  const handleEnrollStudent = async (studentId: number) => {
    try {
      // First fetch available courses
      const coursesResponse = await axios.get('/api/admin/courses/available-for-enrollment');
      const availableCourses = coursesResponse.data.courses;

      if (availableCourses.length === 0) {
        toast.error('No available courses for enrollment');
        return;
      }

      // Create a simple enrollment interface using browser prompt for now
      // In a production app, you'd want a proper modal
      let courseOptions = 'Available Courses:\n';
      const courseMap: { [key: string]: any } = {};
      
      availableCourses.forEach((course: any, idx: number) => {
        course.classes.forEach((classObj: any, classIdx: number) => {
          const key = `${idx}-${classIdx}`;
          courseMap[key] = { courseId: course.id, classId: classObj.id, course, classObj };
          courseOptions += `${key}: ${course.name} - ${classObj.name} (${classObj.day_of_week} ${classObj.start_time}-${classObj.end_time})\n`;
        });
      });

      const selection = prompt(courseOptions + '\nEnter the number of the class to enroll in:');
      if (!selection || !courseMap[selection]) {
        return;
      }

      const { classId, course, classObj } = courseMap[selection];

      const response = await axios.post(`/api/admin/students/${studentId}/enroll`, {
        class_id: classId
      });

      if (response.data.success) {
        toast.success(`Student enrolled in ${course.name} - ${classObj.name}!`);
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to enroll student');
    }
  };

  const handleUnenrollStudent = async (studentId: number, enrollmentId: number) => {
    if (!confirm('Are you sure you want to unenroll this student from the course?')) {
      return;
    }

    try {
      const response = await axios.delete(`/api/admin/students/${studentId}/unenroll/${enrollmentId}`);
      
      if (response.data.success) {
        toast.success('Student unenrolled successfully!');
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unenroll student');
    }
  };

  const handleViewCourseDetails = async (enrollmentId: number) => {
    try {
      const response = await axios.get(`/api/admin/enrollments/${enrollmentId}/course-details`);
      const courseDetails = response.data;
      
      let detailsMessage = `Course Details:\n\n`;
      detailsMessage += `Course: ${courseDetails.course_name}\n`;
      detailsMessage += `Class: ${courseDetails.class_name}\n`;
      detailsMessage += `Schedule: ${courseDetails.day_of_week} ${courseDetails.start_time}-${courseDetails.end_time}\n`;
      if (courseDetails.description) detailsMessage += `Description: ${courseDetails.description}\n`;
      detailsMessage += `Price per Session: ${courseDetails.price_per_session} DA\n`;
      detailsMessage += `Enrollment Date: ${courseDetails.enrollment_date}\n`;
      detailsMessage += `Status: ${courseDetails.status}\n`;

      alert(detailsMessage);
      toast.success('Course details loaded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch course details');
    }
  };

  const handleChangeSectionStudent = async (studentId: number, enrollmentId: number) => {
    try {
      // First fetch available courses
      const coursesResponse = await axios.get('/api/admin/courses/available-for-enrollment');
      const availableCourses = coursesResponse.data.courses;

      if (availableCourses.length === 0) {
        toast.error('No available courses for section change');
        return;
      }

      // Create section change interface using browser prompt
      let sectionOptions = 'Available Sections:\n';
      const sectionMap: { [key: string]: any } = {};
      
      availableCourses.forEach((course: any, idx: number) => {
        course.classes.forEach((classObj: any, classIdx: number) => {
          const key = `${idx}-${classIdx}`;
          sectionMap[key] = { courseId: course.id, classId: classObj.id, course, classObj };
          sectionOptions += `${key}: ${course.name} - ${classObj.name} (${classObj.day_of_week} ${classObj.start_time}-${classObj.end_time})\n`;
        });
      });

      const selection = prompt(sectionOptions + '\nEnter the number of the new section:');
      if (!selection || !sectionMap[selection]) {
        return;
      }

      const { classId, course, classObj } = sectionMap[selection];

      const response = await axios.put(`/api/admin/students/${studentId}/change-section`, {
        enrollment_id: enrollmentId,
        new_class_id: classId
      });

      if (response.data.success) {
        toast.success(`Student moved to ${course.name} - ${classObj.name}!`);
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change section');
    }
  };

  const handleQuickEnrollInPopularCourse = async (studentId: number) => {
    try {
      // Get available courses and auto-enroll in the first available one
      const coursesResponse = await axios.get('/api/admin/courses/available-for-enrollment');
      const availableCourses = coursesResponse.data.courses;

      if (availableCourses.length === 0) {
        toast.error('No available courses for enrollment');
        return;
      }

      // Find the first course with available space
      let selectedClass = null;
      for (const course of availableCourses) {
        const availableClass = course.classes.find((cls: any) => cls.has_space);
        if (availableClass) {
          selectedClass = { course, classObj: availableClass };
          break;
        }
      }

      if (!selectedClass) {
        toast.error('No courses with available space found');
        return;
      }

      const response = await axios.post(`/api/admin/students/${studentId}/enroll`, {
        class_id: selectedClass.classObj.id
      });

      if (response.data.success) {
        toast.success(`Student enrolled in ${selectedClass.course.name} - ${selectedClass.classObj.name}!`);
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to quick enroll student');
    }
  };

  const handleViewPaymentHistory = async (studentId: number) => {
    try {
      const response = await axios.get(`/api/admin/students/${studentId}/payment-history`);
      const paymentData = response.data;
      
      // Create a detailed payment history message
      let historyMessage = `Payment History for ${paymentData.student_name}\n\n`;
      historyMessage += `Summary:\n`;
      historyMessage += `Total Paid: ${paymentData.summary.total_paid} DA\n`;
      historyMessage += `Total Debt: ${paymentData.summary.total_debt} DA\n`;
      historyMessage += `Balance: ${paymentData.summary.balance} DA\n`;
      historyMessage += `Payment Count: ${paymentData.summary.payment_count}\n\n`;
      
      if (paymentData.payment_history.length > 0) {
        historyMessage += `Recent Payments:\n`;
        paymentData.payment_history.slice(0, 5).forEach((payment: any) => {
          historyMessage += `• ${payment.amount} DA - ${payment.status} (${payment.payment_date || 'No date'})\n`;
          if (payment.description) historyMessage += `  ${payment.description}\n`;
        });
      } else {
        historyMessage += `No payment history found.\n`;
      }

      // For now, show in alert. In production, you'd want a proper modal
      alert(historyMessage);
      
      toast.success('Payment history loaded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch payment history');
    }
  };

  const handleViewStudentAttendance = async (studentId: number) => {
    try {
      const response = await axios.get(`/api/admin/students/${studentId}/attendance-history`);
      const attendanceData = response.data;
      
      // Create a detailed attendance history message
      let historyMessage = `Attendance Report for ${attendanceData.student_name}\n\n`;
      historyMessage += `Statistics:\n`;
      historyMessage += `Attendance Rate: ${attendanceData.stats.attendance_rate}%\n`;
      historyMessage += `Present: ${attendanceData.stats.present_count} sessions\n`;
      historyMessage += `Absent: ${attendanceData.stats.absent_count} sessions\n`;
      historyMessage += `Late: ${attendanceData.stats.late_count} sessions\n`;
      historyMessage += `Total Sessions: ${attendanceData.stats.total_records}\n\n`;
      
      if (attendanceData.attendance_history.length > 0) {
        historyMessage += `Recent Attendance Records:\n`;
        attendanceData.attendance_history.slice(0, 10).forEach((record: any) => {
          const status = record.status.charAt(0).toUpperCase() + record.status.slice(1);
          historyMessage += `• ${record.class_name} - ${status} (${new Date(record.attendance_date).toLocaleDateString()})\n`;
        });
      } else {
        historyMessage += `No attendance records found.\n`;
      }

      // For now, show in alert. In production, you'd want a proper modal
      alert(historyMessage);
      
      toast.success('Attendance history loaded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch attendance history');
    }
  };

  const handleGenerateMobileCredentials = async (studentId: number, userType: 'student' | 'parent' = 'student') => {
    try {
      const endpoint = userType === 'student' 
        ? `/api/admin/students/${studentId}/generate-credentials`
        : `/api/admin/parents/${studentId}/generate-credentials`;
        
      const response = await axios.post(endpoint);
      
      if (response.data.success) {
        const credentials = response.data.student_credentials || response.data.credentials;
        const parentCredentials = response.data.parent_credentials;
        
        let message = `${userType === 'student' ? 'Student' : 'Parent'} credentials generated!\n`;
        message += `Username: ${credentials.username}\n`;
        message += `Password: ${credentials.password}\n`;
        message += `Phone: ${credentials.phone}`;
        
        if (parentCredentials && userType === 'student') {
          message += `\n\nParent credentials also generated:\n`;
          message += `Username: ${parentCredentials.username}\n`;
          message += `Password: ${parentCredentials.password}\n`;
          message += `Phone: ${parentCredentials.phone}`;
        }
        
        // Show credentials in modal instead of toast for better visibility
        setCredentialsData({
          type: userType,
          student_credentials: credentials,
          parent_credentials: parentCredentials,
          message: message
        });
        setShowCredentialsModal(true);
        
        // Refresh data to show updated info
        await fetchDashboardData();
        toast.success('Mobile credentials generated successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate mobile credentials');
    }
  };

  const handleResetStudentPassword = async (studentId: number) => {
    try {
      const response = await axios.post(`/api/admin/students/${studentId}/reset-password`);
      if (response.data.new_password) {
        toast.success(`Student t('adminMobilePassword') reset successful! New password: ${response.data.new_password}`);
        // Refresh data to show updated info
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reset student password');
    }
  };

  const handleResetParentPassword = async (parentId: number) => {
    try {
      const response = await axios.post(`/api/admin/parents/${parentId}/reset-password`);
      if (response.data.new_password) {
        toast.success(`Parent password reset successful! New password: ${response.data.new_password}`);
        // Refresh data to show updated info
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reset parent password');
    }
  };

  const handleResetUserPassword = async (userId: number) => {
    try {
      const response = await axios.post(`/api/admin/users/${userId}/reset-password`);
      if (response.data.new_password) {
        toast.success(`User password reset successful! New password: ${response.data.new_password}`);
        // Refresh data to show updated info
        await fetchDashboardData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reset user password');
    }
  };

  const handleViewCredentials = async (type: 'student' | 'parent' | 'user', id: number) => {
    try {
      let endpoint = '';
      if (type === 'student') {
        endpoint = `/api/admin/students/${id}/credentials`;
      } else if (type === 'parent') {
        endpoint = `/api/admin/parents/${id}/credentials`;
      } else if (type === 'user') {
        endpoint = `/api/admin/users/${id}/credentials`;
      }

      const response = await axios.get(endpoint);
      setCredentialsData({ ...response.data, type, id });
      setShowCredentialsModal(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch credentials');
    }
  };

  const handleRegeneratePassword = async (type: 'student' | 'parent', id: number) => {
    try {
      const endpoint = type === 'student'
        ? `/api/admin/students/${id}/regenerate-password`
        : `/api/admin/parents/${id}/regenerate-password`;

      const response = await axios.post(endpoint);

      if (response.data.success) {
        toast.success(`${type === 'student' ? 'Student' : 'Parent'} password regenerated successfully`);
        // Update the credentials modal with new password
        setCredentialsData(prev => ({
          ...prev,
          mobile_password: response.data.credentials.password
        }));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to regenerate password');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users');
      if (response.data) {
        // Handle both direct array response and nested response structure
        const usersData = response.data.users || response.data;
        setUsers(Array.isArray(usersData) ? usersData : []);
        toast.success('Users data refreshed successfully');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to refresh users data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (studentData: any) => {
    try {
      const response = await axios.post('/api/admin/students', studentData);
      if (response.data.success) {
        await fetchDashboardData();
        setShowStudentModal(false);
        toast.success('Student created successfully');
      }
    } catch (error) {
      console.error('Error creating student:', error);
      toast.error('Failed to create student');
    }
  };

  // handleUpdateStudent function removed - actions disabled in read-only mode
  // Student data can be viewed but not modified
  const handleUpdateStudent_DISABLED = async (studentId: number, studentData: any) => {
    toast.info('Student updates are disabled - Dashboard is in read-only mode for student management');
    return;
  };

  // User management handlers
  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleToggleUserRole = async (userId: number) => {
    try {
      const response = await axios.put(`/api/admin/users/${userId}/toggle-role`);
      if (response.data.success) {
        await fetchDashboardData();
        toast.success('User role updated successfully');
      }
    } catch (error) {
      console.error('Error toggling user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await axios.patch(`/api/admin/users/${userId}/toggle-status`);
      if (response.data.success) {
        await fetchDashboardData();
        toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Failed to update user status');
    }
  };





  const handleDeleteUser = async (userId: number) => {
    const confirmed = confirm('Are you sure you want to delete this user? This will permanently delete the user account and ALL associated data including parents, students, registrations, attendance records, and mobile credentials. This action cannot be undone.');
    if (!confirmed) return;

    try {
      setLoading(true);
      toast.loading('Deleting user and associated records...', { id: 'delete-user' });

      const response = await axios.delete(`/api/admin/users/${userId}?cascade=true`);
      if (response.data.success) {
        await fetchDashboardData();
        toast.success('User and all associated records deleted successfully', { id: 'delete-user' });
      } else {
        toast.error('Failed to delete user', { id: 'delete-user' });
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      console.error('Error response:', error.response);

      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.error || 'Invalid request. Please check user data.';

        if (errorMessage.includes('associated') || errorMessage.includes('parent') || errorMessage.includes('student')) {
          toast.error('Cannot delete user with associated records. Try force delete or deactivate instead.', { id: 'delete-user' });
        } else {
          toast.error(errorMessage, { id: 'delete-user' });
        }
      } else if (error.response?.status === 404) {
        toast.error('User not found.', { id: 'delete-user' });
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to delete this user.', { id: 'delete-user' });
      } else {
        toast.error('Failed to delete user and associated records', { id: 'delete-user' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData: any) => {
    try {
      const response = await axios.post('/api/admin/users', userData);
      if (response.data.success) {
        await fetchDashboardData();
        setShowUserModal(false);
        toast.success('User created successfully');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  const handleUpdateUser = async (userId: number, userData: any) => {
    try {
      const response = await axios.put(`/api/admin/users/${userId}`, userData);
      if (response.data.success) {
        await fetchDashboardData();
        setShowUserModal(false);
        setEditingUser(null);
        toast.success('User updated successfully');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-luxury flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'people-management', name: 'People Management', icon: Users },
    { id: 'courses', name: t('adminCoursesTab'), icon: BookOpen },
    { id: 'kindergarten', name: '🧸 Kindergarten', icon: GraduationCap },
    { id: 'schedule-control', name: t('adminScheduleControlTab'), icon: Calendar },
    { id: 'attendance', name: 'Attendance System', icon: UserCheck },
    { id: 'content-management', name: 'Content & Support', icon: FileText },
  ];

  // Contact message handlers
  const handleViewContactMessage = (message: ContactMessage) => {
    console.log('View message clicked:', message);
    setSelectedMessage(message);
    setReplyText('');
    setShowMessageModal(true);
  };

  const handleReplyToContactMessage = (message: ContactMessage) => {
    console.log('Reply message clicked:', message);
    setSelectedMessage(message);
    setReplyText('');
    setShowMessageModal(true);
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) {
      toast.error('Please enter a reply message');
      return;
    }

    setSendingReply(true);
    try {
      await axios.post(`/api/contact/messages/${selectedMessage.id}/respond`, {
        response: replyText
      });
      
      toast.success('Reply sent successfully!');
      setShowMessageModal(false);
      setReplyText('');
      setSelectedMessage(null);
      fetchDashboardData(); // Refresh the messages
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkContactMessageAsRead = async (messageId: number) => {
    try {
      await axios.put(`/api/contact/messages/${messageId}`, { status: 'responded' });
      toast.success('Message marked as read');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to mark message as read');
    }
  };

  // Attendance-related functions
  const fetchStudentAttendance = async (studentId: number) => {
    try {
      const response = await axios.get(`/api/attendance/student/${studentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching student attendance:', error);
      toast.error('Failed to fetch attendance data');
      return null;
    }
  };

  const handleViewAttendanceHistory = async (studentId: number) => {
    try {
      const attendanceData = await fetchStudentAttendance(studentId);
      if (attendanceData) {
        // Store attendance data for display
        setSelectedStudentAttendance(attendanceData);
        setShowAttendanceModal(true);
      }
    } catch (error) {
      toast.error('Failed to load attendance history');
    }
  };

  const handleScanBarcode = async () => {
    if (!scannedBarcode.trim()) {
      toast.error('Please enter a barcode');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/attendance/scan-barcode', {
        barcode: scannedBarcode.trim()
      });

      setAttendanceData(response.data);
      setScannedBarcode('');

      // Check if payment is required
      if (response.data.payment_required) {
        setPaymentAmount(response.data.required_amount);
        setShowPaymentDialog(true);
      } else {
        toast.success('Attendance recorded successfully');
        fetchDashboardData();
      }
    } catch (error: any) {
      console.error('Error scanning barcode:', error);
      toast.error(error.response?.data?.message || 'Failed to scan barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!attendanceData) return;

    try {
      setLoading(true);
      const response = await axios.post('/api/attendance/confirm-payment', {
        attendance_id: attendanceData.attendance_id,
        amount: paymentAmount,
        payment_method: paymentMethod
      });

      toast.success('Payment confirmed and attendance recorded');
      setShowPaymentDialog(false);
      setAttendanceData(null);
      setPaymentAmount(0);
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      toast.error(error.response?.data?.message || 'Failed to confirm payment');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchIndebtedUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/attendance/indebted-users');
      setIndebtedUsers(response.data);
      setShowIndebtedUsers(true);
    } catch (error: any) {
      console.error('Error fetching indebted users:', error);
      toast.error('Failed to fetch indebted users');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDebt = async (userId: number, amount: number) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/attendance/clear-debt', {
        user_id: userId,
        amount: amount
      });

      toast.success('Debt cleared successfully');
      setShowClearDebtDialog(false);
      setSelectedIndebtedUser(null);
      setClearDebtAmount(0);
      handleFetchIndebtedUsers(); // Refresh the list
    } catch (error: any) {
      console.error('Error clearing debt:', error);
      toast.error(error.response?.data?.message || 'Failed to clear debt');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceSearch = (searchTerm: string) => {
    setAttendanceSearchTerm(searchTerm);
  };

  const handleAttendanceFilter = (filter: string) => {
    setAttendanceFilter(filter);
  };

  return (
    <div className="min-h-screen bg-gradient-luxury">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-gold bg-clip-text text-transparent">
                {t('adminDashboardTitle')}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {t('adminDashboardSubtitle')}
              </p>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="text-right">
                <p className="text-xs md:text-sm text-muted-foreground">{t('adminWelcomeBack')}</p>
                <p className="text-sm md:text-lg font-semibold text-foreground">{user?.full_name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Message Modal - Beautiful Design */}
      {showMessageModal && selectedMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-luxury border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Contact Message</h3>
                    <p className="text-sm text-muted-foreground">Review and respond to user inquiry</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors group"
                >
                  <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              {/* User Information */}
              <div className="bg-gradient-to-br from-background to-muted/30 rounded-xl p-6 border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-semibold text-lg text-foreground">
                          {selectedMessage.user_name || selectedMessage.name || 'Anonymous User'}
                        </h4>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MailIcon className="w-4 h-4" />
                          <span className="text-sm">{selectedMessage.user_email || selectedMessage.email || 'No email provided'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        {new Date(selectedMessage.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-xl p-5 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm text-muted-foreground">SUBJECT</span>
                  </div>
                  <h5 className="font-semibold text-foreground text-lg mb-4">{selectedMessage.subject}</h5>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm text-muted-foreground">MESSAGE</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 text-foreground leading-relaxed">
                    {selectedMessage.message}
                  </div>
                </div>
              </div>

              {/* Previous Response */}
              {selectedMessage.admin_response && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800 dark:text-green-300">Previous Admin Response</span>
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" />
                      Sent
                    </div>
                  </div>
                  <div className="text-green-700 dark:text-green-200 bg-white/50 dark:bg-black/20 rounded-lg p-3">
                    {selectedMessage.admin_response}
                  </div>
                </div>
              )}

              {/* Reply Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                  <Edit className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-800 dark:text-blue-300">Compose Reply</span>
                </div>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full p-4 border border-blue-200 dark:border-blue-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-foreground bg-white/70 dark:bg-black/30 placeholder-muted-foreground"
                  rows={4}
                  placeholder="Type your professional response here..."
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">
                    {replyText.length}/1000 characters
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>This reply will be sent via email</span>
                    <MailIcon className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gradient-to-r from-background to-muted/30 p-6 border-t border-border">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  <span>Admin Response System</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowMessageModal(false)}
                    className="px-6 py-2.5 border border-border rounded-xl hover:bg-muted/50 text-foreground transition-all duration-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sendingReply}
                    className="px-8 py-2.5 bg-gradient-gold text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-2"
                  >
                    {sendingReply ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending Reply...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Professional Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {activeTab === 'people-management' && (
            <div className="space-y-6">
              {/* People Management Header */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold text-foreground">People Management</h2>
                  <p className="text-muted-foreground mt-1">Manage students, users, and mobile access credentials</p>
                </div>

                {/* Internal Navigation Tabs */}
                <div className="px-6 py-4">
                  <nav className="flex space-x-1 bg-muted/50 rounded-lg p-1">
                    {[
                      { id: 'students', name: 'Students', icon: Users },
                      { id: 'pending-registrations', name: 'Pending Registrations', icon: FileText },
                      { id: 'users', name: 'Users', icon: UserPlus },
                      { id: 'mobile-credentials', name: 'Mobile Access', icon: Settings },
                      { id: 'notifications', name: 'Notifications', icon: Mail }
                    ].map((subTab) => {
                      const Icon = subTab.icon;
                      return (
                        <button
                          key={subTab.id}
                          onClick={() => setActiveSubTab(subTab.id)}
                          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            activeSubTab === subTab.id
                              ? 'bg-gradient-gold text-secondary shadow-luxury'
                              : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {subTab.name}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {/* Students Sub-Tab */}
              {activeSubTab === 'students' && (
                <div className="space-y-6">
                  {/* Students Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                          <p className="text-2xl font-bold text-foreground">{students.length}</p>
                        </div>
                        <Users className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Active Students</p>
                          <p className="text-2xl font-bold text-foreground">
                            {students.filter(s => s.status.is_enrolled).length}
                          </p>
                        </div>
                        <UserCheck className="w-8 h-8 text-green-600" />
                      </div>
                    </div>
                    <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Current Sessions</p>
                          <p className="text-2xl font-bold text-foreground">
                            {currentSessions.length}
                          </p>
                        </div>
                        <Activity className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                    <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Enrollments</p>
                          <p className="text-2xl font-bold text-foreground">
                            {students.reduce((acc, s) => acc + (s.enrollment_info?.total_enrollments || 0), 0)}
                          </p>
                        </div>
                        <BookOpen className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Students Management Section */}
                  <div className="bg-card rounded-xl shadow-luxury border border-border">
                    <div className="p-6 border-b border-border">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Enhanced Student Management</h3>
                          <p className="text-muted-foreground mt-1">Comprehensive view with attendance and payment tracking</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={testTimeRestrictionModal}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                          >
                            TEST MODAL
                          </button>
                          <button
                            onClick={() => setStudentsViewMode(studentsViewMode === 'table' ? 'cards' : 'table')}
                            className="px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            {studentsViewMode === 'table' ? 'Card View' : 'Table View'}
                          </button>
                        </div>
                      </div>

                      {/* Enhanced Filters and Controls */}
                      <div className="space-y-6">
                        {/* Quick Status Overview */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-4 text-center shadow-luxury backdrop-blur-sm">
                            <div className="text-3xl font-bold text-primary mb-1">{totalStudentsCount}</div>
                            <div className="text-sm text-primary/80 font-semibold uppercase tracking-wide">Total Students</div>
                          </div>
                          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-400/5 border-2 border-emerald-500/20 rounded-xl p-4 text-center shadow-luxury backdrop-blur-sm">
                            <div className="text-3xl font-bold text-emerald-700 mb-1">{filteredStudentsCount}</div>
                            <div className="text-sm text-emerald-600 font-semibold uppercase tracking-wide">Filtered Results</div>
                          </div>
                          <div className="bg-gradient-to-br from-orange-500/10 to-orange-400/5 border-2 border-orange-500/20 rounded-xl p-4 text-center shadow-luxury backdrop-blur-sm">
                            <div className="text-3xl font-bold text-orange-700 mb-1">{currentSessions.length}</div>
                            <div className="text-sm text-orange-600 font-semibold uppercase tracking-wide">Live Sessions</div>
                          </div>
                          <div className="bg-gradient-to-br from-purple-500/10 to-purple-400/5 border-2 border-purple-500/20 rounded-xl p-4 text-center shadow-luxury backdrop-blur-sm">
                            <div className="text-3xl font-bold text-purple-700 mb-1">{selectedStudents.size}</div>
                            <div className="text-sm text-purple-600 font-semibold uppercase tracking-wide">Selected</div>
                          </div>
                        </div>

                        {/* Advanced Filter Panel */}
                        <div className="bg-gradient-to-br from-card to-card/80 border-2 border-border/50 rounded-2xl p-6 shadow-luxury backdrop-blur-sm">
                          <div className="mb-6">
                            <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                              <Settings className="w-5 h-5 text-primary" />
                              Advanced Filters & Search
                            </h3>
                            <p className="text-sm text-muted-foreground">Use the filters below to find specific students and manage your data efficiently.</p>
                          </div>

                          {/* Search Bar - Full Width */}
                          <div className="mb-6">
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <input
                                type="text"
                                placeholder="Search by student name, email, phone, or parent name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300 placeholder-muted-foreground"
                              />
                              {searchTerm && (
                                <button
                                  onClick={() => setSearchTerm('')}
                                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Filter Row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                Section
                              </label>
                              <select
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300 font-medium 
                                          [&>option]:bg-card [&>option]:text-foreground [&>option]:py-2 [&>option]:px-4 
                                          [&>option:hover]:bg-primary/10 [&>option:checked]:bg-primary [&>option:checked]:text-white
                                          [&>option]:border-0 [&>option]:rounded-lg [&>option]:my-1"
                                style={{
                                  background: 'linear-gradient(to right, hsl(var(--background)), hsl(var(--card)))',
                                  color: 'hsl(var(--foreground))'
                                }}
                              >
                                <option value="all" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>🌟 All Sections</option>
                                {allSections.map((section) => {
                                  const isHighlighted = shouldHighlightSession(section);
                                  const isLive = isCurrentSession(section);
                                  
                                  return (
                                    <option 
                                      key={section.id} 
                                      value={section.id.toString()}
                                      style={{ 
                                        backgroundColor: isHighlighted ? '#fbbf24' : 'hsl(var(--card))', // Gold background for highlighted
                                        color: isHighlighted ? '#1f2937' : 'hsl(var(--foreground))', // Dark text on gold
                                        padding: '8px 16px',
                                        fontWeight: isHighlighted ? 'bold' : 'normal'
                                      }}
                                    >
                                      {section.course_name} - {section.section_name}
                                      {isLive && ' 🔴 LIVE'}
                                      {isHighlighted && !isLive && ' ⏰ SOON'}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-primary" />
                                Course
                              </label>
                              <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300 font-medium 
                                          [&>option]:bg-card [&>option]:text-foreground [&>option]:py-2 [&>option]:px-4 
                                          [&>option:hover]:bg-primary/10 [&>option:checked]:bg-primary [&>option:checked]:text-white
                                          [&>option]:border-0 [&>option]:rounded-lg [&>option]:my-1"
                                style={{
                                  background: 'linear-gradient(to right, hsl(var(--background)), hsl(var(--card)))',
                                  color: 'hsl(var(--foreground))'
                                }}
                              >
                                <option value="all" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>📚 All Courses</option>
                                {courses.map((course) => (
                                  <option 
                                    key={course.id} 
                                    value={course.id.toString()}
                                    style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}
                                  >
                                    {course.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-primary" />
                                Status
                              </label>
                              <select
                                value={studentStatusFilter}
                                onChange={(e) => setStudentStatusFilter(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300 font-medium 
                                          [&>option]:bg-card [&>option]:text-foreground [&>option]:py-2 [&>option]:px-4 
                                          [&>option:hover]:bg-primary/10 [&>option:checked]:bg-primary [&>option:checked]:text-white
                                          [&>option]:border-0 [&>option]:rounded-lg [&>option]:my-1"
                                style={{
                                  background: 'linear-gradient(to right, hsl(var(--background)), hsl(var(--card)))',
                                  color: 'hsl(var(--foreground))'
                                }}
                              >
                                <option value="all" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>👥 All Students</option>
                                <option value="active" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>✅ Active</option>
                                <option value="pending" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>⏳ Pending</option>
                                <option value="inactive" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>❌ Inactive</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-primary" />
                                Payment
                              </label>
                              <select
                                value={paymentStatusFilter}
                                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300 font-medium 
                                          [&>option]:bg-card [&>option]:text-foreground [&>option]:py-2 [&>option]:px-4 
                                          [&>option:hover]:bg-primary/10 [&>option:checked]:bg-primary [&>option:checked]:text-white
                                          [&>option]:border-0 [&>option]:rounded-lg [&>option]:my-1"
                                style={{
                                  background: 'linear-gradient(to right, hsl(var(--background)), hsl(var(--card)))',
                                  color: 'hsl(var(--foreground))'
                                }}
                              >
                                <option value="all" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>💰 All Payments</option>
                                <option value="paid" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>✅ Paid</option>
                                <option value="pending" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>⏳ Pending</option>
                                <option value="overdue" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>🚨 Overdue</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-500" />
                                Active Sessions
                              </label>
                              <select
                                value={activeSessionsFilter}
                                onChange={(e) => setActiveSessionsFilter(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300 font-medium 
                                          [&>option]:bg-card [&>option]:text-foreground [&>option]:py-2 [&>option]:px-4 
                                          [&>option:hover]:bg-primary/10 [&>option:checked]:bg-primary [&>option:checked]:text-white
                                          [&>option]:border-0 [&>option]:rounded-lg [&>option]:my-1"
                                style={{
                                  background: 'linear-gradient(to right, hsl(var(--background)), hsl(var(--card)))',
                                  color: 'hsl(var(--foreground))'
                                }}
                              >
                                <option value="all" style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', padding: '8px 16px' }}>🌟 All Sessions</option>
                                <option value="live" style={{ backgroundColor: '#ef4444', color: '#ffffff', padding: '8px 16px', fontWeight: 'bold' }}>🔴 Live Now</option>
                                <option value="starting-soon" style={{ backgroundColor: '#f59e0b', color: '#ffffff', padding: '8px 16px', fontWeight: 'bold' }}>⏰ Starting Soon (30min)</option>
                                <option value="ending-soon" style={{ backgroundColor: '#f59e0b', color: '#ffffff', padding: '8px 16px', fontWeight: 'bold' }}>⏳ Ending Soon (30min)</option>
                                <option value="active-window" style={{ backgroundColor: '#10b981', color: '#ffffff', padding: '8px 16px', fontWeight: 'bold' }}>🔥 Active Window (All)</option>
                              </select>
                            </div>
                          </div>
                            
                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-4 justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-muted-foreground">
                                Showing {filteredStudentsCount} of {totalStudentsCount} students
                              </span>
                              {(selectedSection !== 'all' || selectedCourse !== 'all' || studentStatusFilter !== 'all' || paymentStatusFilter !== 'all' || activeSessionsFilter !== 'all' || debouncedSearchTerm) && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-primary/10 text-primary rounded-full border border-primary/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  Filters Active
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  setSelectedSection('all');
                                  setSelectedCourse('all');
                                  setStudentStatusFilter('all');
                                  setPaymentStatusFilter('all');
                                  setActiveSessionsFilter('all');
                                  setSearchTerm('');
                                }}
                                className="flex items-center gap-2 px-4 py-3 text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
                              >
                                <X className="w-4 h-4" />
                                Clear All
                              </button>
                              <button
                                onClick={() => fetchStudentsTableData(true)}
                                disabled={studentsLoading}
                                className="flex items-center gap-2 px-4 py-3 text-sm bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl hover:shadow-luxury transition-all duration-300 transform hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              >
                                <RefreshCw className={`w-4 h-4 ${studentsLoading ? 'animate-spin' : ''}`} />
                                {studentsLoading ? 'Loading...' : 'Refresh Data'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {/* Enhanced Bulk Actions Bar */}
                      {selectedStudents.size > 0 && (
                        <div className="mb-6 p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl shadow-luxury">
                          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-sm font-bold text-white">{selectedStudents.size}</span>
                              </div>
                              <div>
                                <span className="font-bold text-foreground text-lg">
                                  {selectedStudents.size} student{selectedStudents.size > 1 ? 's' : ''} selected
                                </span>
                                <p className="text-sm text-muted-foreground">Choose an action to apply to all selected students</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3">
                              {/* Info message about read-only mode */}
                              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <Info className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-medium text-blue-700">
                                  Dashboard displays attendance & payment statistics only - Actions removed
                                </span>
                              </div>

                              {/* Clear Selection */}
                              <button
                                onClick={() => setSelectedStudents(new Set())}
                                disabled={processingBulkAction}
                                className="px-3 py-2 border border-border/50 bg-muted/30 text-muted-foreground rounded-lg hover:bg-muted/50 hover:text-foreground transition-all duration-200"
                              >
                                Clear Selection
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {studentsLoading ? (
                        /* Enhanced Loading State */
                        <div className="space-y-4">
                          {/* Skeleton for filter panel */}
                          <div className="bg-gradient-to-br from-card to-card/80 border-2 border-border/50 rounded-2xl p-6 shadow-luxury">
                            <div className="animate-pulse space-y-4">
                              <div className="h-6 bg-muted/30 rounded-lg w-1/3"></div>
                              <div className="h-12 bg-muted/30 rounded-xl"></div>
                              <div className="grid grid-cols-4 gap-4">
                                <div className="h-20 bg-muted/30 rounded-xl"></div>
                                <div className="h-20 bg-muted/30 rounded-xl"></div>
                                <div className="h-20 bg-muted/30 rounded-xl"></div>
                                <div className="h-20 bg-muted/30 rounded-xl"></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Skeleton for table */}
                          <div className="overflow-x-auto rounded-xl shadow-luxury border border-border/50">
                            <div className="w-full bg-card">
                              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-6">
                                <div className="animate-pulse flex space-x-4">
                                  <div className="h-4 bg-primary/20 rounded w-1/6"></div>
                                  <div className="h-4 bg-primary/20 rounded w-1/4"></div>
                                  <div className="h-4 bg-primary/20 rounded w-1/4"></div>
                                  <div className="h-4 bg-primary/20 rounded w-1/4"></div>
                                  <div className="h-4 bg-primary/20 rounded w-1/6"></div>
                                </div>
                              </div>
                              <div className="p-6 space-y-4">
                                {[1, 2, 3, 4, 5].map((item) => (
                                  <div key={item} className="animate-pulse flex items-center space-x-4 p-4 border border-border/20 rounded-xl">
                                    <div className="h-16 w-16 bg-muted/30 rounded-2xl"></div>
                                    <div className="flex-1 space-y-2">
                                      <div className="h-4 bg-muted/30 rounded w-1/3"></div>
                                      <div className="h-3 bg-muted/20 rounded w-1/4"></div>
                                    </div>
                                    <div className="h-8 w-24 bg-muted/30 rounded-lg"></div>
                                    <div className="h-8 w-24 bg-muted/30 rounded-lg"></div>
                                    <div className="h-8 w-24 bg-muted/30 rounded-lg"></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-center py-8">
                            <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 border border-primary/20 rounded-xl">
                              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                              <span className="text-primary font-semibold">Loading students data...</span>
                            </div>
                          </div>
                        </div>
                      ) : studentsViewMode === 'table' ? (
                        /* Enhanced Table View */
                        <div className="overflow-x-auto rounded-xl shadow-luxury border border-border/50">
                          <div className="min-w-[1200px]"> {/* Ensure minimum width for proper layout */}
                            <table className="w-full border-collapse bg-card">
                              <thead className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm">
                                <tr className="border-b-2 border-primary/20">
                                  <th className="text-left p-4 lg:p-6 font-bold text-primary text-xs lg:text-sm uppercase tracking-wider w-20">
                                    <div className="flex items-center gap-2 lg:gap-3">
                                      <input
                                        type="checkbox"
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedStudents(new Set(studentsTableData.map(s => s.id)));
                                          } else {
                                            setSelectedStudents(new Set());
                                          }
                                        }}
                                        className="w-4 h-4 lg:w-5 lg:h-5 rounded border-2 border-primary/30 text-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                      />
                                      <span className="hidden lg:inline">Select</span>
                                    </div>
                                  </th>
                                  <th className="text-left p-4 lg:p-6 font-bold text-primary text-xs lg:text-sm uppercase tracking-wider min-w-[250px]">
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 lg:w-5 lg:h-5" />
                                      <span className="hidden sm:inline">Student Information</span>
                                      <span className="sm:hidden">Student</span>
                                    </div>
                                  </th>
                                  <th className="text-left p-4 lg:p-6 font-bold text-primary text-xs lg:text-sm uppercase tracking-wider min-w-[200px]">
                                    <div className="flex items-center gap-2">
                                      <BookOpen className="w-4 h-4 lg:w-5 lg:h-5" />
                                      <span className="hidden sm:inline">Courses & Sections</span>
                                      <span className="sm:hidden">Courses</span>
                                    </div>
                                  </th>
                                  <th className="text-left p-4 lg:p-6 font-bold text-primary text-xs lg:text-sm uppercase tracking-wider min-w-[250px]">
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="w-4 h-4 lg:w-5 lg:h-5" />
                                      <span className="hidden sm:inline">Attendance & Actions</span>
                                      <span className="sm:hidden">Attendance</span>
                                    </div>
                                  </th>
                                  <th className="text-left p-4 lg:p-6 font-bold text-primary text-xs lg:text-sm uppercase tracking-wider min-w-[150px]">
                                    <div className="flex items-center gap-2">
                                      <Settings className="w-4 h-4 lg:w-5 lg:h-5" />
                                      <span className="hidden sm:inline">Quick Actions</span>
                                      <span className="sm:hidden">Actions</span>
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                            <tbody className="divide-y divide-border/30">
                              {filteredStudentsData.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center py-16 bg-gradient-to-br from-muted/30 to-muted/10">
                                    <div className="flex flex-col items-center">
                                      <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mb-6 shadow-luxury">
                                        <Users className="w-10 h-10 text-primary" />
                                      </div>
                                      <h3 className="text-xl font-bold text-foreground mb-2">
                                        {studentsTableData.length === 0 ? 'No Students Found' : 'No Matching Students'}
                                      </h3>
                                      <p className="text-muted-foreground mb-6 max-w-md text-center leading-relaxed">
                                        {studentsTableData.length === 0 
                                          ? 'Get started by adding your first student to the system.'
                                          : 'Try adjusting your search criteria or filters to find the students you\'re looking for.'
                                        }
                                      </p>
                                      {studentsTableData.length > 0 && (
                                        <button
                                          onClick={() => {
                                            setSelectedSection('all');
                                            setSelectedCourse('all');
                                            setStudentStatusFilter('all');
                                            setPaymentStatusFilter('all');
                                            setSearchTerm('');
                                          }}
                                          className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-xl hover:shadow-luxury transition-all duration-300 hover:scale-105"
                                        >
                                          Clear All Filters
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                filteredStudentsData.map((student) => (
                                    <tr key={student.id} className="group border-b border-border/20 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-300 hover:shadow-md">
                                      <td className="p-4 lg:p-6 align-top">
                                        <input
                                          type="checkbox"
                                          checked={selectedStudents.has(student.id)}
                                          onChange={(e) => {
                                            const newSelected = new Set(selectedStudents);
                                            if (e.target.checked) {
                                              newSelected.add(student.id);
                                            } else {
                                              newSelected.delete(student.id);
                                            }
                                            setSelectedStudents(newSelected);
                                          }}
                                          className="w-4 h-4 lg:w-5 lg:h-5 rounded border-2 border-primary/30 text-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                      </td>
                                      
                                      {/* Student Info */}
                                      <td className="p-4 lg:p-6 align-top">
                                        <div className="flex items-center gap-3 lg:gap-4">
                                          <div className="relative">
                                            <ProfilePictureUploader
                                              currentImageUrl={student.profile_picture_url || null}
                                              size="md"
                                              editable={false}
                                              className="flex-shrink-0"
                                            />
                                            <div className={`absolute -bottom-1 -right-1 w-4 h-4 lg:w-5 lg:h-5 rounded-full border-2 border-white shadow-sm ${
                                              student.status?.is_enrolled 
                                                ? 'bg-green-500' 
                                                : 'bg-amber-500'
                                            }`}></div>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-foreground text-base lg:text-lg mb-1 truncate group-hover:text-primary transition-colors">
                                              {student.name}
                                            </h3>
                                            <p className="text-xs lg:text-sm text-muted-foreground mb-2 font-mono">
                                              ID: <span className="font-semibold text-primary">{student.id}</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                              <span className={`inline-flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1 lg:py-1.5 text-xs font-bold rounded-full shadow-sm transition-all ${
                                                student.status?.is_enrolled 
                                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-200' 
                                                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-200'
                                              }`}>
                                                {student.status?.is_enrolled ? (
                                                  <>
                                                    <CheckCircle className="w-2 h-2 lg:w-3 lg:h-3" />
                                                    <span className="hidden sm:inline">Active</span>
                                                    <span className="sm:hidden">✓</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Clock className="w-2 h-2 lg:w-3 lg:h-3" />
                                                    <span className="hidden sm:inline">Pending</span>
                                                    <span className="sm:hidden">⏳</span>
                                                  </>
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                      
                                      {/* Courses & Sections */}
                                      <td className="p-4 lg:p-6 align-top">
                                        <div className="space-y-2 lg:space-y-3">
                                          <div className="flex items-center gap-2 mb-2 lg:mb-3">
                                            <BookOpen className="w-3 h-3 lg:w-4 lg:h-4 text-primary" />
                                            <span className="font-bold text-foreground text-sm lg:text-lg">
                                              {student.enrollments?.length || 0} Course{student.enrollments?.length !== 1 ? 's' : ''}
                                            </span>
                                          </div>
                                          <div className="space-y-1 lg:space-y-2">
                                            {student.enrollments?.slice(0, 3).map((enrollment: any, index: number) => (
                                              <div key={index} className="relative">
                                                <div className={`p-2 lg:p-3 rounded-lg lg:rounded-xl border-2 transition-all duration-300 ${
                                                  isCurrentSession(enrollment.section) 
                                                    ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 shadow-md animate-pulse' 
                                                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:shadow-sm'
                                                }`}>
                                                  <div className="flex items-center justify-between mb-1 lg:mb-2">
                                                    <span className={`font-semibold text-xs lg:text-sm ${
                                                      isCurrentSession(enrollment.section) ? 'text-red-800' : 'text-blue-800'
                                                    }`}>
                                                      {enrollment.course_name}
                                                    </span>
                                                    {isCurrentSession(enrollment.section) && (
                                                      <span className="flex items-center gap-1 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                                                        <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                        <span className="hidden sm:inline">LIVE</span>
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1 lg:gap-2">
                                                    <Calendar className="w-2 h-2 lg:w-3 lg:h-3 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground font-medium truncate">
                                                      {enrollment.section_name}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                            {student.enrollments?.length > 3 && (
                                              <div className="mt-2 p-1.5 lg:p-2 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                                                <p className="text-xs text-muted-foreground font-semibold text-center">
                                                  +{student.enrollments.length - 3} more course{student.enrollments.length - 3 !== 1 ? 's' : ''}
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      
                                      {/* Attendance & Actions */}
                                      <td className="p-4 lg:p-6 align-top">
                                        <div className="space-y-3 lg:space-y-4">
                                          {student.enrollments?.map((enrollment: any, index: number) => (
                                            <div key={index} className="bg-gradient-to-br from-card to-card/80 border-2 border-border/30 rounded-lg lg:rounded-xl p-3 lg:p-4 shadow-sm hover:shadow-md transition-all duration-300">
                                              <div className="flex items-center justify-between mb-2 lg:mb-3">
                                                <div className="flex items-center gap-1 lg:gap-2">
                                                  <UserCheck className="w-3 h-3 lg:w-4 lg:h-4 text-primary" />
                                                  <span className="text-xs lg:text-sm font-bold text-foreground truncate">
                                                    {enrollment.course_name}
                                                  </span>
                                                  {/* Course Type Badge */}
                                                  <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded ${
                                                    (enrollment.pricing_type || 'session') === 'monthly' 
                                                      ? 'bg-purple-100 text-purple-800'
                                                      : 'bg-blue-100 text-blue-800'
                                                  }`}>
                                                    {(enrollment.pricing_type || 'session') === 'monthly' ? 'Monthly' : 'Session'}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1 lg:gap-2">
                                                  <Activity className="w-2 h-2 lg:w-3 lg:h-3 text-muted-foreground" />
                                                  <span className={`px-2 lg:px-3 py-0.5 lg:py-1 text-xs font-bold rounded-full shadow-sm ${
                                                    (enrollment.attendance_rate || 0) >= 80 
                                                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                                                      : (enrollment.attendance_rate || 0) >= 60
                                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                                      : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                                                  }`}>
                                                    {enrollment.attendance_rate || 0}%
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Kindergarten Subscription Display */}
                                              {enrollment.is_kindergarten ? (
                                                <div className="mb-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 border border-purple-300 rounded-lg">
                                                  <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                      <span className="text-xl">🧸</span>
                                                      <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Kindergarten Subscription</span>
                                                    </div>
                                                    <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full font-bold">
                                                      {enrollment.subscription_status || 'Active'}
                                                    </span>
                                                  </div>
                                                  
                                                  {/* Monthly Attendance Count */}
                                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div className="bg-white/60 rounded-lg p-2 text-center">
                                                      <div className="text-lg font-bold text-purple-700">
                                                        {enrollment.monthly_sessions_attended || 0}
                                                      </div>
                                                      <div className="text-xs text-purple-600">Days This Month</div>
                                                    </div>
                                                    <div className="bg-white/60 rounded-lg p-2 text-center">
                                                      <div className="text-lg font-bold text-green-700">
                                                        {enrollment.attendance_rate || 0}%
                                                      </div>
                                                      <div className="text-xs text-green-600">Attendance Rate</div>
                                                    </div>
                                                  </div>

                                                  {/* Subscription Payment Info */}
                                                  <div className="bg-white/80 rounded-lg p-2 space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                      <span className="text-purple-600 font-medium">Monthly Fee:</span>
                                                      <span className="text-purple-800 font-bold">
                                                        {enrollment.subscription_amount || enrollment.price_per_session || 0} DA
                                                      </span>
                                                    </div>
                                                    <div className="flex justify-between text-xs">
                                                      <span className="text-purple-600 font-medium">Next Payment:</span>
                                                      <span className="text-purple-800 font-bold">
                                                        {enrollment.next_subscription_date || 'Not Set'}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  {/* Payment Due Notice */}
                                                  {enrollment.next_subscription_date && new Date(enrollment.next_subscription_date) <= new Date() && (
                                                    <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-md">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                          <AlertCircle className="w-3 h-3 text-red-600" />
                                                          <span className="text-xs text-red-800 font-medium">💰 Payment Overdue</span>
                                                        </div>
                                                        <button
                                                          onClick={() => {/* Handle kindergarten payment */}}
                                                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200 flex items-center gap-1"
                                                          title="Process monthly payment"
                                                        >
                                                          <CheckCircle className="w-3 h-3" />
                                                          Pay Now
                                                        </button>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (enrollment.pricing_type || 'session') === 'monthly' && (
                                                <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                                                  <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Monthly Progress</span>
                                                    <span className="text-xs font-bold text-purple-800">
                                                      {enrollment.monthly_sessions_attended || 0}/4 Sessions
                                                    </span>
                                                  </div>
                                                  <div className="w-full bg-purple-200 rounded-full h-2.5 mb-2">
                                                    <div 
                                                      className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                                                      style={{ width: `${((enrollment.monthly_sessions_attended || 0) / 4) * 100}%` }}
                                                    ></div>
                                                  </div>
                                                  <div className="flex justify-between text-xs text-purple-600">
                                                    <span>0</span>
                                                    <span>1</span>
                                                    <span>2</span>
                                                    <span>3</span>
                                                    <span className="font-bold">4</span>
                                                  </div>
                                                  {/* Auto payment trigger notice */}
                                                  {enrollment.monthly_sessions_attended >= 4 && (
                                                    <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded-md">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                          <AlertCircle className="w-3 h-3 text-yellow-600" />
                                                          <span className="text-xs text-yellow-800 font-medium">Payment Due: Month Completed</span>
                                                        </div>
                                                        <button
                                                          onClick={() => handleResetMonthlyAttendance(student.id, enrollment.section_id)}
                                                          disabled={markingAttendance.has(student.id)}
                                                          className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200 flex items-center gap-1"
                                                          title="Mark as paid and reset attendance to 0/4"
                                                        >
                                                          <CheckCircle className="w-3 h-3" />
                                                          Paid (Reset)
                                                        </button>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {/* Session-based Attendance - Always show with time restrictions */}
                                              {((enrollment.pricing_type || 'session') === 'session') && (
                                                <div className="space-y-2">
                                                  <div className="flex items-center gap-1 lg:gap-2 mb-2">
                                                    {canMarkAttendance(enrollment.section) ? (
                                                      <>
                                                        <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                        <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Time Window Open</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-amber-500 rounded-full animate-pulse"></div>
                                                        <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Outside Window - Warning</span>
                                                      </>
                                                    )}
                                                  </div>

                                                  {/* Payment Status Section - Show after attendance is marked */}
                                                  {enrollment.today_attendance && (
                                                    <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                                                      <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-semibold text-blue-700">Payment Status</span>
                                                        <div className="flex items-center gap-2">
                                                          <span className={`px-2 py-1 text-xs font-bold rounded ${
                                                            enrollment.today_attendance.payment_status === 'paid'
                                                              ? 'bg-green-100 text-green-800'
                                                              : enrollment.today_attendance.payment_status === 'debt'
                                                              ? 'bg-red-100 text-red-800'
                                                              : 'bg-yellow-100 text-yellow-800'
                                                          }`}>
                                                            {enrollment.today_attendance.payment_status === 'paid' ? 'PAID' :
                                                             enrollment.today_attendance.payment_status === 'debt' ? 'DEBT' : 'UNPAID'}
                                                          </span>
                                                          {(enrollment.total_debt || 0) > 0 && (
                                                            <span className="text-xs font-bold text-red-600">
                                                              Total: {enrollment.total_debt} DA
                                                            </span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {/* Monthly Course Actions - with time restrictions too */}
                                              {(enrollment.pricing_type || 'session') === 'monthly' && (
                                                <div className="space-y-2">
                                                  <div className="flex items-center gap-1 lg:gap-2 mb-2">
                                                    <Calendar className="w-3 h-3 text-purple-600" />
                                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Monthly Attendance</span>
                                                    {canMarkAttendance(enrollment.section) ? (
                                                      <span className="text-xs text-green-600 font-medium">(Time Window Open)</span>
                                                    ) : (
                                                      <span className="text-xs text-amber-600 font-medium">(Warning Needed)</span>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                      
                                      {/* Quick Actions */}
                                      <td className="p-4 lg:p-6 align-top">
                                        <div className="flex flex-col gap-2 lg:gap-3">
                                          <button
                                            onClick={() => handleViewStudentDetails(student)}
                                            className="group flex items-center justify-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 text-blue-600 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg lg:rounded-xl transition-all duration-300 border-2 border-blue-200 hover:border-blue-300 shadow-sm hover:shadow-md transform hover:scale-105"
                                            title="View Student Details"
                                          >
                                            <Eye className="w-3 h-3 lg:w-4 lg:h-4 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs lg:text-sm font-bold hidden sm:inline">View</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                              )}
                            </tbody>
                          </table>
                          </div> {/* Close min-w-[1200px] wrapper */}
                        </div>
                      ) : (
                        /* Legacy Card View */
                        !Array.isArray(filteredStudents) || filteredStudents.length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No students found</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredStudents.map((student) => (
                              <StudentCard
                                key={student.id}
                                student={student}
                                onToggleMobile={() => handleToggleStudentMobile(student.id)}
                                onViewDetails={() => handleViewStudentDetails(student)}
                                selectedSection={selectedSection}
                              />
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Registrations Sub-Tab */}
              {activeSubTab === 'pending-registrations' && (
                <div className="space-y-6">
                  {/* Pending Registrations Header */}
                  <div className="bg-card rounded-xl shadow-luxury border border-border">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Pending Course Registrations</h3>
                        <p className="text-muted-foreground mt-1">Review and manage new course registration requests</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                          <FileText className="w-3 h-3" />
                          {registrations.filter(reg => reg.status === 'pending').length} Pending
                        </span>
                        <button
                          onClick={() => {
                            fetchRegistrations();
                            toast.success('Refreshed registrations data');
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Registrations Filters */}
                    <div className="p-6 border-b border-border">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-foreground">Filter by Status</label>
                          <select
                            value={registrationStatusFilter}
                            onChange={(e) => setRegistrationStatusFilter(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300"
                          >
                            <option value="all">All Registrations</option>
                            <option value="pending">⏳ Pending Review</option>
                            <option value="approved">✅ Approved</option>
                            <option value="rejected">❌ Rejected</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-foreground">Filter by Course</label>
                          <select
                            value={registrationCourseFilter}
                            onChange={(e) => setRegistrationCourseFilter(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300"
                          >
                            <option value="all">All Courses</option>
                            {courses.map((course) => (
                              <option key={course.id} value={course.id.toString()}>
                                {course.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-foreground">Search</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Search by name, email..."
                              value={registrationSearchTerm}
                              onChange={(e) => setRegistrationSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 border-2 border-border/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gradient-to-r from-background to-card text-foreground shadow-sm transition-all duration-300"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Registrations List */}
                    <div className="p-6">
                      {filteredRegistrations.length === 0 ? (
                        <div className="text-center py-12">
                          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-foreground mb-2">No Registrations Found</h3>
                          <p className="text-muted-foreground">
                            {registrationStatusFilter === 'pending' 
                              ? 'No pending registrations at the moment.'
                              : 'No registrations match your current filters.'
                            }
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredRegistrations.map((registration) => (
                            <div
                              key={registration.id}
                              className="border border-border rounded-xl p-6 hover:shadow-md transition-all duration-300 bg-gradient-to-r from-card to-card/50"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-4 mb-3">
                                    <div>
                                      <h4 className="text-lg font-semibold text-foreground">
                                        {registration.first_name} {registration.last_name}
                                      </h4>
                                      <p className="text-sm text-muted-foreground">{registration.email}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full border ${
                                      registration.status === 'pending' 
                                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                                        : registration.status === 'approved'
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : 'bg-red-100 text-red-800 border-red-200'
                                    }`}>
                                      {registration.status === 'pending' && '⏳'}
                                      {registration.status === 'approved' && '✅'}
                                      {registration.status === 'rejected' && '❌'}
                                      {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-foreground">Course:</span>
                                      <p className="text-muted-foreground">{registration.course_name}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-foreground">Phone:</span>
                                      <p className="text-muted-foreground">{registration.phone || 'Not provided'}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-foreground">Registered:</span>
                                      <p className="text-muted-foreground">
                                        {new Date(registration.registration_date).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>

                                  {registration.message && (
                                    <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                      <span className="font-medium text-foreground text-sm">Message:</span>
                                      <p className="text-muted-foreground text-sm mt-1">{registration.message}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  {registration.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleRegistrationAction(registration.id, 'approve')}
                                        className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleRejectRegistration(registration.id)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                                      >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => handleViewRegistrationDetails(registration)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Users Sub-Tab */}
              {activeSubTab === 'users' && (
                <div className="bg-card rounded-xl shadow-luxury border border-border">
                  <div className="p-6 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Users Management</h3>
                      <p className="text-muted-foreground mt-1">Manage user accounts and roles</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowUserModal(true)}
                        className="px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300"
                      >
                        <UserPlus className="w-4 h-4 inline mr-2" />
                        Add User
                      </button>
                      <button
                        onClick={fetchUsers}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-muted-foreground mt-2">Loading users...</p>
                      </div>
                    ) : !Array.isArray(users) || users.length === 0 ? (
                      <div className="text-center py-8">
                        <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No users found</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {users.map((user) => (
                          <div key={user.id} className="bg-card rounded-lg p-6 border border-border shadow-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-gold rounded-full flex items-center justify-center">
                                  <span className="text-secondary font-semibold text-lg">
                                    {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="text-lg font-semibold text-foreground">{user.full_name || 'Unnamed User'}</h4>
                                  <p className="text-muted-foreground">{user.email}</p>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      user.role === 'admin'
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        : user.role === 'teacher'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    }`}>
                                      {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'User'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      user.is_active
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}>
                                      {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="p-2 text-primary hover:text-primary/80 hover:bg-primary/10 rounded transition-colors"
                                  title="Edit user"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                  className={`p-2 rounded transition-colors ${
                                    user.is_active
                                      ? 'text-orange-500 hover:text-orange-400 hover:bg-orange-500/10'
                                      : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'
                                  }`}
                                  title={user.is_active ? 'Deactivate user' : 'Activate user'}
                                >
                                  {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile Credentials Sub-Tab */}
              {activeSubTab === 'mobile-credentials' && (
                <div className="bg-card rounded-xl shadow-luxury border border-border">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Mobile Access Credentials</h3>
                    <p className="text-muted-foreground mt-1">Manage mobile app access for parents and students</p>
                  </div>
                  <div className="p-6">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-muted-foreground mt-2">{t('adminLoadingCredentials')}</p>
                      </div>
                    ) : !Array.isArray(mobileCredentials) || mobileCredentials.length === 0 ? (
                      <div className="text-center py-8">
                        <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">{t('adminNoCredentials')}</p>
                        <p className="text-sm text-muted-foreground mt-2">{t('adminCredentialsGeneratedNote')}</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {mobileCredentials.map((credential) => (
                          <div key={credential.id} className="bg-card rounded-lg p-6 border border-border shadow-lg">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h4 className="text-lg font-semibold text-foreground">
                                    {credential.type === 'student' && credential.student_name 
                                      ? credential.student_name 
                                      : credential.name}
                                  </h4>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    credential.type === 'parent'
                                      ? 'bg-primary/20 text-primary border border-primary/30'
                                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  }`}>
                                    {credential.type === 'parent' ? t('adminParent') : 'Student'}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    credential.mobile_app_enabled
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}>
                                    {credential.mobile_app_enabled ? t('adminActive') : t('adminInactive')}
                                  </span>
                                </div>
                                {credential.email && (
                                  <p className="text-sm text-muted-foreground mb-2">{credential.email}</p>
                                )}
                                {credential.created_at && (
                                  <p className="text-xs text-muted-foreground">
                                    {t('adminCreated')}: {new Date(credential.created_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleRegenerateCredentials(credential.id, credential.type)}
                                disabled={regeneratingCredentials.has(credential.id)}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center space-x-2"
                              >
                                {regeneratingCredentials.has(credential.id) ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                                ) : (
                                  <Settings className="w-4 h-4" />
                                )}
                                <span>{t('adminRegenerate')}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                                <h4 className="text-sm font-medium text-primary mb-2 flex items-center">
                                  <Settings className="w-4 h-4 mr-2" />
                                  {t('adminMobileUsername')}
                                </h4>
                                <div className="flex items-center space-x-2">
                                  <code className="flex-1 bg-background px-3 py-2 rounded border text-sm font-mono text-foreground border-border">
                                    {credential.mobile_username}
                                  </code>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(credential.mobile_username);
                                      toast.success(t('adminUsernameCopied'));
                                    }}
                                    className="p-2 text-primary hover:text-primary/80 hover:bg-primary/10 rounded transition-colors"
                                    title="Copy username"
                                  >
                                    📋
                                  </button>
                                </div>
                              </div>
                              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-4 border border-green-500/20">
                                <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center">
                                  <Settings className="w-4 h-4 mr-2" />
                                  {t('adminMobilePassword')}
                                </h4>
                                <div className="flex items-center space-x-2">
                                  <code className="flex-1 bg-background px-3 py-2 rounded border text-sm font-mono text-foreground border-border">
                                    {credential.mobile_password 
                                      ? credential.mobile_password 
                                      : (credential.type === 'student' ? 'Password not generated' : t('adminPasswordHidden'))}
                                  </code>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(credential.mobile_password || '');
                                      toast.success(credential.mobile_password ? t('adminPasswordCopied') : t('noPasswordToCopy'));
                                    }}
                                    className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                                    title="Copy password"
                                  >
                                    📋
                                  </button>
                                </div>
                              </div>
                            </div>

                            {credential.type === 'parent' && (
                              <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center space-x-4">
                                  <span className={`px-3 py-1 rounded-full text-sm ${
                                    credential.mobile_app_enabled
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-muted text-muted-foreground border border-border'
                                  }`}>
                                    {credential.mobile_app_enabled ? 'App Access Enabled' : 'App Access Disabled'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {credential.type === 'student' && (
                              <div className="mb-4">
                                <span className={`px-3 py-1 rounded-full text-sm ${
                                  credential.mobile_app_enabled
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-muted text-muted-foreground border border-border'
                                }`}>
                                  {credential.mobile_app_enabled ? 'App Access Enabled' : 'App Access Disabled'}
                                </span>
                              </div>
                            )}

                            {credential.type === 'parent' && credential.students && credential.students.length > 0 && (
                              <div className="border-t pt-4">
                                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
                                  <Users className="w-4 h-4 mr-2" />
                                  Associated Students (Auto-linked)
                                </h4>
                                <div className="space-y-2">
                                  {credential.students.map((student, index) => (
                                    <div key={index} className="flex items-center justify-between bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                                      <div>
                                        <span className="text-sm font-medium text-green-400">{student.name}</span>
                                        {student.course_name && (
                                          <span className="text-xs text-green-300/80 ml-2">
                                            - {student.course_name}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                                        Auto-linked
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Students are automatically associated during registration approval
                                </p>
                              </div>
                            )}

                            {credential.type === 'student' && credential.course_name && (
                              <div className="border-t pt-4">
                                <h4 className="text-sm font-medium text-foreground mb-2">Enrolled Course</h4>
                                <span className="text-sm text-muted-foreground">{credential.course_name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Courses Management</h2>
                  <p className="text-muted-foreground mt-1">Create, edit, and manage courses</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowCourseModal(true)}
                    className="px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Course
                  </button>
                  <button
                    onClick={() => fetchDashboardData()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 inline mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">{t('adminLoadingCourses')}</p>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('adminNoCourses')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Advanced Search and Filter */}
                    <div className="space-y-4 mb-6">
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
                            placeholder={t('adminSearchCourses')}
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
                            {t('adminEducationalLevel')}
                          </label>
                          <select
                            value={selectedLevel || 'All'}
                            onChange={(e) => {
                              setSelectedLevel(e.target.value);
                              setSelectedGrade('All');
                              setSelectedSubject('All');
                            }}
                            className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            <option value="All">All Levels</option>
                            <option value="preschool">روضة وتمهيدي</option>
                            <option value="primary">ابتدائي</option>
                            <option value="middle">متوسط</option>
                            <option value="high">ثانوي</option>
                            <option value="bachelor">باكالوريا</option>
                          </select>
                        </div>

                        {/* Grade Filter */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            السنة الدراسية
                          </label>
                          <select
                            value={selectedGrade || 'All'}
                            onChange={(e) => setSelectedGrade(e.target.value)}
                            className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            disabled={!selectedLevel || selectedLevel === 'All'}
                          >
                            <option value="All">جميع السنوات</option>
                            {selectedLevel === 'preschool' && (
                              <>
                                <option value="preschool_3_4">تمهيدي 3/4 سنوات</option>
                                <option value="preschool_4_5">تمهيدي 4/5 سنوات</option>
                                <option value="preschool_5_6">تحضيري 5/6 سنوات</option>
                                <option value="preschool_year2">روضة السنة الثانية</option>
                              </>
                            )}
                            {selectedLevel === 'primary' && (
                              <>
                                <option value="primary_1">السنة الأولى</option>
                                <option value="primary_2">السنة الثانية</option>
                                <option value="primary_3">السنة الثالثة</option>
                                <option value="primary_4">السنة الرابعة</option>
                                <option value="primary_5">السنة الخامسة</option>
                              </>
                            )}
                            {selectedLevel === 'middle' && (
                              <>
                                <option value="middle_1">السنة الأولى</option>
                                <option value="middle_2">السنة الثانية</option>
                                <option value="middle_3">السنة الثالثة</option>
                                <option value="middle_4">السنة الرابعة</option>
                              </>
                            )}
                            {selectedLevel === 'high' && (
                              <>
                                <option value="high_1">السنة الأولى</option>
                                <option value="high_2">السنة الثانية</option>
                                <option value="high_3">السنة الثالثة</option>
                              </>
                            )}
                            {selectedLevel === 'bachelor' && (
                              <>
                                <option value="bachelor_1">السنة الأولى</option>
                                <option value="bachelor_2">السنة الثانية</option>
                                <option value="bachelor_3">السنة الثالثة</option>
                                <option value="bachelor_4">السنة الرابعة</option>
                                <option value="bachelor_5">السنة الخامسة</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Subject Filter */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            المادة
                          </label>
                          <select
                            value={selectedSubject || 'All'}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            disabled={!selectedLevel || selectedLevel === 'All'}
                          >
                            <option value="All">جميع المواد</option>
                            {selectedLevel === 'preschool' && (
                              <>
                                <option value="تمهيدي">تمهيدي</option>
                                <option value="تحضيري">تحضيري</option>
                                <option value="روضة">روضة</option>
                              </>
                            )}
                            {selectedLevel === 'primary' && (
                              <>
                                <option value="رياضيات">رياضيات</option>
                                <option value="عربية">عربية</option>
                                <option value="فرنسية">فرنسية</option>
                                <option value="إنجليزية">إنجليزية</option>
                                <option value="تحسين الخط والكتابة">تحسين الخط والكتابة</option>
                              </>
                            )}
                            {selectedLevel === 'middle' && (
                              <>
                                <option value="رياضيات">رياضيات</option>
                                <option value="فيزياء">فيزياء</option>
                                <option value="علوم">علوم</option>
                                <option value="عربية">عربية</option>
                                <option value="فرنسية">فرنسية</option>
                                <option value="إنجليزية">إنجليزية</option>
                              </>
                            )}
                            {selectedLevel === 'high' && (
                              <>
                                <option value="رياضيات">رياضيات</option>
                                <option value="فيزياء">فيزياء</option>
                                <option value="علوم">علوم</option>
                                <option value="عربية">عربية</option>
                                <option value="فرنسية">فرنسية</option>
                                <option value="إنجليزية">إنجليزية</option>
                                <option value="تسيير واقتصاد">تسيير واقتصاد</option>
                                <option value="فلسفة">فلسفة</option>
                              </>
                            )}
                            {selectedLevel === 'bachelor' && (
                              <>
                                <option value="رياضيات">رياضيات</option>
                                <option value="فيزياء">فيزياء</option>
                                <option value="كيمياء">كيمياء</option>
                                <option value="هندسة">هندسة</option>
                                <option value="طب">طب</option>
                                <option value="اقتصاد">اقتصاد</option>
                                <option value="قانون">قانون</option>
                                <option value="أدب">أدب</option>
                                <option value="علوم سياسية">علوم سياسية</option>
                                <option value="علوم الحاسوب">علوم الحاسوب</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            الحالة
                          </label>
                          <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            <option value="all">جميع الحالات</option>
                            <option value="active">نشط</option>
                            <option value="inactive">غير نشط</option>
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
                            setFilterStatus('all');
                          }}
                          className="px-4 py-2 text-sm text-primary hover:text-primary/80 font-medium"
                        >
                          مسح جميع المرشحات
                        </button>
                      </div>
                    </div>

                    {/* Courses Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {courses
                        .filter(course =>
                          course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .filter(course =>
                          filterStatus === 'all' ||
                          (filterStatus === 'active' && course.is_active) ||
                          (filterStatus === 'inactive' && !course.is_active)
                        )
                        .filter(course => {
                          if (!selectedLevel || selectedLevel === 'All') return true;

                          if (selectedLevel === 'preschool') {
                            return course.name.includes('روضة') ||
                                   course.name.includes('تمهيدي') ||
                                   course.name.includes('تحضيري');
                          } else if (selectedLevel === 'primary') {
                            return course.name.includes('ابتدائي');
                          } else if (selectedLevel === 'middle') {
                            return course.name.includes('متوسط');
                          } else if (selectedLevel === 'high') {
                            return course.name.includes('ثانوي');
                          }
                          return true;
                        })
                        .filter(course => {
                          if (!selectedGrade || selectedGrade === 'All') return true;

                          if (selectedGrade === 'preschool_3_4') {
                            return course.name.includes('تمهيدي') && course.name.includes('3/4');
                          } else if (selectedGrade === 'preschool_4_5') {
                            return course.name.includes('تمهيدي') && course.name.includes('4/5');
                          } else if (selectedGrade === 'preschool_5_6') {
                            return course.name.includes('تحضيري') && course.name.includes('5/6');
                          } else if (selectedGrade === 'preschool_year2') {
                            return course.name.includes('روضة') && course.name.includes('الثانية');
                          } else if (selectedGrade === 'primary_1') {
                            return course.name.includes('ابتدائي') && course.name.includes('الأولى');
                          } else if (selectedGrade === 'primary_2') {
                            return course.name.includes('ابتدائي') && course.name.includes('الثانية');
                          } else if (selectedGrade === 'primary_3') {
                            return course.name.includes('ابتدائي') && course.name.includes('الثالثة');
                          } else if (selectedGrade === 'primary_4') {
                            return course.name.includes('ابتدائي') && course.name.includes('الرابعة');
                          } else if (selectedGrade === 'primary_5') {
                            return course.name.includes('ابتدائي') && course.name.includes('الخامسة');
                          } else if (selectedGrade === 'middle_1') {
                            return course.name.includes('متوسط') && course.name.includes('الأولى');
                          } else if (selectedGrade === 'middle_2') {
                            return course.name.includes('متوسط') && course.name.includes('الثانية');
                          } else if (selectedGrade === 'middle_3') {
                            return course.name.includes('متوسط') && course.name.includes('الثالثة');
                          } else if (selectedGrade === 'middle_4') {
                            return course.name.includes('متوسط') && course.name.includes('الرابعة');
                          } else if (selectedGrade === 'high_1') {
                            return course.name.includes('ثانوي') && course.name.includes('الأولى');
                          } else if (selectedGrade === 'high_2') {
                            return course.name.includes('ثانوي') && course.name.includes('الثانية');
                          } else if (selectedGrade === 'high_3') {
                            return course.name.includes('ثانوي') && course.name.includes('الثالثة');
                          }
                          return true;
                        })
                        .filter(course => {
                          if (!selectedSubject || selectedSubject === 'All') return true;
                          return course.name.includes(selectedSubject);
                        })
                        .map((course) => (
                          <div key={course.id} className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                            {course.image_url && (
                              <div className="mb-3">
                                <img
                                  src={course.image_url}
                                  alt={course.name}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                              </div>
                            )}
                            <div className="flex items-start justify-between mb-3">
                              <h3 className="font-semibold text-foreground">{course.name}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                course.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {course.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {course.description}
                            </p>
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-primary font-semibold">
                                  {course.pricing_info ? course.pricing_info.display_price : `${course.price} DA`}
                                </span>
                                <span className="text-muted-foreground">
                                  {course.available_seats}/{course.max_students} seats
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Type:</span>
                                <span className="font-medium capitalize">
                                  {course.pricing_info ? course.pricing_info.pricing_type : 'session'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Category:</span>
                                <span className={`font-medium px-2 py-1 rounded text-xs ${getCategoryColors(course.category).bg} ${getCategoryColors(course.category).text}`}>
                                  {translateCategory(course.category)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Sections:</span>
                                <span className="font-medium">{courseSections[course.id]?.length || 0}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleManageSections(course)}
                                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                              >
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Sections
                              </button>
                              <button
                                onClick={() => handleEditCourse(course)}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                              >
                                <Edit className="w-3 h-3 inline mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleToggleCourseStatus(course.id)}
                                className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                                  course.is_active
                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                              >
                                {course.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteCourse(course.id)}
                                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                              >
                                <Trash2 className="w-3 h-3 inline mr-1" />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'students-disabled' && (
            <div className="space-y-6">
              {/* Students Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                      <p className="text-2xl font-bold text-foreground">{students.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Enrolled Students</p>
                      <p className="text-2xl font-bold text-green-600">
                        {students.filter(s => s.status.is_enrolled).length}
                      </p>
                    </div>
                    <BookOpen className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Mobile Enabled</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {students.filter(s => s.status.mobile_app_enabled).length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                <div className="bg-card rounded-xl shadow-luxury border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Attendance</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {students.length > 0
                          ? Math.round(students.reduce((sum, s) => sum + s.attendance_stats.attendance_rate, 0) / students.length)
                          : 0}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Students Management */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Students Management</h2>
                    <p className="text-muted-foreground mt-1">Comprehensive student information and management</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => fetchDashboardData()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4 inline mr-2" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground mt-2">Loading students...</p>
                    </div>
                  ) : students.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No students found</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Search and Filter */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        <input
                          type="text"
                          placeholder="Search students..."
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select
                          className="px-3 py-2 border border-border rounded-lg bg-background"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <option value="all">All Students</option>
                          <option value="enrolled">Enrolled Only</option>
                          <option value="mobile-enabled">Mobile Enabled</option>
                          <option value="mobile-disabled">Mobile Disabled</option>
                          <option value="no-parent">No Parent</option>
                        </select>
                      </div>

                      {/* Students List */}
                      <div className="space-y-4">
                        {students
                          .filter(student =>
                            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            student.parent?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            student.parent?.email?.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .filter(student => {
                            switch (filterStatus) {
                              case 'enrolled':
                                return student.status.is_enrolled;
                              case 'mobile-enabled':
                                return student.status.mobile_app_enabled;
                              case 'mobile-disabled':
                                return !student.status.mobile_app_enabled;
                              case 'no-parent':
                                return !student.status.has_parent;
                              default:
                                return true;
                            }
                          })
                          .map((student) => {
                            const isExpanded = expandedStudents.has(student.id);
                            return (
                              <div key={student.id} className="bg-background rounded-lg border border-border overflow-hidden hover:shadow-md transition-all duration-300">
                                {/* Student Header - Always Visible */}
                                <div className="p-4 border-b border-border bg-muted/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <ProfilePictureUploader
                                        currentImageUrl={student.profile_picture_url || null}
                                        size="md"
                                        editable={false}
                                        className="flex-shrink-0"
                                      />
                                      <div>
                                        <h3 className="font-semibold text-foreground text-lg">{student.name}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {student.age ? `${student.age} years old` : 'Age not available'}
                                          {student.created_at && (
                                            <span className="ml-2 text-xs">
                                              • Joined {new Date(student.created_at).toLocaleDateString()}
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      <div className="flex items-center space-x-2">
                                        {student.status.mobile_app_enabled && (
                                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
                                            <Shield className="w-3 h-3 mr-1" />
                                            Mobile
                                          </span>
                                        )}
                                        {student.status.is_enrolled && (
                                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center">
                                            <GraduationCap className="w-3 h-3 mr-1" />
                                            Enrolled
                                          </span>
                                        )}
                                        {student.attendance_stats.attendance_rate >= 80 && (
                                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
                                            <Award className="w-3 h-3 mr-1" />
                                            Excellent
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => {
                                          const newExpanded = new Set(expandedStudents);
                                          if (isExpanded) {
                                            newExpanded.delete(student.id);
                                          } else {
                                            newExpanded.add(student.id);
                                          }
                                          setExpandedStudents(newExpanded);
                                        }}
                                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                                      >
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Stats Bar */}
                                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-border">
                                  <div className="grid grid-cols-4 gap-4 text-center">
                                    <div>
                                      <div className="text-lg font-bold text-blue-600">{student.enrollment_info.active_enrollments}</div>
                                      <div className="text-xs text-muted-foreground">Active Courses</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-green-600">{student.attendance_stats.attendance_rate}%</div>
                                      <div className="text-xs text-muted-foreground">Attendance</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-purple-600">
                                        {student.enrollment_info.courses.length > 0 ? 'Paid' : 'N/A'}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Payment Status</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-bold text-orange-600">
                                        {student.status.has_parent ? 'Yes' : 'No'}
                                      </div>
                                      <div className="text-xs text-muted-foreground">Parent Linked</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Expandable Content */}
                                {isExpanded && (
                                  <div className="divide-y divide-border">
                                    {/* Parent Information Section */}
                                    <div className="p-4">
                                      <h4 className="font-medium text-foreground flex items-center mb-3">
                                        <User className="w-4 h-4 mr-2" />
                                        Parent Information
                                      </h4>
                                      {student.parent ? (
                                        <div className="bg-muted/30 rounded-lg p-3">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="flex items-center space-x-2">
                                              <User className="w-4 h-4 text-muted-foreground" />
                                              <span className="font-medium">{student.parent.name}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <MailIcon className="w-4 h-4 text-muted-foreground" />
                                              <span className="text-sm">{student.email || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <Phone className="w-4 h-4 text-muted-foreground" />
                                              <span className="text-sm">{student.phone || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              {student.parent.mobile_app_enabled ? (
                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                              ) : (
                                                <XCircle className="w-4 h-4 text-red-600" />
                                              )}
                                              <span className="text-sm">
                                                Parent Mobile: {student.parent.mobile_app_enabled ? 'Enabled' : 'Disabled'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                          <div className="flex items-center space-x-2">
                                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                            <span className="text-sm text-yellow-800">No parent assigned</span>
                                            <button className="ml-auto px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">
                                              Assign Parent
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Course Management Section */}
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-foreground flex items-center">
                                          <BookOpen className="w-4 h-4 mr-2" />
                                          Course Enrollments ({student.enrollment_info.active_enrollments})
                                        </h4>
                                        <button className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 flex items-center">
                                          <Plus className="w-3 h-3 mr-1" />
                                          Enroll in Course
                                        </button>
                                      </div>

                                      {student.enrollment_info.courses.length > 0 ? (
                                        <div className="space-y-3">
                                          {student.enrollment_info.courses.map((course, idx) => (
                                            <div key={idx} className="bg-muted/30 rounded-lg p-3 border border-border">
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center space-x-2">
                                                  <GraduationCap className="w-4 h-4 text-blue-600" />
                                                  <span className="font-medium">{course.name}</span>
                                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                    {course.class_name}
                                                  </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                  <button className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                                    View Details
                                                  </button>
                                                  <button className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                                                    Unenroll
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                                <div>
                                                  <span className="font-medium">Schedule:</span> {course.day_of_week} {course.start_time}-{course.end_time}
                                                </div>
                                                <div>
                                                  <span className="font-medium">Enrolled:</span> {course.enrollment_date ? new Date(course.enrollment_date).toLocaleDateString() : 'N/A'}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                                          <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                          <p className="text-sm text-gray-600">No active course enrollments</p>
                                          <button className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90">
                                            Enroll in First Course
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {/* Payment Management Section */}
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-foreground flex items-center">
                                          <CreditCard className="w-4 h-4 mr-2" />
                                          Payment Statistics
                                        </h4>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                          <div className="text-lg font-bold text-green-600">0 DA</div>
                                          <div className="text-xs text-green-700">Paid This Month</div>
                                        </div>
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                                          <div className="text-lg font-bold text-yellow-600">0 DA</div>
                                          <div className="text-xs text-yellow-700">Pending Payments</div>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                          <div className="text-lg font-bold text-red-600">0 DA</div>
                                          <div className="text-xs text-red-700">Overdue Amount</div>
                                        </div>
                                      </div>

                                      <div className="bg-muted/30 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-sm font-medium">Payment History</span>
                                          <button className="text-xs text-primary hover:underline">View All</button>
                                        </div>
                                        <div className="text-center py-4">
                                          <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                                          <p className="text-sm text-muted-foreground">No payment history available</p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Attendance Analytics Section - Simplified */}
                                    <div className="p-4">
                                      <h4 className="font-medium text-foreground flex items-center mb-3">
                                        <Activity className="w-4 h-4 mr-2" />
                                        Attendance Summary
                                      </h4>

                                      <div className="bg-muted/30 rounded-lg p-3">
                                        <div className="text-sm space-y-1">
                                          <div className="flex justify-between">
                                            <span>Present:</span>
                                            <span className="font-medium text-green-600">{student.attendance_stats.present_count}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Absent:</span>
                                            <span className="font-medium text-red-600">{student.attendance_stats.absent_count}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Late:</span>
                                            <span className="font-medium text-yellow-600">{student.attendance_stats.late_count}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Total:</span>
                                            <span className="font-medium">{student.attendance_stats.total_records}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Mobile Access Section */}
                                    <div className="p-4">
                                      <h4 className="font-medium text-foreground flex items-center mb-3">
                                        <Settings className="w-4 h-4 mr-2" />
                                        Mobile Access & Credentials
                                      </h4>

                                      <div className="bg-muted/30 rounded-lg p-3">
                                        {student.mobile_credentials.username ? (
                                          <div className="space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium">Username:</span>
                                                <span className="text-sm bg-muted px-2 py-1 rounded">{student.mobile_credentials.username}</span>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium">Status:</span>
                                                {student.mobile_credentials.app_enabled ? (
                                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded flex items-center">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Enabled
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded flex items-center">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Disabled
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium">Password:</span>
                                                {student.mobile_credentials.password ? (
                                                  <div className="flex items-center space-x-2">
                                                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                                                      {student.mobile_credentials.password}
                                                    </code>
                                                    <button
                                                      onClick={() => {
                                                        navigator.clipboard.writeText(student.mobile_credentials.password || '');
                                                        toast.success('Password copied to clipboard');
                                                      }}
                                                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                                                      title="Copy password"
                                                    >
                                                      📋
                                                    </button>
                                                  </div>
                                                ) : student.mobile_credentials.password_set ? (
                                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded flex items-center">
                                                    <Lock className="w-3 h-3 mr-1" />
                                                    Set (Hidden)
                                                  </span>
                                                ) : (
                                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded flex items-center">
                                                    <Unlock className="w-3 h-3 mr-1" />
                                                    Not Set
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center space-x-2 pt-2 border-t border-border">
                                              <button
                                                onClick={() => handleToggleStudentMobile(student.id)}
                                                className={`px-3 py-1 rounded text-sm flex items-center ${
                                                  student.status.mobile_app_enabled
                                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                              >
                                                {student.status.mobile_app_enabled ? (
                                                  <>
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Disable Mobile
                                                  </>
                                                ) : (
                                                  <>
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Enable Mobile
                                                  </>
                                                )}
                                              </button>
                                              <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center">
                                                <Zap className="w-3 h-3 mr-1" />
                                                Reset Password
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-center py-4">
                                            <Settings className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground mb-3">No mobile credentials set up</p>
                                            <button className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90">
                                              Generate Credentials
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Action Buttons - Always Visible */}
                                <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-muted-foreground">
                                      Last updated: {new Date().toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setSelectedStudentForModal(student);
                                        setShowStudentDetailModal(true);
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      View Details
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Sub-Tab */}
          {activeSubTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Send Bilingual Notifications</h3>
                      <p className="text-muted-foreground mt-1">Send notifications in both Arabic and English to mobile app users</p>
                    </div>
                    <button
                      onClick={() => setShowBilingualForm(!showBilingualForm)}
                      className="px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center"
                    >
                      <Languages className="w-4 h-4 mr-2" />
                      {showBilingualForm ? 'Single Language' : 'Bilingual Mode'}
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {/* Language Toggle Tabs */}
                    {showBilingualForm && (
                      <div className="flex border border-border rounded-lg p-1 bg-muted">
                        <button
                          onClick={() => setActiveLanguageTab('en')}
                          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeLanguageTab === 'en'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          🇺🇸 English
                        </button>
                        <button
                          onClick={() => setActiveLanguageTab('ar')}
                          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeLanguageTab === 'ar'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          🇸🇦 العربية
                        </button>
                      </div>
                    )}

                    {/* Notification Content */}
                    {showBilingualForm ? (
                      <>
                        {/* English Fields */}
                        {activeLanguageTab === 'en' && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                English Title
                              </label>
                              <input
                                type="text"
                                value={notificationTitleEn}
                                onChange={(e) => setNotificationTitleEn(e.target.value)}
                                placeholder="Enter notification title in English"
                                className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2">
                                English Message
                              </label>
                              <textarea
                                value={notificationMessageEn}
                                onChange={(e) => setNotificationMessageEn(e.target.value)}
                                placeholder="Enter notification message in English"
                                rows={4}
                                className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              />
                            </div>
                          </div>
                        )}

                        {/* Arabic Fields */}
                        {activeLanguageTab === 'ar' && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2 text-right">
                                العنوان بالعربية
                              </label>
                              <input
                                type="text"
                                value={notificationTitleAr}
                                onChange={(e) => setNotificationTitleAr(e.target.value)}
                                placeholder="أدخل عنوان الإشعار بالعربية"
                                className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                                dir="rtl"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-foreground mb-2 text-right">
                                الرسالة بالعربية
                              </label>
                              <textarea
                                value={notificationMessageAr}
                                onChange={(e) => setNotificationMessageAr(e.target.value)}
                                placeholder="أدخل نص الإشعار بالعربية"
                                rows={4}
                                className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-right"
                                dir="rtl"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // Single Language Mode (Legacy)
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Notification Title
                          </label>
                          <input
                            type="text"
                            value={notificationTitle}
                            onChange={(e) => setNotificationTitle(e.target.value)}
                            placeholder="Enter notification title"
                            className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Notification Message
                          </label>
                          <textarea
                            value={notificationMessage}
                            onChange={(e) => setNotificationMessage(e.target.value)}
                            placeholder="Enter notification message"
                            rows={4}
                            className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {/* Target Audience & Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Target Audience
                        </label>
                        <select
                          value={notificationTarget}
                          onChange={(e) => setNotificationTarget(e.target.value)}
                          className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="all">All Users</option>
                          <option value="parents">Parents Only</option>
                          <option value="students">Students Only</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Notification Type
                        </label>
                        <select
                          value={notificationType}
                          onChange={(e) => setNotificationType(e.target.value)}
                          className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="info">Information</option>
                          <option value="success">Success</option>
                          <option value="warning">Warning</option>
                          <option value="error">Error</option>
                        </select>
                      </div>
                    </div>

                    {/* Preview Section */}
                    {showBilingualForm && (notificationTitleEn || notificationTitleAr || notificationMessageEn || notificationMessageAr) && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-foreground mb-3">Preview</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(notificationTitleEn || notificationMessageEn) && (
                            <div className="bg-background rounded-lg p-3 border border-border">
                              <div className="flex items-center mb-2">
                                <span className="text-xs font-medium text-primary">🇺🇸 English</span>
                              </div>
                              {notificationTitleEn && (
                                <h5 className="font-medium text-foreground">{notificationTitleEn}</h5>
                              )}
                              {notificationMessageEn && (
                                <p className="text-sm text-muted-foreground mt-1">{notificationMessageEn}</p>
                              )}
                            </div>
                          )}
                          {(notificationTitleAr || notificationMessageAr) && (
                            <div className="bg-background rounded-lg p-3 border border-border">
                              <div className="flex items-center justify-end mb-2">
                                <span className="text-xs font-medium text-primary">🇸🇦 العربية</span>
                              </div>
                              {notificationTitleAr && (
                                <h5 className="font-medium text-foreground text-right" dir="rtl">{notificationTitleAr}</h5>
                              )}
                              {notificationMessageAr && (
                                <p className="text-sm text-muted-foreground mt-1 text-right" dir="rtl">{notificationMessageAr}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleSendNotification}
                      disabled={
                        showBilingualForm 
                          ? (!notificationTitleEn.trim() && !notificationTitleAr.trim()) || 
                            (!notificationMessageEn.trim() && !notificationMessageAr.trim()) || 
                            sendingNotification
                          : !notificationTitle.trim() || !notificationMessage.trim() || sendingNotification
                      }
                      className="w-full px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {sendingNotification ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          {showBilingualForm ? 'Send Bilingual Notification' : 'Send Notification'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Notifications */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">Recent Notifications</h3>
                  <p className="text-muted-foreground mt-1">View recently sent notifications</p>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground mt-2">Loading notifications...</p>
                    </div>
                  ) : recentNotifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No notifications sent yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentNotifications.map((notification) => (
                        <div key={notification.id} className="border border-border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Check if it's a bilingual notification */}
                              {(notification.title_en || notification.title_ar || notification.message_en || notification.message_ar) ? (
                                // Bilingual notification display
                                <div className="space-y-4">
                                  {(notification.title_en || notification.message_en) && (
                                    <div className="border-l-4 border-blue-500 pl-3">
                                      <div className="flex items-center mb-1">
                                        <span className="text-xs font-medium text-blue-600">🇺🇸 English</span>
                                      </div>
                                      {notification.title_en && (
                                        <h4 className="font-medium text-foreground">{notification.title_en}</h4>
                                      )}
                                      {notification.message_en && (
                                        <p className="text-muted-foreground mt-1">{notification.message_en}</p>
                                      )}
                                    </div>
                                  )}
                                  {(notification.title_ar || notification.message_ar) && (
                                    <div className="border-r-4 border-green-500 pr-3">
                                      <div className="flex items-center justify-end mb-1">
                                        <span className="text-xs font-medium text-green-600">🇸🇦 العربية</span>
                                      </div>
                                      {notification.title_ar && (
                                        <h4 className="font-medium text-foreground text-right" dir="rtl">{notification.title_ar}</h4>
                                      )}
                                      {notification.message_ar && (
                                        <p className="text-muted-foreground mt-1 text-right" dir="rtl">{notification.message_ar}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // Legacy single-language notification display
                                <div>
                                  <h4 className="font-medium text-foreground">{notification.title}</h4>
                                  <p className="text-muted-foreground mt-1">{notification.message}</p>
                                </div>
                              )}
                              
                              <div className="flex items-center mt-3 text-sm text-muted-foreground">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  notification.type === 'success' ? 'bg-green-100 text-green-800' :
                                  notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                  notification.type === 'error' ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {notification.type}
                                </span>
                                <span className="ml-2">
                                  {new Date(notification.created_at).toLocaleString()}
                                </span>
                                {(notification.title_en || notification.title_ar || notification.message_en || notification.message_ar) && (
                                  <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                    Bilingual
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content-management' && (
            <div className="space-y-6">
              {/* Content Management Header */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold text-foreground">Content & Support Management</h2>
                  <p className="text-muted-foreground mt-1">Handle contact messages and support inquiries</p>
                </div>

                {/* Internal Navigation Tabs */}
                <div className="px-6 py-4">
                  <nav className="flex space-x-1 bg-muted/50 rounded-lg p-1">
                    {[
                      { id: 'contact', name: 'Contact', icon: Mail },
                      { id: 'reports', name: 'Reports', icon: BarChart3 }
                    ].map((subTab) => {
                      const Icon = subTab.icon;
                      return (
                        <button
                          key={subTab.id}
                          onClick={() => setActiveContentSubTab(subTab.id)}
                          className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            activeContentSubTab === subTab.id
                              ? 'bg-gradient-gold text-secondary shadow-luxury'
                              : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {subTab.name}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {/* Contact Sub-Tab */}
              {activeContentSubTab === 'contact' && (
                <div className="bg-card rounded-xl shadow-luxury border border-border">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Contact Messages</h3>
                    <p className="text-muted-foreground mt-1">View and manage contact form submissions</p>
                  </div>
                  <div className="p-6">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-muted-foreground mt-2">Loading messages...</p>
                      </div>
                    ) : contactMessages.length === 0 ? (
                      <div className="text-center py-8">
                        <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No contact messages</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contactMessages.map((message) => (
                          <div key={message.id} className="bg-background rounded-lg p-4 border border-border">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="font-semibold text-foreground">
                                    {message.user_name || message.name || 'Anonymous'}
                                  </h3>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    message.status === 'open' || message.status === 'unread'
                                      ? 'bg-blue-100 text-blue-800'
                                      : message.status === 'responded'
                                      ? 'bg-green-100 text-green-800'
                                      : message.status === 'closed'
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {message.status === 'open' ? 'unread' : message.status}
                                  </span>
                                  {message.user_id && (
                                    <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                      Registered User
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  {message.user_email || message.email || 'No email provided'}
                                </p>
                                <p className="font-medium text-foreground mb-2">{message.subject}</p>
                                <p className="text-sm text-muted-foreground line-clamp-3">{message.message}</p>
                                {message.admin_response && (
                                  <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-400 rounded-r">
                                    <p className="text-sm font-medium text-green-800">Admin Reply:</p>
                                    <p className="text-sm text-green-700 mt-1">{message.admin_response}</p>
                                    <p className="text-xs text-green-600 mt-1">
                                      Replied on {new Date(message.admin_response_at!).toLocaleDateString()} at {new Date(message.admin_response_at!).toLocaleTimeString()}
                                    </p>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">
                                  {new Date(message.created_at).toLocaleDateString()} at {new Date(message.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                              <div className="flex space-x-2 ml-4">
                                <button
                                  onClick={() => handleViewContactMessage(message)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                  <Eye className="w-3 h-3 inline mr-1" />
                                  View
                                </button>
                                <button
                                  onClick={() => handleReplyToContactMessage(message)}
                                  className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reports Sub-Tab */}
              {activeContentSubTab === 'reports' && (
                <div className="bg-card rounded-xl shadow-luxury border border-border">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Reports & Analytics</h3>
                    <p className="text-muted-foreground mt-1">View detailed analytics and generate reports</p>
                  </div>
                  <div className="p-6">
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Reports and analytics coming soon</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contact-disabled' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">Contact Messages</h2>
                <p className="text-muted-foreground mt-1">View and manage contact form submissions</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Loading messages...</p>
                  </div>
                ) : contactMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No contact messages</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contactMessages.map((message) => (
                      <div key={message.id} className="bg-background rounded-lg p-4 border border-border">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-foreground">{message.name}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                message.status === 'unread'
                                  ? 'bg-blue-100 text-blue-800'
                                  : message.status === 'read'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {message.status}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">{message.email}</p>
                            <p className="font-medium text-foreground mb-2">{message.subject}</p>
                            <p className="text-sm text-muted-foreground line-clamp-3">{message.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(message.created_at).toLocaleDateString()} at {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                              <Eye className="w-3 h-3 inline mr-1" />
                              View
                            </button>
                            <button className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'qr-codes' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">QR Code Management</h2>
                <p className="text-muted-foreground mt-1">Generate and manage QR codes for attendance tracking</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Loading QR codes...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {courses.map((course) => (
                        <div key={course.id} className="bg-background rounded-lg p-4 border border-border">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-foreground">{course.name}</h3>
                            {qrCodes[course.id] ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <QrCode className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{course.description}</p>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">
                              {course.available_seats} seats available
                            </span>
                          </div>
                          {qrCodes[course.id] ? (
                            <div className="text-center">
                              <div className="bg-white p-2 rounded-lg inline-block mb-2">
                                <img
                                  src={`data:image/png;base64,${qrCodes[course.id]}`}
                                  alt="QR Code"
                                  className="w-24 h-24"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">Generated QR Code</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGenerateQR(course.id)}
                              disabled={generatingQRs.has(course.id)}
                              className="w-full px-3 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all text-sm disabled:opacity-50"
                            >
                              {generatingQRs.has(course.id) ? 'Generating...' : 'Generate QR'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {courses.length === 0 && (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No courses available for QR code generation</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'kindergarten' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">🧸 Kindergarten Management</h2>
                  <p className="text-muted-foreground mt-1">Manage kindergarten courses, classes, and subscriptions</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchDashboardData()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 inline mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  {/* Kindergarten Stats Cards */}
                  <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-pink-600 dark:text-pink-400">Kindergarten Courses</p>
                        <p className="text-2xl font-bold text-pink-700 dark:text-pink-300">
                          {courses.filter(c => c.category === 'روضة').length}
                        </p>
                      </div>
                      <GraduationCap className="w-8 h-8 text-pink-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Active Classes</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {allSections.filter(s => s.course?.category === 'روضة' && s.is_active).length}
                        </p>
                      </div>
                      <BookOpen className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">Enrolled Students</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {studentsTableData.filter(s =>
                            s.enrollment_info?.courses?.some(c => c.category === 'روضة')
                          ).length}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Monthly Revenue</p>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                          {courses.filter(c => c.category === 'روضة').reduce((sum, c) => sum + (c.monthly_price || 0), 0)} DA
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-orange-500" />
                    </div>
                  </div>
                </div>

                {/* Kindergarten Courses Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Kindergarten Courses</h3>
                  {courses.filter(c => c.category === 'روضة').length === 0 ? (
                    <div className="text-center py-8 bg-muted/50 rounded-lg">
                      <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No kindergarten courses found</p>
                      <button
                        onClick={() => setShowCourseModal(true)}
                        className="px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add First Kindergarten Course
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {courses.filter(c => c.category === 'روضة').map(course => (
                        <div key={course.id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground">{course.name}</h4>
                              <p className="text-sm text-muted-foreground">Category: {course.category}</p>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleEditCourse(course)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit Course"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Monthly Price:</span>
                              <span className="font-medium">{course.monthly_price} DA</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Max Students:</span>
                              <span className="font-medium">{course.max_students}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Status:</span>
                              <span className={`font-medium ${course.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                {course.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              Classes: {allSections.filter(s => s.course_id === course.id).length}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Kindergarten Classes Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Kindergarten Classes</h3>
                  {allSections.filter(s => s.course?.category === 'روضة').length === 0 ? (
                    <div className="text-center py-8 bg-muted/50 rounded-lg">
                      <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No kindergarten classes found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium text-muted-foreground">Class Name</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Course</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Schedule</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Students</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allSections.filter(s => s.course?.category === 'روضة').map(section => (
                            <tr key={section.id} className="border-b border-border hover:bg-muted/50">
                              <td className="p-3 font-medium">{section.name}</td>
                              <td className="p-3">{section.course?.name}</td>
                              <td className="p-3">
                                {section.multi_day_schedule ? (
                                  <span className="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                    Multi-day
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Single day</span>
                                )}
                              </td>
                              <td className="p-3 text-sm">
                                {section.start_time && section.end_time ?
                                  `${section.start_time} - ${section.end_time}` :
                                  'Not set'
                                }
                              </td>
                              <td className="p-3">
                                <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm">
                                  {section.enrolled_students || 0}/{section.max_students || 0}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  section.is_active ?
                                    'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                                    'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                }`}>
                                  {section.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="p-3">
                                <button
                                  onClick={() => handleEditSection(section)}
                                  className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-1 rounded"
                                  title="Edit Class"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Kindergarten Enrollments Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">🧸 Kindergarten Enrollments</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedKindergartenView('all')}
                        className={`px-3 py-1 rounded text-sm ${selectedKindergartenView === 'all' ? 'bg-pink-500 text-white' : 'bg-muted text-muted-foreground'}`}
                      >
                        All ({studentsTableData.filter(s => s.enrollments?.some(e => e.is_kindergarten === true)).length})
                      </button>
                      <button
                        onClick={() => setSelectedKindergartenView('active')}
                        className={`px-3 py-1 rounded text-sm ${selectedKindergartenView === 'active' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => setSelectedKindergartenView('pending')}
                        className={`px-3 py-1 rounded text-sm ${selectedKindergartenView === 'pending' ? 'bg-yellow-500 text-white' : 'bg-muted text-muted-foreground'}`}
                      >
                        Pending Payment
                      </button>
                      <button
                        onClick={() => setSelectedKindergartenView('expired')}
                        className={`px-3 py-1 rounded text-sm ${selectedKindergartenView === 'expired' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}
                      >
                        Expired
                      </button>
                    </div>
                  </div>

                  {studentsTableData.filter(s =>
                    s.enrollments?.some(e => e.is_kindergarten === true)
                  ).length === 0 ? (
                    <div className="text-center py-8 bg-muted/50 rounded-lg">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No kindergarten enrollments found</p>
                      <p className="text-sm text-muted-foreground mt-2">Looking for enrollments with is_kindergarten_subscription=1</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {studentsTableData.filter(s => {
                        const hasKindergarten = s.enrollments?.some(e => e.is_kindergarten === true);
                        if (!hasKindergarten) return false;
                        
                        if (selectedKindergartenView === 'all') return true;
                        
                        const kindergartenEnrollments = s.enrollments?.filter(e => e.is_kindergarten === true) || [];
                        if (selectedKindergartenView === 'active') {
                          return kindergartenEnrollments.some(e => e.subscription_status === 'active');
                        } else if (selectedKindergartenView === 'pending') {
                          return kindergartenEnrollments.some(e => e.subscription_status === 'pending');
                        } else if (selectedKindergartenView === 'expired') {
                          return kindergartenEnrollments.some(e => e.subscription_status === 'expired');
                        }
                        return false;
                      }).map(student => {
                        const kindergartenEnrollments = student.enrollments?.filter(e => e.is_kindergarten === true) || [];
                        
                        return kindergartenEnrollments.map((enrollment, idx) => {
                          const isPaymentDue = enrollment.next_subscription_date && 
                            new Date(enrollment.next_subscription_date) <= new Date();
                          const daysUntilPayment = enrollment.next_subscription_date ? 
                            Math.ceil((new Date(enrollment.next_subscription_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

                          return (
                            <div key={`${student.id}-${enrollment.enrollment_id}-${idx}`} 
                              className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/10 dark:to-purple-950/10 border border-pink-200 dark:border-pink-800 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h4 className="font-semibold text-foreground text-lg">
                                      🧸 {student.full_name || student.name || 'Unknown Student'}
                                    </h4>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      enrollment.subscription_status === 'active' ?
                                        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                                        enrollment.subscription_status === 'pending' ?
                                        'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                    }`}>
                                      {enrollment.subscription_status || 'Unknown'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Parent: {student.parent?.name || 'N/A'} • Phone: {student.phone_number || 'N/A'}
                                  </p>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedKindergartenEnrollment({
                                        student,
                                        enrollment,
                                        enrollmentId: enrollment.enrollment_id
                                      });
                                      setShowKindergartenDetailModal(true);
                                    }}
                                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                                    title="View Details"
                                  >
                                    <Eye className="w-4 h-4 inline mr-1" />
                                    Details
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Course</p>
                                  <p className="font-medium">{enrollment.course_name || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Class</p>
                                  <p className="font-medium">{enrollment.section_name || 'Not assigned'}</p>
                                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                                    enrollment.section_id >= 1 && enrollment.section_id <= 6 ?
                                      'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200' :
                                      'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                                  }`}>
                                    ID: {enrollment.section_id}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Monthly Amount</p>
                                  <p className="font-medium text-lg">
                                    {enrollment.subscription_amount ? `${enrollment.subscription_amount} DA` : 'Not set'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Next Payment</p>
                                  <p className={`font-medium ${isPaymentDue ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                                    {enrollment.next_subscription_date ?
                                      new Date(enrollment.next_subscription_date).toLocaleDateString() :
                                      'Not set'
                                    }
                                  </p>
                                  {daysUntilPayment !== null && (
                                    <p className={`text-xs mt-1 ${
                                      daysUntilPayment < 0 ? 'text-red-600 dark:text-red-400' :
                                      daysUntilPayment <= 7 ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-green-600 dark:text-green-400'
                                    }`}>
                                      {daysUntilPayment < 0 ? 
                                        `${Math.abs(daysUntilPayment)} days overdue` :
                                        daysUntilPayment === 0 ?
                                        'Due today!' :
                                        `${daysUntilPayment} days left`
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-pink-200 dark:border-pink-800 flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  Attendance: {enrollment.sessions_attended || 0} / {enrollment.total_sessions || 0} sessions 
                                  ({enrollment.attendance_rate || 0}%)
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Enrolled: {enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      }).flat()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule-control' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">Schedule Control</h2>
                <p className="text-muted-foreground mt-1">Manage course schedules and section timings with visual drag-and-drop</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Loading schedules...</p>
                  </div>
                ) : allSections.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No sections available for scheduling</p>
                    <p className="text-sm text-muted-foreground mt-2">Create courses and sections first to use the visual scheduler</p>
                  </div>
                ) : (
                  <EnhancedScheduler
                    sections={allSections.length > 0 ? allSections : []}
                    onScheduleUpdate={(sectionId: number, schedule: string) => {
                      // Convert schedule string to timeSlot format for handleScheduleUpdate
                      if (schedule === 'TBD') {
                        handleScheduleUpdate(sectionId, { day: 'TBD', time: '00:00', duration: 60 });
                      } else {
                        // Parse schedule string like "Sunday 09:00-12:00"
                        const parts = schedule.split(' ');
                        if (parts.length >= 2) {
                          const day = parts[0];
                          const timeRange = parts.slice(1).join(' ');
                          const [startTime, endTime] = timeRange.split('-');

                          if (startTime && endTime) {
                            // Calculate actual duration in minutes
                            const start = new Date(`2000-01-01T${startTime}`);
                            const end = new Date(`2000-01-01T${endTime}`);
                            const duration = (end.getTime() - start.getTime()) / (1000 * 60); // duration in minutes

                            handleScheduleUpdate(sectionId, { day, time: startTime, duration });
                          }
                        }
                      }
                    }}
                    onSectionUpdate={handleSectionUpdate}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Attendance Sub-Navigation */}
              <div className="border-b border-border">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveAttendanceSubTab('overview')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeAttendanceSubTab === 'overview'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                    }`}
                  >
                    Overview & Analytics
                  </button>
                  <button
                    onClick={() => setActiveAttendanceSubTab('marking')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeAttendanceSubTab === 'marking'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                    }`}
                  >
                    Mark Attendance
                  </button>
                </nav>
              </div>

              {/* Attendance Content */}
              {activeAttendanceSubTab === 'overview' && (
                <AttendanceOverview />
              )}

              {activeAttendanceSubTab === 'marking' && (
                <AttendanceSystem
                  users={users}
                  scannedBarcode={scannedBarcode}
                  setScannedBarcode={setScannedBarcode}
                  attendanceData={attendanceData}
                  setAttendanceData={setAttendanceData}
                  showPaymentDialog={showPaymentDialog}
                  setShowPaymentDialog={setShowPaymentDialog}
                  paymentAmount={paymentAmount}
                  setPaymentAmount={setPaymentAmount}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  indebtedUsers={indebtedUsers}
                  setIndebtedUsers={setIndebtedUsers}
                  showIndebtedUsers={showIndebtedUsers}
                  setShowIndebtedUsers={setShowIndebtedUsers}
                  selectedIndebtedUser={selectedIndebtedUser}
                  setSelectedIndebtedUser={setSelectedIndebtedUser}
                  showClearDebtDialog={showClearDebtDialog}
                  setShowClearDebtDialog={setShowClearDebtDialog}
                  clearDebtAmount={clearDebtAmount}
                  setClearDebtAmount={setClearDebtAmount}
                  attendanceSearchTerm={attendanceSearchTerm}
                  setAttendanceSearchTerm={setAttendanceSearchTerm}
                  attendanceFilter={attendanceFilter}
                  setAttendanceFilter={setAttendanceFilter}
                  loading={loading}
                  setLoading={setLoading}
                  handleScanBarcode={handleScanBarcode}
                  handleConfirmPayment={handleConfirmPayment}
                  handleFetchIndebtedUsers={handleFetchIndebtedUsers}
                  handleClearDebt={handleClearDebt}
                  showAttendanceModal={showAttendanceModal}
                  setShowAttendanceModal={setShowAttendanceModal}
                  selectedStudentAttendance={selectedStudentAttendance}
                  setSelectedStudentAttendance={setSelectedStudentAttendance}
                  showTimeRestrictionModal={showTimeRestrictionModal}
                  setShowTimeRestrictionModal={setShowTimeRestrictionModal}
                  timeRestrictionData={timeRestrictionData}
                  setTimeRestrictionData={setTimeRestrictionData}
                  pendingAttendanceAction={pendingAttendanceAction}
                  setPendingAttendanceAction={setPendingAttendanceAction}
                  handleForceAttendanceAction={handleForceAttendanceAction}
                  markingAttendance={markingAttendance}
                  setMarkingAttendance={setMarkingAttendance}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Course Creation Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  {editingCourse ? 'Edit Course' : 'Create New Course'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCourseModal(false);
                    setEditingCourse(null);
                    setCourseForm({
                      name: '',
                      description: '',
                      price: '',
                      max_students: '',
                      image: null
                    });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={editingCourse ? handleUpdateCourse : handleCreateCourse} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Course Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={courseForm.name}
                  onChange={handleCourseFormChange}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={courseForm.description}
                  onChange={handleCourseFormChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={courseForm.price}
                    onChange={handleCourseFormChange}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Max Students
                  </label>
                  <input
                    type="number"
                    name="max_students"
                    value={courseForm.max_students}
                    onChange={handleCourseFormChange}
                    min="1"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Course Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCourseForm({
                    ...courseForm,
                    image: e.target.files ? e.target.files[0] : null
                  })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300 text-sm md:text-base"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Sections Modal */}
      {showSectionModal && selectedCourseForSections && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  Manage Sections - {selectedCourseForSections.name}
                </h2>
                <p className="text-muted-foreground mt-1">Create and manage course sections</p>
              </div>
              <button
                onClick={() => setShowSectionModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6">
              {/* Create Section Form */}
              <div className="bg-background rounded-lg p-4 mb-6 border border-border">
                <h3 className="text-md font-semibold text-foreground mb-4">Create New Section</h3>
                <form onSubmit={handleCreateSection} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Section Name
                    </label>
                    <input
                      type="text"
                      name="section_name"
                      value={sectionForm.section_name}
                      onChange={handleSectionFormChange}
                      placeholder="e.g., Section 1 - Sunday"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Schedule
                    </label>
                    <input
                      type="text"
                      name="schedule"
                      value={sectionForm.schedule}
                      onChange={handleSectionFormChange}
                      placeholder="e.g., Sunday 9:00 AM - 12:00 PM"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={sectionForm.start_date}
                      onChange={handleSectionFormChange}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={sectionForm.end_date}
                      onChange={handleSectionFormChange}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Max Students
                    </label>
                    <input
                      type="number"
                      name="max_students"
                      value={sectionForm.max_students}
                      onChange={handleSectionFormChange}
                      placeholder="30"
                      min="1"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={sectionForm.is_active}
                      onChange={handleSectionFormChange}
                      className="mr-2"
                    />
                    <label className="text-sm font-medium text-foreground">Active</label>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300"
                    >
                      Create Section
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Sections */}
              <div>
                <h3 className="text-md font-semibold text-foreground mb-4">Existing Sections</h3>
                {courseSections[selectedCourseForSections.id]?.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No sections created yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {courseSections[selectedCourseForSections.id]?.map((section) => (
                      <div key={section.id} className="bg-background rounded-lg p-4 border border-border">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-foreground">{selectedCourseForSections.name} - {section.section_name}</h4>
                            <p className="text-sm text-muted-foreground">{section.schedule}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              section.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {section.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => handleDeleteSection(section.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {section.current_students}/{section.max_students} enrolled
                          </span>
                          {section.start_date && (
                            <span className="text-muted-foreground">
                              Starts: {new Date(section.start_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const studentData = {
                name: formData.get('name'),
                parent_name: formData.get('parent_name'),
                parent_email: formData.get('parent_email'),
                date_of_birth: formData.get('date_of_birth'),
                mobile_app_enabled: formData.get('mobile_app_enabled') === 'on'
              };
              if (editingStudent) {
                handleUpdateStudent(editingStudent.id, studentData);
              } else {
                handleCreateStudent(studentData);
              }
            }} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Student Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingStudent?.name || ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Parent Name
                </label>
                <input
                  type="text"
                  name="parent_name"
                  defaultValue={editingStudent?.parent?.name || ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Parent Email
                </label>
                <input
                  type="email"
                  name="parent_email"
                  defaultValue={editingStudent?.parent?.email || ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  defaultValue={editingStudent?.date_of_birth ? new Date(editingStudent.date_of_birth).toISOString().split('T')[0] : ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="mobile_app_enabled"
                  id="mobile_app_enabled"
                  defaultChecked={editingStudent?.parent?.mobile_app_enabled || false}
                  className="mr-2"
                />
                <label htmlFor="mobile_app_enabled" className="text-sm font-medium text-foreground">
                  Enable Mobile App Access
                </label>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300 text-sm md:text-base"
                >
                  {editingStudent ? 'Update Student' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const userData = {
                full_name: formData.get('full_name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                role: formData.get('role'),
                email_verified: formData.get('email_verified') === 'on'
              };
              if (editingUser) {
                handleUpdateUser(editingUser.id, userData);
              } else {
                handleCreateUser(userData);
              }
            }} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={editingUser?.full_name || ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingUser?.email || ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingUser?.phone || ''}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue={editingUser?.role || 'user'}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
                  required
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="email_verified"
                  id="email_verified"
                  defaultChecked={editingUser?.email_verified || false}
                  className="mr-2"
                />
                <label htmlFor="email_verified" className="text-sm font-medium text-foreground">
                  Email Verified
                </label>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300 text-sm md:text-base"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Selection Modal */}
      {sectionSelectionData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold text-foreground">
                  Select Section for Registration
                </h2>
                <button
                  type="button"
                  onClick={() => setSectionSelectionData(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Choose a section for this student's course registration. Only sections with available seats are shown.
              </p>
            </div>
            <div className="p-4 md:p-6">
              <div className="space-y-4">
                {sectionSelectionData.availableSections.map((section) => (
                  <div
                    key={section.id}
                    className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => {
                      handleApproveRegistration(sectionSelectionData.registrationId, section.id);
                      setSectionSelectionData(null);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{section.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        section.available_seats > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {section.available_seats} seats available
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{section.schedule}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Max Students: {section.available_seats + (section.available_seats > 0 ? 1 : 0)}</span>
                      <span className="text-primary font-medium">Click to select</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSectionSelectionData(null)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {showStudentDetailModal && selectedStudentForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold text-2xl">
                    {selectedStudentForModal.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedStudentForModal.name}</h2>
                  <p className="text-muted-foreground">
                    {selectedStudentForModal.age ? `${selectedStudentForModal.age} years old` : 'Age not available'}
                    {selectedStudentForModal.created_at && (
                      <span className="ml-2 text-sm">
                        • Student since {new Date(selectedStudentForModal.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowStudentDetailModal(false);
                  setSelectedStudentForModal(null);
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 text-center">
                  <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-800">{selectedStudentForModal?.enrollment_info?.active_enrollments || selectedStudentForModal?.enrollment_info?.courses?.length || 0}</div>
                  <div className="text-sm text-blue-600">Active Courses</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-800">{selectedStudentForModal?.attendance_stats?.attendance_rate || 0}%</div>
                  <div className="text-sm text-green-600">Attendance Rate</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 text-center">
                  <CreditCard className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-800">{selectedStudentForModal?.enrollment_info?.total_debt || 0} DA</div>
                  <div className="text-sm text-purple-600">Total Debt</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4 text-center">
                  <Activity className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-orange-800">{selectedStudentForModal?.attendance_stats?.total_records || 0}</div>
                  <div className="text-sm text-orange-600">Total Sessions</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Student Information */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center mb-4">
                      <User className="w-5 h-5 mr-2" />
                      Student Information
                    </h3>
                    <div className="space-y-4">
                      {/* Student Profile */}
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">
                            {selectedStudentForModal.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-lg">{selectedStudentForModal.name}</p>
                          <p className="text-sm text-blue-600 font-medium">Student</p>
                        </div>
                      </div>

                      {/* Student Contact Information */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          Student Contact Details
                        </h4>
                        <div className="space-y-2">
                          {selectedStudentForModal.email ? (
                            <div className="flex items-center space-x-3 p-2 bg-white/60 rounded-md">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <MailIcon className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-xs text-blue-600 font-medium">Email</p>
                                <p className="text-sm text-gray-800 font-medium">{selectedStudentForModal.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <MailIcon className="w-4 h-4 text-gray-400" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Email</p>
                                <p className="text-sm text-gray-400 italic">Not provided</p>
                              </div>
                            </div>
                          )}
                          
                          {selectedStudentForModal.phone ? (
                            <div className="flex items-center space-x-3 p-2 bg-white/60 rounded-md">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Phone className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <p className="text-xs text-green-600 font-medium">Phone</p>
                                <p className="text-sm text-gray-800 font-medium">{selectedStudentForModal.phone}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-md">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <Phone className="w-4 h-4 text-gray-400" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Phone</p>
                                <p className="text-sm text-gray-400 italic">Not provided</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Age and Registration Info */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-purple-800">
                            {selectedStudentForModal.age || 'N/A'}
                          </div>
                          <div className="text-xs text-purple-600 font-medium">Years Old</div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-3 text-center">
                          <div className="text-sm font-bold text-emerald-800">
                            {selectedStudentForModal.created_at ? 
                              new Date(selectedStudentForModal.created_at).toLocaleDateString() : 'N/A'
                            }
                          </div>
                          <div className="text-xs text-emerald-600 font-medium">Registered</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parent Information */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center mb-4">
                      <User className="w-5 h-5 mr-2" />
                      Parent Information
                    </h3>
                    <div className="space-y-4">
                      {/* Parent Profile */}
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">
                            {selectedStudentForModal?.parent?.name?.charAt(0).toUpperCase() || 'P'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-lg">
                            {selectedStudentForModal?.parent?.name || 'No Parent Assigned'}
                          </p>
                          <p className="text-sm text-purple-600 font-medium">Parent/Guardian</p>
                        </div>
                      </div>

                      {/* Parent Contact Information */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center">
                          <Phone className="w-4 h-4 mr-2" />
                          Parent Contact Details
                        </h4>
                        <div className="space-y-2">
                          {selectedStudentForModal.parent?.email ? (
                            <div className="flex items-center space-x-3 p-2 bg-white/60 rounded-md">
                              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <MailIcon className="w-4 h-4 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-xs text-purple-600 font-medium">Email</p>
                                <p className="text-sm text-gray-800 font-medium">{selectedStudentForModal.parent.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <MailIcon className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-xs text-amber-600 font-medium">Email</p>
                                <p className="text-sm text-amber-700 italic">Contact information not entered yet</p>
                              </div>
                            </div>
                          )}
                          
                          {selectedStudentForModal.parent?.phone ? (
                            <div className="flex items-center space-x-3 p-2 bg-white/60 rounded-md">
                              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                                <Phone className="w-4 h-4 text-pink-600" />
                              </div>
                              <div>
                                <p className="text-xs text-pink-600 font-medium">Phone</p>
                                <p className="text-sm text-gray-800 font-medium">{selectedStudentForModal.parent.phone}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <Phone className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-xs text-amber-600 font-medium">Phone</p>
                                <p className="text-sm text-amber-700 italic">Contact information not entered yet</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parent Status Indicators */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-3 text-center">
                          <div className="text-sm font-bold text-indigo-800">
                            {selectedStudentForModal.parent?.mobile_app_enabled ? 'Enabled' : 'Disabled'}
                          </div>
                          <div className="text-xs text-indigo-600 font-medium">Mobile App</div>
                        </div>
                        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3 text-center">
                          <div className="text-sm font-bold text-teal-800">
                            {selectedStudentForModal.parent?.user_email_verified ? 'Verified' : 'Pending'}
                          </div>
                          <div className="text-xs text-teal-600 font-medium">Email Status</div>
                        </div>
                      </div>

                      {/* Assign Parent Button if no parent */}
                      {!selectedStudentForModal.parent && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                          <p className="text-amber-700 font-medium mb-3">No parent information available</p>
                          <button
                            onClick={() => handleAssignParent(selectedStudentForModal.id)}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            Assign Parent
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Course Enrollments */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center">
                        <BookOpen className="w-5 h-5 mr-2" />
                        Course Enrollments
                      </h3>
                      <button
                        onClick={() => handleEnrollStudent(selectedStudentForModal.id)}
                        className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Enroll
                      </button>
                    </div>

                    {selectedStudentForModal?.enrollment_info?.courses?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedStudentForModal.enrollment_info.courses.map((course, idx) => (
                          <div key={idx} className="border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <GraduationCap className="w-4 h-4 text-blue-600" />
                                <span className="font-medium">{course.name}</span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {course.class_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleViewCourseDetails(course.id)}
                                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                  title="View Course Details"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleChangeSectionStudent(selectedStudentForModal.id, course.enrollment_id || course.id)}
                                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                  title="Change Section"
                                >
                                  Change
                                </button>
                                <button
                                  onClick={() => handleUnenrollStudent(selectedStudentForModal.id, course.enrollment_id || course.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                  title="Unenroll Student"
                                >
                                  Unenroll
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>📅 {course.day_of_week} {course.start_time}-{course.end_time}</div>
                              <div>🎓 Enrolled: {course.enrollment_date ? new Date(course.enrollment_date).toLocaleDateString() : 'N/A'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground mb-3">No course enrollments</p>
                        <button
                          onClick={() => handleEnrollStudent(selectedStudentForModal.id)}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                        >
                          Enroll in Course
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Attendance & Payment Quickview */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Activity className="w-5 h-5 mr-2" />
                        Attendance & Payment Overview
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewStudentAttendance(selectedStudentForModal.id)}
                          className="text-xs text-primary hover:underline flex items-center"
                        >
                          <BarChart3 className="w-3 h-3 mr-1" />
                          Attendance
                        </button>
                        <button
                          onClick={() => handleViewPaymentHistory(selectedStudentForModal.id)}
                          className="text-xs text-primary hover:underline flex items-center"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Payments
                        </button>
                      </div>
                    </h3>

                    <div className="space-y-4">
                      {/* Combined Attendance & Payment Quickview */}
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-blue-800">Attendance & Payment Summary</span>
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <CreditCard className="w-4 h-4 text-green-600" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Attendance Side */}
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-700 mb-1">
                              {selectedStudentForModal?.attendance_stats?.attendance_rate || 0}%
                            </div>
                            <div className="text-xs text-blue-600 mb-2">Attendance Rate</div>
                            <div className="flex justify-center space-x-3 text-xs">
                              <div className="text-center">
                                <div className="font-bold text-green-600">{selectedStudentForModal?.attendance_stats?.present_count || 0}</div>
                                <div className="text-green-600">Present</div>
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-red-600">{selectedStudentForModal?.attendance_stats?.absent_count || 0}</div>
                                <div className="text-red-600">Absent</div>
                              </div>
                            </div>
                          </div>
                          {/* Payment Side */}
                          <div className="text-center">
                            <div className="text-xl font-bold text-green-700 mb-1">
                              {selectedStudentForModal?.enrollment_info?.total_debt || 0} DA
                            </div>
                            <div className="text-xs text-green-600 mb-2">
                              {selectedStudentForModal?.enrollment_info?.total_debt && selectedStudentForModal.enrollment_info.total_debt > 0 ? 'Outstanding Debt' : 'No Debt'}
                            </div>
                            <div className="flex justify-center space-x-3 text-xs">
                              <div className="text-center">
                                <div className="font-bold text-blue-600">{selectedStudentForModal?.payment_stats?.total_paid || 0} DA</div>
                                <div className="text-blue-600">Paid</div>
                              </div>
                              <div className="text-center">
                                <div className="font-bold text-purple-600">{selectedStudentForModal?.payment_stats?.sessions_attended || 0}</div>
                                <div className="text-purple-600">Sessions</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activity Summary */}
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Recent Activity
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {/* Recent Attendance */}
                          {selectedStudentForModal?.recent_attendance && selectedStudentForModal.recent_attendance.length > 0 && (
                            <div className="flex items-center justify-between p-2 bg-white/50 rounded border text-xs">
                              <div className="flex items-center space-x-2">
                                <Activity className="w-3 h-3 text-blue-600" />
                                <span className="text-muted-foreground">Last attendance:</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`font-medium ${
                                  selectedStudentForModal.recent_attendance[0].status === 'present' ? 'text-green-700' :
                                  selectedStudentForModal.recent_attendance[0].status === 'late' ? 'text-yellow-700' : 'text-red-700'
                                }`}>
                                  {selectedStudentForModal.recent_attendance[0].status.charAt(0).toUpperCase() + selectedStudentForModal.recent_attendance[0].status.slice(1)}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(selectedStudentForModal.recent_attendance[0].attendance_date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Recent Payment */}
                          {selectedStudentForModal?.recent_payments && selectedStudentForModal.recent_payments.length > 0 && (
                            <div className="flex items-center justify-between p-2 bg-white/50 rounded border text-xs">
                              <div className="flex items-center space-x-2">
                                <DollarSign className="w-3 h-3 text-green-600" />
                                <span className="text-muted-foreground">Last payment:</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-green-700">{selectedStudentForModal.recent_payments[0].amount} DA</span>
                                <span className="text-muted-foreground">
                                  {new Date(selectedStudentForModal.recent_payments[0].payment_date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* No recent activity */}
                          {(!selectedStudentForModal?.recent_attendance || selectedStudentForModal.recent_attendance.length === 0) &&
                           (!selectedStudentForModal?.recent_payments || selectedStudentForModal.recent_payments.length === 0) && (
                            <div className="text-center py-4">
                              <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">No recent activity</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Access */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center mb-4">
                      <Settings className="w-5 h-5 mr-2" />
                      Mobile Access
                    </h3>

                    <div className="space-y-4">
                      {/* Student Mobile Access */}
                      <div className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Student Access</p>
                              <p className="text-xs text-muted-foreground">{selectedStudentForModal.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {selectedStudentForModal?.mobile_credentials?.app_enabled ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-xs font-medium">
                              {selectedStudentForModal?.mobile_credentials?.app_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        {selectedStudentForModal?.mobile_credentials?.username ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Username:</span>
                              <span className="font-medium">{selectedStudentForModal.mobile_credentials.username}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewCredentials('student', selectedStudentForModal.id)}
                                className="flex-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center justify-center"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </button>
                              <button
                                onClick={() => handleResetStudentPassword(selectedStudentForModal.id)}
                                className="flex-1 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 flex items-center justify-center"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Reset
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground mb-2">No credentials set up</p>
                            <button
                              onClick={() => handleGenerateMobileCredentials(selectedStudentForModal.id, 'student')}
                              className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90"
                            >
                              Generate
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Parent Mobile Access */}
                      {selectedStudentForModal.parent && (
                        <div className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Parent Access</p>
                                <p className="text-xs text-muted-foreground">{selectedStudentForModal?.parent?.name || 'Unknown Parent'}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {selectedStudentForModal?.parent?.mobile_app_enabled ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span className="text-xs font-medium">
                                {selectedStudentForModal?.parent?.mobile_app_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          </div>

                          {selectedStudentForModal?.parent?.mobile_username ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Username:</span>
                                <span className="font-medium">{selectedStudentForModal.parent.mobile_username}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleViewCredentials('parent', selectedStudentForModal.parent?.id)}
                                  className="flex-1 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 flex items-center justify-center"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </button>
                                <button
                                  onClick={() => handleResetParentPassword(selectedStudentForModal.parent?.id)}
                                  className="flex-1 px-3 py-1 bg-pink-600 text-white text-xs rounded hover:bg-pink-700 flex items-center justify-center"
                                >
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                  Reset
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-2">
                              <p className="text-xs text-muted-foreground mb-2">No credentials set up</p>
                              <button
                                onClick={() => handleGenerateMobileCredentials(selectedStudentForModal.parent?.id, 'parent')}
                                className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90"
                              >
                                Generate
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-border bg-muted/30">
              <button
                onClick={() => {
                  setShowStudentDetailModal(false);
                  setSelectedStudentForModal(null);
                }}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
              >
                Close
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && credentialsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-full flex items-center justify-center">
                  <Lock className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Mobile Credentials</h2>
                  <p className="text-muted-foreground">
                    {credentialsData.type === 'student' ? 'Student' : credentialsData.type === 'parent' ? 'Parent' : 'User'} Account Access
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">{t('adminMobilePassword')}</label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm bg-green-50 p-2 rounded border flex-1">{credentialsData.mobile_password || t('notSet')}</p>
                  <button
                    onClick={() => handleRegeneratePassword(credentialsData.type, credentialsData.type === 'student' ? credentialsData.student_id : credentialsData.parent_id)}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-border bg-muted/30">
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Attendance System Component
const AttendanceSystem: React.FC<{
  users: User[];
  scannedBarcode: string;
  setScannedBarcode: (value: string) => void;
  attendanceData: any;
  setAttendanceData: (data: any) => void;
  showPaymentDialog: boolean;
  setShowPaymentDialog: (show: boolean) => void;
  paymentAmount: number;
  setPaymentAmount: (amount: number) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  indebtedUsers: any[];
  setIndebtedUsers: (users: any[]) => void;
  showIndebtedUsers: boolean;
  setShowIndebtedUsers: (show: boolean) => void;
  selectedIndebtedUser: any;
  setSelectedIndebtedUser: (user: any) => void;
  showClearDebtDialog: boolean;
  setShowClearDebtDialog: (show: boolean) => void;
  clearDebtAmount: number;
  setClearDebtAmount: (amount: number) => void;
  attendanceSearchTerm: string;
  setAttendanceSearchTerm: (term: string) => void;
  attendanceFilter: string;
  setAttendanceFilter: (filter: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  handleScanBarcode: () => Promise<void>;
  handleConfirmPayment: () => Promise<void>;
  handleFetchIndebtedUsers: () => Promise<void>;
  handleClearDebt: (userId: number, amount: number) => Promise<void>;
  showAttendanceModal: boolean;
  setShowAttendanceModal: (show: boolean) => void;
  selectedStudentAttendance: any;
  setSelectedStudentAttendance: (data: any) => void;
  showTimeRestrictionModal: boolean;
  setShowTimeRestrictionModal: (show: boolean) => void;
  timeRestrictionData: any;
  setTimeRestrictionData: (data: any) => void;
  pendingAttendanceAction: any;
  setPendingAttendanceAction: (action: any) => void;
  handleForceAttendanceAction: () => Promise<void>;
  markingAttendance: Set<number>;
  setMarkingAttendance: (attendance: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
}> = ({
  users,
  scannedBarcode,
  setScannedBarcode,
  attendanceData,
  setAttendanceData,
  showPaymentDialog,
  setShowPaymentDialog,
  paymentAmount,
  setPaymentAmount,
  paymentMethod,
  setPaymentMethod,
  indebtedUsers,
  setIndebtedUsers,
  showIndebtedUsers,
  setShowIndebtedUsers,
  selectedIndebtedUser,
  setSelectedIndebtedUser,
  showClearDebtDialog,
  setShowClearDebtDialog,
  clearDebtAmount,
  setClearDebtAmount,
  attendanceSearchTerm,
  setAttendanceSearchTerm,
  attendanceFilter,
  setAttendanceFilter,
  loading,
  setLoading,
  handleScanBarcode,
  handleConfirmPayment,
  handleFetchIndebtedUsers,
  handleClearDebt,
  showAttendanceModal,
  setShowAttendanceModal,
  selectedStudentAttendance,
  setSelectedStudentAttendance,
  showTimeRestrictionModal,
  setShowTimeRestrictionModal,
  timeRestrictionData,
  setTimeRestrictionData,
  pendingAttendanceAction,
  setPendingAttendanceAction,
  handleForceAttendanceAction,
  markingAttendance,
  setMarkingAttendance
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl shadow-luxury border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Attendance & Payment System</h2>
          <p className="text-muted-foreground mt-1">Scan barcodes to mark attendance with automatic payment confirmation</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleFetchIndebtedUsers}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          View Indebted Users
        </button>
      </div>

      {/* Barcode Scanner */}
      <div className="bg-card rounded-xl shadow-luxury border border-border">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Barcode Scanner</h3>
          <p className="text-muted-foreground mt-1">Enter or scan a student barcode to mark attendance</p>
        </div>
        <div className="p-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                placeholder="Enter barcode number..."
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleScanBarcode()}
              />
            </div>
            <button
              onClick={handleScanBarcode}
              disabled={loading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {loading ? 'Scanning...' : 'Scan Barcode'}
            </button>
          </div>

          {/* Attendance Result */}
          {attendanceData && !attendanceData.payment_required && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-800">Attendance Recorded Successfully!</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Student:</p>
                  <p className="font-medium">{attendanceData.student_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Course:</p>
                  <p className="font-medium">{attendanceData.course_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status:</p>
                  <p className="font-medium text-green-600">Present</p>
                </div>
                <div>
                  <p className="text-gray-600">Time:</p>
                  <p className="font-medium">{new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Indebted Users Modal */}
      {showIndebtedUsers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Indebted Users</h3>
                <button
                  onClick={() => setShowIndebtedUsers(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* Search and Filter */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    value={attendanceSearchTerm}
                    onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value)}
                  className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">All Users</option>
                  <option value="high_debt">High Debt (&gt;5000 DA)</option>
                  <option value="recent">Recent Activity</option>
                </select>
              </div>

              {/* Users List */}
              <div className="space-y-4">
                {indebtedUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No indebted users found</p>
                  </div>
                ) : (
                  indebtedUsers.map((user) => (
                    <div key={user.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-foreground">{user.name}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-sm text-muted-foreground">Phone: {user.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">{user.total_debt} DA</p>
                          <p className="text-sm text-muted-foreground">Outstanding Debt</p>
                          <button
                            onClick={() => {
                              setSelectedIndebtedUser(user);
                              setClearDebtAmount(user.total_debt);
                              setShowClearDebtDialog(true);
                            }}
                            className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Clear Debt
                          </button>
                        </div>
                      </div>
                      {user.last_payment && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground">
                            Last payment: {new Date(user.last_payment).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Dialog */}
      {showPaymentDialog && attendanceData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Payment Required</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h4 className="font-medium text-foreground mb-2">{attendanceData.student_name}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Course: {attendanceData.course_name}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Payment required for this session. Please collect payment before marking attendance.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Amount (DA)
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Payment'}
                </button>
                <button
                  onClick={() => setShowPaymentDialog(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Debt Dialog */}
      {showClearDebtDialog && selectedIndebtedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-luxury border border-border max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Clear Debt</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h4 className="font-medium text-foreground mb-2">{selectedIndebtedUser.name}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Current debt: {selectedIndebtedUser.total_debt} DA
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Amount to Clear (DA)
                  </label>
                  <input
                    type="number"
                    value={clearDebtAmount}
                    onChange={(e) => setClearDebtAmount(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    min="0"
                    max={selectedIndebtedUser.total_debt}
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleClearDebt(selectedIndebtedUser.id, clearDebtAmount)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Clear Debt'}
                </button>
                <button
                  onClick={() => setShowClearDebtDialog(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance History Modal */}
      {showAttendanceModal && selectedStudentAttendance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Attendance History</h2>
                  <p className="text-muted-foreground">
                    {selectedStudentAttendance.student.name} - Detailed Attendance Records
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Attendance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-800">{selectedStudentAttendance.attendance_summary.present_count}</div>
                  <div className="text-sm text-green-600">Present Days</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-800">{selectedStudentAttendance.attendance_summary.absent_count}</div>
                  <div className="text-sm text-red-600">Absent Days</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4 text-center">
                  <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-800">{selectedStudentAttendance.attendance_summary.total_records}</div>
                  <div className="text-sm text-yellow-600">Total Sessions</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-800">{selectedStudentAttendance.attendance_summary.attendance_rate}%</div>
                  <div className="text-sm text-blue-600">Attendance Rate</div>
                </div>
              </div>

              {/* Attendance Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>Attendance Progress</span>
                  <span>{selectedStudentAttendance.attendance_summary.attendance_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      selectedStudentAttendance.attendance_summary.attendance_rate >= 90 ? 'bg-green-500' :
                      selectedStudentAttendance.attendance_summary.attendance_rate >= 75 ? 'bg-yellow-500' :
                      selectedStudentAttendance.attendance_summary.attendance_rate >= 60 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${selectedStudentAttendance.attendance_summary.attendance_rate}%` }}
                  ></div>
                </div>
              </div>

              {/* Recent Attendance Records */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Recent Attendance Records
                </h3>
                <div className="space-y-3">
                  {selectedStudentAttendance.attendance_records.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No attendance records found</p>
                    </div>
                  ) : (
                    selectedStudentAttendance.attendance_records.slice(0, 10).map((record: any) => (
                      <div key={record.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              record.status === 'present' ? 'bg-green-100 text-green-600' :
                              record.status === 'late' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {record.status === 'present' ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : record.status === 'late' ? (
                                <Clock className="w-5 h-5" />
                              ) : (
                                <XCircle className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {new Date(record.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {record.course?.name || 'Unknown Course'} - {record.class?.name || 'Unknown Class'}
                              </p>
                              {record.notes && (
                                <p className="text-xs text-muted-foreground mt-1">Note: {record.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              record.status === 'present' ? 'bg-green-100 text-green-800' :
                              record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {selectedStudentAttendance.attendance_records.length > 10 && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing 10 of {selectedStudentAttendance.attendance_records.length} records
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULLETPROOF NOTIFICATION SYSTEM - Multiple fallback methods */}
      
      {/* Method 1: Fixed Overlay Notification */}
      {showTimeRestrictionModal && timeRestrictionData && !showPaymentModal && (
        <div 
          id="time-restriction-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999996,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, sans-serif'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              // Click on overlay background closes it
              console.log('Closing time restriction notification via overlay click');
              setShowTimeRestrictionModal(false);
              setPendingAttendanceAction(null);
              setTimeRestrictionData(null);
              if (pendingAttendanceAction) {
                setMarkingAttendance(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(pendingAttendanceAction.studentId);
                  return newSet;
                });
              }
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              border: `3px solid ${timeRestrictionData.debt_info ? '#dc2626' : '#f97316'}`,
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                console.log('Closing time restriction notification via close button');
                setShowTimeRestrictionModal(false);
                setPendingAttendanceAction(null);
                setTimeRestrictionData(null);
                if (pendingAttendanceAction) {
                  setMarkingAttendance(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(pendingAttendanceAction.studentId);
                    return newSet;
                  });
                }
              }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '5px',
                lineHeight: '1'
              }}
            >
              ✕
            </button>

            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                margin: '0 0 8px 0', 
                color: timeRestrictionData.debt_info ? '#dc2626' : '#f97316', 
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                {timeRestrictionData.debt_info ? '💰 Debt Warning' : '⚠️ Time Restriction Warning'}
              </h2>
              <p style={{ 
                margin: 0, 
                color: '#666', 
                fontSize: '16px' 
              }}>
                {timeRestrictionData.debt_info ? 'Student has unpaid debts' : 'Attendance marking outside allowed window'}
              </p>
            </div>

            {/* Warning Message */}
            <div style={{
              backgroundColor: timeRestrictionData.debt_info ? '#fef2f2' : '#fff3e0',
              border: `2px solid ${timeRestrictionData.debt_info ? '#dc2626' : '#f97316'}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontWeight: 'bold', 
                color: timeRestrictionData.debt_info ? '#dc2626' : '#e65100',
                fontSize: '16px'
              }}>
                {timeRestrictionData.message}
              </p>
              
              {/* Debt Warning */}
              {timeRestrictionData.debt_warning && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '2px solid #dc2626',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '12px'
                }}>
                  <p style={{ 
                    margin: 0, 
                    fontWeight: 'bold', 
                    color: '#dc2626',
                    fontSize: '14px'
                  }}>
                    💰 {timeRestrictionData.debt_warning}
                  </p>
                </div>
              )}
              
              {/* Time Information */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                marginTop: '12px'
              }}>
                <div style={{
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>Current Time</div>
                  <div style={{ fontSize: '16px', color: '#333', fontWeight: 'bold' }}>
                    {timeRestrictionData.current_time}
                  </div>
                </div>
                <div style={{
                  backgroundColor: '#e3f2fd',
                  padding: '12px',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', color: '#1565c0', fontWeight: 'bold' }}>Class Time</div>
                  <div style={{ fontSize: '14px', color: '#1976d2', fontWeight: 'bold' }}>
                    {timeRestrictionData.class_schedule?.start_time} - {timeRestrictionData.class_schedule?.end_time}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  console.log('CANCELING attendance marking from notification');
                  setShowTimeRestrictionModal(false);
                  setPendingAttendanceAction(null);
                  setTimeRestrictionData(null);
                  if (pendingAttendanceAction) {
                    setMarkingAttendance(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(pendingAttendanceAction.studentId);
                      return newSet;
                    });
                  }
                  toast.info('Attendance marking cancelled');
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f5f5f5',
                  border: '2px solid #ccc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('🚨 [FORCE_BUTTON_CLICK] FORCE MARKING attendance from notification');
                  handleForceAttendanceAction();
                }}
                style={{
                  padding: '16px 32px',
                  background: 'linear-gradient(45deg, #f97316, #ea580c)',
                  border: '3px solid #f97316',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                  boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)',
                  animation: 'pulse 2s infinite',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(249, 115, 22, 0.6)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(249, 115, 22, 0.4)';
                }}
              >
                🚨 FORCE MARK ATTENDANCE 🚨
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Clearance Modal */}
      {showDebtClearanceModal && debtClearanceData && !showPaymentModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999995,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Arial, sans-serif'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log('💰 [DEBT_MODAL] Background clicked, closing modal');
              setShowDebtClearanceModal(false);
              setDebtClearanceData(null);
              setPendingAttendanceAction(null);
            }
          }}
        >
          {console.log('💰 [DEBT_MODAL] Rendering debt clearance modal', { showDebtClearanceModal, debtClearanceData })}
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              border: '3px solid #dc2626',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDebtClearanceModal(false);
                setDebtClearanceData(null);
                setPendingAttendanceAction(null);
              }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '5px',
                lineHeight: '1'
              }}
            >
              ✕
            </button>

            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                margin: '0 0 8px 0', 
                color: '#dc2626', 
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                💰 Debt Clearance Check
              </h2>
              <p style={{ 
                margin: 0, 
                color: '#666', 
                fontSize: '16px' 
              }}>
                Student has unpaid debts - confirm clearance before marking attendance
              </p>
            </div>

            {/* Debt Information */}
            <div style={{
              backgroundColor: '#fef2f2',
              border: '2px solid #dc2626',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#dc2626' }}>Student:</strong> {debtClearanceData.studentName}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#dc2626' }}>Total Debt:</strong> {debtClearanceData.totalDebt} DA
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                ⚠️ This student has outstanding payments. Please confirm if debts have been cleared before proceeding with attendance marking.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  console.log('✅ [DEBT_CLEARED] User confirmed debts are cleared');
                  setShowDebtClearanceModal(false);
                  // Proceed with attendance marking
                  proceedWithAttendanceMarking(debtClearanceData.pendingAttendanceAction);
                  setDebtClearanceData(null);
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#10b981',
                  border: '2px solid #10b981',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white'
                }}
              >
                ✅ Debts Cleared
              </button>
              <button
                onClick={() => {
                  console.log('❌ [DEBT_NOT_CLEARED] User confirmed debts are NOT cleared');
                  setShowDebtClearanceModal(false);
                  // Still proceed with attendance marking (debts will be added)
                  proceedWithAttendanceMarking(debtClearanceData.pendingAttendanceAction);
                  setDebtClearanceData(null);
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f97316',
                  border: '2px solid #f97316',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white'
                }}
              >
                ❌ Not Yet Cleared
              </button>
              <button
                onClick={() => {
                  console.log('🚫 [DEBT_CANCEL] User cancelled attendance marking');
                  setShowDebtClearanceModal(false);
                  setDebtClearanceData(null);
                  setPendingAttendanceAction(null);
                  toast.info('Attendance marking cancelled');
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f5f5f5',
                  border: '2px solid #ccc',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Method 2: Top Bar Notification */}
      {showTimeRestrictionModal && timeRestrictionData && (
        <div 
          id="time-restriction-topbar"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999997,
            backgroundColor: '#f97316',
            color: 'white',
            padding: '12px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
        >
          🚨 TIME RESTRICTION: {timeRestrictionData.message} - 
          <button 
            onClick={() => handleForceAttendanceAction()}
            style={{
              marginLeft: '12px',
              padding: '6px 12px',
              backgroundColor: 'white',
              color: '#f97316',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Force Mark
          </button>
          <button 
            onClick={() => {
              setShowTimeRestrictionModal(false);
              setPendingAttendanceAction(null);
              setTimeRestrictionData(null);
            }}
            style={{
              marginLeft: '8px',
              padding: '6px 12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Registration Details Modal */}
      {showRegistrationDetailsModal && selectedRegistration && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#333' }}>Registration Details</h3>
              <button
                onClick={() => setShowRegistrationDetailsModal(false)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              {/* Student Information */}
              <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Student Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <strong>Name:</strong> {selectedRegistration.first_name} {selectedRegistration.last_name}
                  </div>
                  <div>
                    <strong>Email:</strong> {selectedRegistration.email}
                  </div>
                  <div>
                    <strong>Phone:</strong> {selectedRegistration.phone}
                  </div>
                  <div>
                    <strong>Age:</strong> {selectedRegistration.age}
                  </div>
                  {selectedRegistration.parent_name && (
                    <div>
                      <strong>Parent:</strong> {selectedRegistration.parent_name}
                    </div>
                  )}
                  {selectedRegistration.parent_phone && (
                    <div>
                      <strong>Parent Phone:</strong> {selectedRegistration.parent_phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Course Information */}
              <div style={{ padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Course Information</h4>
                <div>
                  <div><strong>Course:</strong> {selectedRegistration.course_name}</div>
                  <div><strong>Price:</strong> {selectedRegistration.price} DZD</div>
                  <div><strong>Registration Date:</strong> {new Date(selectedRegistration.registration_date).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Registration Status */}
              <div style={{ padding: '15px', backgroundColor: '#fff5f5', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Status Information</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <strong>Status:</strong>
                    <span style={{
                      marginLeft: '8px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: selectedRegistration.status === 'pending' ? '#fff3cd' :
                                     selectedRegistration.status === 'approved' ? '#d4edda' : '#f8d7da',
                      color: selectedRegistration.status === 'pending' ? '#856404' :
                             selectedRegistration.status === 'approved' ? '#155724' : '#721c24'
                    }}>
                      {selectedRegistration.status?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <strong>Payment Status:</strong>
                    <span style={{
                      marginLeft: '8px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: selectedRegistration.payment_status === 'paid' ? '#d4edda' : '#fff3cd',
                      color: selectedRegistration.payment_status === 'paid' ? '#155724' : '#856404'
                    }}>
                      {selectedRegistration.payment_status?.toUpperCase()}
                    </span>
                  </div>
                </div>
                {selectedRegistration.rejection_reason && (
                  <div style={{ marginTop: '10px' }}>
                    <strong>Rejection Reason:</strong> {selectedRegistration.rejection_reason}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedRegistration.status === 'pending' && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                  <button
                    onClick={() => handleRegistrationAction(selectedRegistration.id, 'approve')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleRejectRegistration(selectedRegistration.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kindergarten Detail Modal */}
      {showKindergartenDetailModal && selectedKindergartenEnrollment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-pink-500 to-purple-500">
              <h3 className="text-xl font-bold text-white flex items-center">
                🧸 Kindergarten Enrollment Details
              </h3>
              <button
                onClick={() => setShowKindergartenDetailModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Student Information */}
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
                <h4 className="font-semibold text-lg mb-3 text-pink-700 dark:text-pink-300">Student Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Student Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedKindergartenEnrollment.student.full_name || selectedKindergartenEnrollment.student.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Student ID</p>
                    <p className="font-medium text-gray-900 dark:text-white">#{selectedKindergartenEnrollment.student.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Parent Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedKindergartenEnrollment.student.parent?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Contact Phone</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedKindergartenEnrollment.student.phone_number || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Enrollment Information */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-lg mb-3 text-blue-700 dark:text-blue-300">Enrollment Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Course</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedKindergartenEnrollment.enrollment.course_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Class</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedKindergartenEnrollment.enrollment.section_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Enrollment Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedKindergartenEnrollment.enrollment.enrollment_date ? 
                        new Date(selectedKindergartenEnrollment.enrollment.enrollment_date).toLocaleDateString() : 
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Enrollment Status</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      selectedKindergartenEnrollment.enrollment.enrollment_status === 'approved' ?
                        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        selectedKindergartenEnrollment.enrollment.enrollment_status === 'pending' ?
                        'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {selectedKindergartenEnrollment.enrollment.enrollment_status || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subscription Information */}
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-lg mb-3 text-green-700 dark:text-green-300">Subscription & Payment</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Subscription Status</p>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                      selectedKindergartenEnrollment.enrollment.subscription_status === 'active' ?
                        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        selectedKindergartenEnrollment.enrollment.subscription_status === 'pending' ?
                        'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {selectedKindergartenEnrollment.enrollment.subscription_status || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Monthly Amount</p>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">
                      {selectedKindergartenEnrollment.enrollment.subscription_amount ? 
                        `${selectedKindergartenEnrollment.enrollment.subscription_amount} DA` : 
                        'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Next Payment Date</p>
                    <p className={`font-medium ${
                      selectedKindergartenEnrollment.enrollment.next_subscription_date && 
                      new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date) <= new Date() ?
                        'text-red-600 dark:text-red-400 font-bold' :
                        'text-gray-900 dark:text-white'
                    }`}>
                      {selectedKindergartenEnrollment.enrollment.next_subscription_date ?
                        new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date).toLocaleDateString() :
                        'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Payment Status</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selectedKindergartenEnrollment.enrollment.next_subscription_date && 
                       new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date) <= new Date() ?
                        '⚠️ Payment Due' :
                        '✅ Up to date'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attendance Information */}
              <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-lg mb-3 text-purple-700 dark:text-purple-300">Attendance Record</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Total Sessions</p>
                    <p className="font-bold text-2xl text-gray-900 dark:text-white">{selectedKindergartenEnrollment.enrollment.total_sessions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Sessions Attended</p>
                    <p className="font-bold text-2xl text-green-600 dark:text-green-400">{selectedKindergartenEnrollment.enrollment.sessions_attended || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Attendance Rate</p>
                    <p className="font-bold text-2xl text-blue-600 dark:text-blue-400">{selectedKindergartenEnrollment.enrollment.attendance_rate || 0}%</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all"
                      style={{ width: `${selectedKindergartenEnrollment.enrollment.attendance_rate || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Removed - Read-only mode */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Attendance & payment actions disabled - View only mode
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kindergarten Attendance Modal */}
      {showKindergartenAttendanceModal && selectedKindergartenEnrollment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-green-500 to-emerald-500">
              <h3 className="text-xl font-bold text-white flex items-center">
                <CheckCircle className="w-6 h-6 mr-2" />
                Mark Kindergarten Attendance
              </h3>
              <button
                onClick={() => setShowKindergartenAttendanceModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Student</p>
                <p className="font-semibold text-lg text-gray-900 dark:text-white">
                  {selectedKindergartenEnrollment.student.full_name || selectedKindergartenEnrollment.student.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Class: {selectedKindergartenEnrollment.enrollment.section_name} • 
                  Course: {selectedKindergartenEnrollment.enrollment.course_name}
                </p>
              </div>

              {/* Attendance Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attendance Date
                </label>
                <input
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  id="kindergarten-attendance-date"
                />
              </div>

              {/* Attendance Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attendance Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      const btn = document.getElementById('attendance-present');
                      const btns = document.querySelectorAll('[data-attendance-btn]');
                      btns.forEach(b => b.classList.remove('ring-2', 'ring-green-500', 'ring-red-500', 'ring-yellow-500', 'ring-blue-500'));
                      btn?.classList.add('ring-2', 'ring-green-500');
                      btn?.setAttribute('data-selected', 'true');
                    }}
                    id="attendance-present"
                    data-attendance-btn
                    data-status="present"
                    className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 transition-colors flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium">Present</span>
                  </button>
                  <button
                    onClick={() => {
                      const btn = document.getElementById('attendance-absent');
                      const btns = document.querySelectorAll('[data-attendance-btn]');
                      btns.forEach(b => b.classList.remove('ring-2', 'ring-green-500', 'ring-red-500', 'ring-yellow-500', 'ring-blue-500'));
                      btn?.classList.add('ring-2', 'ring-red-500');
                      btn?.setAttribute('data-selected', 'true');
                    }}
                    id="attendance-absent"
                    data-attendance-btn
                    data-status="absent"
                    className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-red-500 transition-colors flex items-center justify-center space-x-2"
                  >
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium">Absent</span>
                  </button>
                  <button
                    onClick={() => {
                      const btn = document.getElementById('attendance-late');
                      const btns = document.querySelectorAll('[data-attendance-btn]');
                      btns.forEach(b => b.classList.remove('ring-2', 'ring-green-500', 'ring-red-500', 'ring-yellow-500', 'ring-blue-500'));
                      btn?.classList.add('ring-2', 'ring-yellow-500');
                      btn?.setAttribute('data-selected', 'true');
                    }}
                    id="attendance-late"
                    data-attendance-btn
                    data-status="late"
                    className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-yellow-500 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium">Late</span>
                  </button>
                  <button
                    onClick={() => {
                      const btn = document.getElementById('attendance-excused');
                      const btns = document.querySelectorAll('[data-attendance-btn]');
                      btns.forEach(b => b.classList.remove('ring-2', 'ring-green-500', 'ring-red-500', 'ring-yellow-500', 'ring-blue-500'));
                      btn?.classList.add('ring-2', 'ring-blue-500');
                      btn?.setAttribute('data-selected', 'true');
                    }}
                    id="attendance-excused"
                    data-attendance-btn
                    data-status="excused"
                    className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Info className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">Excused</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="kindergarten-attendance-notes"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Add any notes about this attendance..."
                />
              </div>

              {/* Current Stats */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Attendance Record</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sessions Attended: <strong>{selectedKindergartenEnrollment.enrollment.sessions_attended || 0}</strong></span>
                  <span className="text-sm">Total Sessions: <strong>{selectedKindergartenEnrollment.enrollment.total_sessions || 0}</strong></span>
                  <span className="text-sm">Rate: <strong className="text-green-600 dark:text-green-400">{selectedKindergartenEnrollment.enrollment.attendance_rate || 0}%</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowKindergartenAttendanceModal(false)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const dateInput = document.getElementById('kindergarten-attendance-date') as HTMLInputElement;
                    const notesInput = document.getElementById('kindergarten-attendance-notes') as HTMLTextAreaElement;
                    const selectedBtn = document.querySelector('[data-attendance-btn][data-selected="true"]');
                    const status = selectedBtn?.getAttribute('data-status') || 'present';

                    if (!dateInput.value) {
                      toast.error('Please select a date');
                      return;
                    }

                    try {
                      await axios.post('/api/admin/attendance/mark', {
                        student_id: selectedKindergartenEnrollment.student.id,
                        class_id: selectedKindergartenEnrollment.enrollment.section_id,
                        attendance_date: dateInput.value,
                        status: status,
                        notes: notesInput.value,
                        is_kindergarten: true
                      });

                      toast.success('Attendance marked successfully!');
                      setShowKindergartenAttendanceModal(false);
                      fetchStudentsTableData();
                    } catch (error) {
                      console.error('Error marking attendance:', error);
                      toast.error('Failed to mark attendance');
                    }
                  }}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Mark Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kindergarten Payment Modal */}
      {showKindergartenPaymentModal && selectedKindergartenEnrollment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-500 to-pink-500">
              <h3 className="text-xl font-bold text-white flex items-center">
                <DollarSign className="w-6 h-6 mr-2" />
                Manage Subscription Payment
              </h3>
              <button
                onClick={() => setShowKindergartenPaymentModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Student</p>
                <p className="font-semibold text-lg text-gray-900 dark:text-white">
                  {selectedKindergartenEnrollment.student.full_name || selectedKindergartenEnrollment.student.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Class: {selectedKindergartenEnrollment.enrollment.section_name} • 
                  Course: {selectedKindergartenEnrollment.enrollment.course_name}
                </p>
              </div>

              {/* Current Subscription Status */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold mb-3 text-purple-700 dark:text-purple-300">Current Subscription</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Status</p>
                    <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                      selectedKindergartenEnrollment.enrollment.subscription_status === 'active' ?
                        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        selectedKindergartenEnrollment.enrollment.subscription_status === 'pending' ?
                        'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {selectedKindergartenEnrollment.enrollment.subscription_status || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Monthly Amount</p>
                    <p className="font-bold text-xl text-purple-600 dark:text-purple-400">
                      {selectedKindergartenEnrollment.enrollment.subscription_amount || 0} DA
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Next Payment Due</p>
                    <p className={`font-medium ${
                      selectedKindergartenEnrollment.enrollment.next_subscription_date && 
                      new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date) <= new Date() ?
                        'text-red-600 dark:text-red-400 font-bold' :
                        'text-gray-900 dark:text-white'
                    }`}>
                      {selectedKindergartenEnrollment.enrollment.next_subscription_date ?
                        new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date).toLocaleDateString() :
                        'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Payment Status</p>
                    {selectedKindergartenEnrollment.enrollment.next_subscription_date && 
                     new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date) <= new Date() ? (
                      <span className="text-red-600 dark:text-red-400 font-bold animate-pulse">⚠️ OVERDUE</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-medium">✅ Up to date</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Options */}
              <div>
                <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Payment Action</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="payment-renew"
                      name="payment-action"
                      value="renew"
                      defaultChecked
                      className="w-4 h-4 text-purple-600"
                    />
                    <label htmlFor="payment-renew" className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="font-medium text-gray-900 dark:text-white">Renew Subscription</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Mark payment received and extend subscription by 1 month</div>
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="payment-update"
                      name="payment-action"
                      value="update"
                      className="w-4 h-4 text-purple-600"
                    />
                    <label htmlFor="payment-update" className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="font-medium text-gray-900 dark:text-white">Update Subscription Details</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Change subscription status, amount, or dates</div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Update Fields */}
              <div id="update-fields" className="space-y-4 hidden">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subscription Status
                  </label>
                  <select
                    id="subscription-status"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    defaultValue={selectedKindergartenEnrollment.enrollment.subscription_status}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monthly Amount (DA)
                  </label>
                  <input
                    type="number"
                    id="subscription-amount"
                    defaultValue={selectedKindergartenEnrollment.enrollment.subscription_amount}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Next Payment Date
                  </label>
                  <input
                    type="date"
                    id="next-payment-date"
                    defaultValue={selectedKindergartenEnrollment.enrollment.next_subscription_date ? 
                      new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date).toISOString().split('T')[0] : ''}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Payment Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Notes (Optional)
                </label>
                <textarea
                  id="payment-notes"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Add notes about this payment..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowKindergartenPaymentModal(false)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const action = (document.querySelector('input[name="payment-action"]:checked') as HTMLInputElement)?.value || 'renew';
                    const notes = (document.getElementById('payment-notes') as HTMLTextAreaElement).value;

                    try {
                      if (action === 'renew') {
                        // Renew subscription - extend by 1 month
                        const nextDate = new Date(selectedKindergartenEnrollment.enrollment.next_subscription_date || new Date());
                        nextDate.setMonth(nextDate.getMonth() + 1);

                        await axios.put(`/api/admin/enrollments/${selectedKindergartenEnrollment.enrollmentId}`, {
                          subscription_status: 'active',
                          next_subscription_date: nextDate.toISOString().split('T')[0],
                          payment_notes: notes
                        });

                        toast.success('Subscription renewed successfully!');
                      } else {
                        // Update subscription details
                        const status = (document.getElementById('subscription-status') as HTMLSelectElement).value;
                        const amount = parseFloat((document.getElementById('subscription-amount') as HTMLInputElement).value);
                        const nextDate = (document.getElementById('next-payment-date') as HTMLInputElement).value;

                        await axios.put(`/api/admin/enrollments/${selectedKindergartenEnrollment.enrollmentId}`, {
                          subscription_status: status,
                          subscription_amount: amount,
                          next_subscription_date: nextDate,
                          payment_notes: notes
                        });

                        toast.success('Subscription updated successfully!');
                      }

                      setShowKindergartenPaymentModal(false);
                      fetchStudentsTableData();
                    } catch (error) {
                      console.error('Error managing payment:', error);
                      toast.error('Failed to process payment');
                    }
                  }}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                >
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Process Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <script dangerouslySetInnerHTML={{__html: `
        document.addEventListener('change', function(e) {
          if (e.target && e.target.name === 'payment-action') {
            const updateFields = document.getElementById('update-fields');
            if (updateFields) {
              updateFields.classList.toggle('hidden', e.target.value === 'renew');
            }
          }
        });
      `}} />
    </div>
  );
};

export default AdminDashboard;
