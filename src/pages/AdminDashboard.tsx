import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslatedCategory } from '../utils/categoryUtils';
import axios from 'axios';
import { toast } from 'sonner';
import EnhancedScheduler from '../components/EnhancedScheduler';
import {
  Users,
  BookOpen,
  FileText,
  BarChart3,
  Mail,
  Settings,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  UserPlus,
  Calendar,
  DollarSign,
  QrCode,
  X
} from 'lucide-react';

// Configure axios base URL
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

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
  section_name: string;
  schedule: string;
  start_date: string | null;
  end_date: string | null;
  max_students: number;
  current_students: number;
  is_active: boolean;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  email_verified: boolean;
  created_at: string;
}

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
  status: string;
}

interface GalleryItem {
  id: number;
  title: string;
  description?: string;
  image_url: string;
  created_at: string;
}

interface Student {
  id: number;
  name: string;
  date_of_birth: string;
  user_id: number;
  parent_name?: string;
  parent_email?: string;
  course_name?: string;
  mobile_username?: string;
  mobile_app_enabled?: boolean;
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

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { translateCategory, getCategoryColors } = useTranslatedCategory();
  const [activeTab, setActiveTab] = useState('overview');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [approvedRegistrations, setApprovedRegistrations] = useState<Registration[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseSections, setCourseSections] = useState<{[courseId: number]: CourseSection[]}>({});
  const [allSections, setAllSections] = useState<CourseSection[]>([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [selectedCourseForSections, setSelectedCourseForSections] = useState<Course | null>(null);
  const [sectionForm, setSectionForm] = useState({
    section_name: '',
    schedule: '',
    start_date: '',
    end_date: '',
    max_students: '',
    is_active: true
  });
  const [users, setUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
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
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      console.log('Fetching dashboard data...');
      console.log('Auth headers:', axios.defaults.headers.common);

      const [regsRes, approvedRegsRes, coursesRes, usersRes, contactRes, studentsRes, galleryRes, mobileCredsRes] = await Promise.all([
        axios.get('/api/admin/registrations?status=pending'),
        axios.get('/api/admin/registrations?status=approved'),
        axios.get('/api/admin/courses'),
        axios.get('/api/admin/users'),
        axios.get('/api/contact/messages'),
        axios.get('/api/admin/students'),
        axios.get('/api/admin/gallery'),
        axios.get('/api/admin/mobile-credentials')
      ]);

      console.log('API responses received');
      setRegistrations(regsRes.data.registrations || []);
      setApprovedRegistrations(approvedRegsRes.data.registrations || []);
      setCourses(coursesRes.data.courses || []);
      setUsers(usersRes.data.users || []);
      setContactMessages(contactRes.data.messages || []);
      setStudents(studentsRes.data.students || []);
      setGalleryItems(galleryRes.data.gallery || []);
      setMobileCredentials(mobileCredsRes.data.credentials || []);

      // Calculate stats
      const totalUsers = usersRes.data.users?.length || 0;
      const totalStudents = studentsRes.data.students?.length || 0;
      const totalCourses = coursesRes.data.courses?.length || 0;
      const pendingRegs = regsRes.data.registrations?.length || 0;
      const approvedRegs = approvedRegsRes.data.registrations?.length || 0;
      const unreadMessages = contactRes.data.messages?.filter((msg: ContactMessage) => msg.status === 'unread').length || 0;

      setStats({
        totalUsers,
        totalStudents,
        totalCourses,
        pendingRegistrations: pendingRegs,
        approvedRegistrations: approvedRegs,
        unreadMessages
      });

      // Fetch all sections for the visual scheduler
      await fetchAllSections(coursesRes.data.courses || []);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSections = async (courses: Course[]) => {
    try {
      console.log('fetchAllSections called with courses:', courses.length);
      const allSectionsPromises = courses.map(course =>
        axios.get(`/api/courses/${course.id}/sections`)
      );

      const responses = await Promise.all(allSectionsPromises);
      console.log('API responses received:', responses.length);

      const allSectionsData: CourseSection[] = [];
      const courseSectionsData: {[courseId: number]: CourseSection[]} = {};

      responses.forEach((response, index) => {
        const courseId = courses[index].id;
        const sections = response.data.sections || [];
        console.log(`Course ${courseId}: ${sections.length} sections`);

        // Add course name and category to each section for display
        const sectionsWithCourseName = sections.map((section: CourseSection) => ({
          ...section,
          course_name: courses[index].name,
          course_category: courses[index].category
        }));

        courseSectionsData[courseId] = sectionsWithCourseName;
        allSectionsData.push(...sectionsWithCourseName);
      });

      console.log('Total sections collected:', allSectionsData.length);
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

  const handleUpdatePaymentStatus = async (registrationId: number, paymentStatus: string) => {
    try {
      await axios.post(`/api/admin/registrations/${registrationId}/payment-status`, {
        payment_status: paymentStatus
      });
      toast.success(`Payment status updated to ${paymentStatus}`);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update payment status');
    }
  };

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

      toast.success(`${userType === 'parent' ? 'Parent' : 'Student'} credentials regenerated successfully`);
    } catch (error: any) {
      console.error('Failed to regenerate credentials:', error);
      toast.error('Failed to regenerate credentials');
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
    if (confirm('Are you sure you want to delete this course?')) {
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
        start_date: '',
        end_date: '',
        max_students: '',
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

  const handleRejectRegistration = async (registrationId: number) => {
    if (confirm('Are you sure you want to reject this registration?')) {
      try {
        await axios.post(`/api/admin/registrations/${registrationId}/reject`);
        toast.success('Registration rejected successfully');
        fetchDashboardData();
      } catch (error) {
        toast.error('Failed to reject registration');
      }
    }
  };

  const handleViewRegistrationDetails = (registration: any) => {
    // For now, just show an alert with details. Could be enhanced with a modal later
    alert(`Registration Details:\n\nStudent: ${registration.student.name}\nParent: ${registration.parent.full_name}\nEmail: ${registration.parent.email}\nCourse: ${registration.course.name}\nPrice: $${registration.course.price}\nSubmitted: ${new Date(registration.created_at).toLocaleString()}`);
  };

  // Student management handlers
  const handleEditStudent = (student: any) => {
    setEditingStudent(student);
    setShowStudentModal(true);
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

  const handleDeleteStudent = async (studentId: number) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const response = await axios.delete(`/api/admin/students/${studentId}`);
      if (response.data.success) {
        await fetchDashboardData();
        toast.success('Student deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete student');
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

  const handleUpdateStudent = async (studentId: number, studentData: any) => {
    try {
      const response = await axios.put(`/api/admin/students/${studentId}`, studentData);
      if (response.data.success) {
        await fetchDashboardData();
        setShowStudentModal(false);
        setEditingStudent(null);
        toast.success('Student updated successfully');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Failed to update student');
    }
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

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await axios.delete(`/api/admin/users/${userId}`);
      if (response.data.success) {
        await fetchDashboardData();
        toast.success('User deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
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
    { id: 'overview', name: t('adminOverviewTab'), icon: BarChart3 },
    { id: 'registrations', name: t('adminRegistrationsTab'), icon: FileText },
    { id: 'courses', name: t('adminCoursesTab'), icon: BookOpen },
    { id: 'students', name: t('adminStudentsTab'), icon: Users },
    { id: 'users', name: t('adminUsersTab'), icon: UserPlus },
    { id: 'mobile-credentials', name: t('adminMobileCredentialsTab'), icon: Settings },
    { id: 'qr-codes', name: t('adminQRCodesTab'), icon: QrCode },
    { id: 'schedule-control', name: t('adminScheduleControlTab'), icon: Calendar },
    { id: 'gallery', name: t('adminGalleryTab'), icon: FileText },
    { id: 'reports', name: t('adminReportsTab'), icon: BarChart3 },
    { id: 'contact', name: t('adminContactTab'), icon: Mail },
  ];

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
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
              <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 bg-gradient-gold rounded-lg">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm text-muted-foreground">{t('adminTotalUsers')}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stats.totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 bg-gradient-gold rounded-lg">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm text-muted-foreground">{t('adminTotalStudents')}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stats.totalStudents}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 bg-gradient-gold rounded-lg">
                    <FileText className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm text-muted-foreground">{t('adminPendingRegistrations')}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stats.pendingRegistrations}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 bg-gradient-gold rounded-lg">
                    <Mail className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm text-muted-foreground">{t('adminUnreadMessages')}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stats.unreadMessages}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl shadow-luxury p-4 md:p-6 border border-border col-span-2 md:col-span-1">
                <div className="flex items-center">
                  <div className="p-2 md:p-3 bg-gradient-gold rounded-lg">
                    <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-secondary" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <p className="text-xs md:text-sm text-muted-foreground">{t('adminTotalCourses')}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stats.totalCourses}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'registrations' && (
            <div className="space-y-6">
              {/* Pending Registrations Section */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{t('adminPendingRegistrationsTitle')}</h2>
                    <p className="text-muted-foreground mt-1">{t('adminPendingRegistrationsSubtitle')}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      {registrations.length} Pending
                    </span>
                    <button
                      onClick={() => fetchDashboardData()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <BarChart3 className="w-4 h-4 inline mr-2" />
                      {t('adminRefresh')}
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground mt-2">Loading registrations...</p>
                    </div>
                  ) : registrations.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No pending registrations</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Search and Filter */}
                      <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <input
                          type="text"
                          placeholder="Search pending registrations..."
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select
                          className="px-3 py-2 border border-border rounded-lg bg-background"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <option value="all">All Pending</option>
                          <option value="recent">Recent (Last 7 days)</option>
                          <option value="older">Older</option>
                        </select>
                      </div>

                      {/* Pending Registrations List */}
                      <div className="space-y-4">
                        {registrations
                          .filter(reg =>
                            reg.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            reg.parent.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            reg.course.name.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .filter(reg => {
                            if (filterStatus === 'all') return true;
                            const regDate = new Date(reg.created_at);
                            const weekAgo = new Date();
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            return filterStatus === 'recent' ? regDate >= weekAgo : regDate < weekAgo;
                          })
                          .map((reg) => (
                            <div key={reg.id} className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h3 className="font-semibold text-foreground">{reg.student.name}</h3>
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                                      {t('adminStatusPending')}
                                    </span>
                                    {reg.payment_status && (
                                      <span className={`px-2 py-1 rounded-full text-xs ${
                                        reg.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                        reg.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        reg.payment_status === 'overdue' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        Payment: {reg.payment_status.charAt(0).toUpperCase() + reg.payment_status.slice(1)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                                    <div>{t('adminParent')}: {reg.parent.full_name}</div>
                                    <div>{t('adminEmail')}: {reg.parent.email}</div>
                                    <div className="text-primary font-medium">{t('adminCourse')}: {reg.course.name}</div>
                                    <div className="text-green-600 font-medium">{t('adminPrice')}: ${reg.course.price}</div>
                                    {reg.payment_date && (
                                      <div className="text-blue-600 font-medium">
                                        Payment Date: {new Date(reg.payment_date).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {t('adminSubmitted')}: {new Date(reg.created_at).toLocaleDateString()} at {new Date(reg.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <div className="flex flex-col space-y-2 ml-4">
                                  <button
                                    onClick={() => handleApproveRegistration(reg.id)}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                                  >
                                    <CheckCircle className="w-4 h-4 inline mr-1" />
                                    {t('adminApprove')}
                                  </button>
                                  <button
                                    onClick={() => handleRejectRegistration(reg.id)}
                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                  >
                                    <XCircle className="w-4 h-4 inline mr-1" />
                                    {t('adminReject')}
                                  </button>
                                  <button
                                    onClick={() => handleViewRegistrationDetails(reg)}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  >
                                    <Eye className="w-4 h-4 inline mr-1" />
                                    {t('adminViewDetails')}
                                  </button>
                                  {/* Payment Status Controls */}
                                  <div className="flex flex-col space-y-1 pt-2 border-t border-border">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">Payment Status:</span>
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'paid')}
                                        className={`px-2 py-1 text-xs rounded ${
                                          reg.payment_status === 'paid'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                                        } transition-colors`}
                                      >
                                        Paid
                                      </button>
                                      <button
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'pending')}
                                        className={`px-2 py-1 text-xs rounded ${
                                          reg.payment_status === 'pending'
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                        } transition-colors`}
                                      >
                                        Pending
                                      </button>
                                      <button
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'overdue')}
                                        className={`px-2 py-1 text-xs rounded ${
                                          reg.payment_status === 'overdue'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                                        } transition-colors`}
                                      >
                                        Overdue
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Approved Registrations Section */}
              <div className="bg-card rounded-xl shadow-luxury border border-border">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Approved Registrations</h2>
                    <p className="text-muted-foreground mt-1">Students who have been approved and enrolled in courses</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {approvedRegistrations.length} Approved
                  </span>
                </div>
                <div className="p-6">
                  {approvedRegistrations.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No approved registrations yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Search for Approved Registrations */}
                      <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <input
                          type="text"
                          placeholder="Search approved registrations..."
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>

                      {/* Approved Registrations List */}
                      <div className="space-y-4">
                        {approvedRegistrations
                          .filter(reg =>
                            reg.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            reg.parent.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            reg.course.name.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((reg) => (
                            <div key={reg.id} className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h3 className="font-semibold text-foreground">{reg.student.name}</h3>
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                      Approved
                                    </span>
                                    {reg.payment_status && (
                                      <span className={`px-2 py-1 rounded-full text-xs ${
                                        reg.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                        reg.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        reg.payment_status === 'overdue' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        Payment: {reg.payment_status.charAt(0).toUpperCase() + reg.payment_status.slice(1)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                                    <div>{t('adminParent')}: {reg.parent.full_name}</div>
                                    <div>{t('adminEmail')}: {reg.parent.email}</div>
                                    <div className="text-primary font-medium">{t('adminCourse')}: {reg.course.name}</div>
                                    <div className="text-green-600 font-medium">{t('adminPrice')}: ${reg.course.price}</div>
                                    {reg.payment_date && (
                                      <div className="text-blue-600 font-medium">
                                        Payment Date: {new Date(reg.payment_date).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Approved: {new Date(reg.created_at).toLocaleDateString()} at {new Date(reg.created_at).toLocaleTimeString()}
                                  </p>
                                </div>
                                <div className="flex flex-col space-y-2 ml-4">
                                  <button
                                    onClick={() => handleViewRegistrationDetails(reg)}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  >
                                    <Eye className="w-4 h-4 inline mr-1" />
                                    {t('adminViewDetails')}
                                  </button>
                                  {/* Payment Status Controls */}
                                  <div className="flex flex-col space-y-1 pt-2 border-t border-border">
                                    <span className="text-xs font-medium text-muted-foreground mb-1">Payment Status:</span>
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'paid')}
                                        className={`px-2 py-1 text-xs rounded ${
                                          reg.payment_status === 'paid'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                                        } transition-colors`}
                                      >
                                        Paid
                                      </button>
                                      <button
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'pending')}
                                        className={`px-2 py-1 text-xs rounded ${
                                          reg.payment_status === 'pending'
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                        } transition-colors`}
                                      >
                                        Pending
                                      </button>
                                      <button
                                        onClick={() => handleUpdatePaymentStatus(reg.id, 'overdue')}
                                        className={`px-2 py-1 text-xs rounded ${
                                          reg.payment_status === 'overdue'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                                        } transition-colors`}
                                      >
                                        Overdue
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mobile-credentials' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">Mobile Credentials</h2>
                <p className="text-muted-foreground mt-1">{t('adminMobileCredentialsSubtitle')}</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">{t('adminLoadingCredentials')}</p>
                  </div>
                ) : mobileCredentials.length === 0 ? (
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
                              <h3 className="text-lg font-semibold text-foreground">{credential.name}</h3>
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
                                {credential.mobile_password || t('adminPasswordHidden')}
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(credential.mobile_password || '');
                                  toast.success(t('adminPasswordCopied'));
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

          {activeTab === 'students' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Students Management</h2>
                  <p className="text-muted-foreground mt-1">View and manage student information</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowStudentModal(true)}
                    className="px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300"
                  >
                    <UserPlus className="w-4 h-4 inline mr-2" />
                    Add Student
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
                    <p className="text-muted-foreground mt-2">Loading students...</p>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No students found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                        <option value="all">All Status</option>
                        <option value="mobile-enabled">Mobile Enabled</option>
                        <option value="mobile-disabled">Mobile Disabled</option>
                      </select>
                    </div>

                    {/* Students List */}
                    <div className="space-y-4">
                      {students
                        .filter(student =>
                          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.parent_email?.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .filter(student =>
                          filterStatus === 'all' ||
                          (filterStatus === 'mobile-enabled' && student.mobile_app_enabled) ||
                          (filterStatus === 'mobile-disabled' && !student.mobile_app_enabled)
                        )
                        .map((student) => (
                          <div key={student.id} className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="font-semibold text-foreground">{student.name}</h3>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    student.mobile_app_enabled
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {student.mobile_app_enabled ? 'Mobile Enabled' : 'Mobile Disabled'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div>Parent: {student.parent_name}</div>
                                  <div>Email: {student.parent_email}</div>
                                  <div>DOB: {new Date(student.date_of_birth).toLocaleDateString()}</div>
                                  {student.course_name && (
                                    <div className="text-primary font-medium">Course: {student.course_name}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col space-y-2 ml-4">
                                <button
                                  onClick={() => handleEditStudent(student)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                  <Edit className="w-3 h-3 inline mr-1" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleStudentMobile(student.id)}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                                    student.mobile_app_enabled
                                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                      : 'bg-green-600 text-white hover:bg-green-700'
                                  }`}
                                >
                                  {student.mobile_app_enabled ? 'Disable Mobile' : 'Enable Mobile'}
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(student.id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                >
                                  <Trash2 className="w-3 h-3 inline mr-1" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Users Management</h2>
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
                    <p className="text-muted-foreground mt-2">Loading users...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <input
                        type="text"
                        placeholder="Search users..."
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-background"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <select
                        className="px-3 py-2 border border-border rounded-lg bg-background"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="all">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="verified">Verified</option>
                        <option value="unverified">Unverified</option>
                      </select>
                    </div>

                    {/* Users List */}
                    <div className="space-y-4">
                      {users
                        .filter(user =>
                          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .filter(user =>
                          filterStatus === 'all' ||
                          (filterStatus === 'admin' && user.role === 'admin') ||
                          (filterStatus === 'user' && user.role === 'user') ||
                          (filterStatus === 'verified' && user.email_verified) ||
                          (filterStatus === 'unverified' && !user.email_verified)
                        )
                        .map((user) => (
                          <div key={user.id} className="bg-background rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="font-semibold text-foreground">{user.full_name}</h3>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    user.role === 'admin'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {user.role}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    user.email_verified
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {user.email_verified ? 'Verified' : 'Unverified'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div>Email: {user.email}</div>
                                  <div>Phone: {user.phone}</div>
                                  <div>Joined: {new Date(user.created_at).toLocaleDateString()}</div>
                                </div>
                              </div>
                              <div className="flex flex-col space-y-2 ml-4">
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                  <Edit className="w-3 h-3 inline mr-1" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleUserRole(user.id)}
                                  className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                                    user.role === 'admin'
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                  }`}
                                >
                                  {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                >
                                  <Trash2 className="w-3 h-3 inline mr-1" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Gallery Management</h2>
                  <p className="text-muted-foreground mt-1">Manage gallery images and content</p>
                </div>
                <button className="px-4 py-2 bg-gradient-gold text-secondary rounded-lg hover:shadow-luxury transition-all duration-300">
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Image
                </button>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Loading gallery...</p>
                  </div>
                ) : galleryItems.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No gallery items found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {galleryItems.map((item) => (
                      <div key={item.id} className="bg-background rounded-lg p-4 border border-border">
                        <div className="mb-3">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        </div>
                        <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex space-x-2">
                          <button className="flex-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                            <Edit className="w-3 h-3 inline mr-1" />
                            Edit
                          </button>
                          <button className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="bg-card rounded-xl shadow-luxury border border-border">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">Reports & Analytics</h2>
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

          {activeTab === 'contact' && (
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
                  defaultValue={editingStudent?.parent_name || ''}
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
                  defaultValue={editingStudent?.parent_email || ''}
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
                  defaultChecked={editingStudent?.mobile_app_enabled || false}
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
    </div>
  );
};

export default AdminDashboard;
