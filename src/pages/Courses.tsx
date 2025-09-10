import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslatedCategory } from '../utils/categoryUtils';
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
  created_at?: string;
  session_duration_hours?: number;
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

interface SectionEnrollment {
  enrollment_id: number;
  section: CourseSection;
  course: Course;
  enrolled_at: string;
}

interface Student {
  id: number;
  name: string;
  date_of_birth: string;
}

interface Registration {
  id: number;
  course: Course;
  student: Student;
  status: string;
  notes: string;
  created_at: string;
}

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const { translateCategory, getCategoryColors } = useTranslatedCategory();
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedPricingType, setSelectedPricingType] = useState('All');
  const [courseSections, setCourseSections] = useState<{[courseId: number]: CourseSection[]}>({});
  const [userEnrollments, setUserEnrollments] = useState<SectionEnrollment[]>([]);
  const [selectedCourseSections, setSelectedCourseSections] = useState<CourseSection[] | null>(null);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [filters, setFilters] = useState<any>(null);

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
    fetchFilters();
    if (user) {
      fetchStudents();
      fetchMyRegistrations();
      fetchUserEnrollments();
    }
  }, [user]); // Remove dependency on filter states to prevent re-fetching on filter changes

  useEffect(() => {
    filterCourses();
  }, [courses, searchTerm, selectedCategory, selectedLevel, selectedGrade, selectedSubject, selectedPricingType]);

  const fetchCourses = async () => {
    try {
      // Don't send any parameters initially to get all courses
      const response = await axios.get('/api/courses');
      setCourses(response.data.courses);
      setFilteredCourses(response.data.courses); // Initialize filtered courses with all courses
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const response = await axios.get('/api/courses/filters');
      setFilters(response.data.filters);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  const filterCourses = () => {
    let filtered = courses;

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

    setFilteredCourses(filtered);
  };

  const getUniqueCategories = () => {
    const categories = courses.map(course => course.category);
    return ['All', ...new Set(categories)];
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setStudents(response.data.user.students || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const fetchMyRegistrations = async () => {
    try {
      const response = await axios.get('/api/courses/my-registrations');
      setRegistrations(response.data.registrations || []);
    } catch (error: any) {
      console.error('Failed to fetch registrations:', error);
      if (error.response?.status === 503) {
        toast.error('Database temporarily unavailable. Registration status may not be accurate.');
      }
      setRegistrations([]); // Set empty array on error
    }
  };

  const fetchCourseSections = async (courseId: number) => {
    try {
      const response = await axios.get(`/api/courses/${courseId}/sections`);
      setCourseSections(prev => ({
        ...prev,
        [courseId]: response.data.sections
      }));
    } catch (error) {
      console.error('Failed to fetch course sections:', error);
    }
  };

  const fetchUserEnrollments = async () => {
    if (!user) return;
    
    try {
      const response = await axios.get('/api/courses/my-enrollments');
      setUserEnrollments(response.data.enrollments || []);
    } catch (error) {
      console.error('Failed to fetch user enrollments:', error);
    }
  };

  const getCourseRegistrationStatus = (courseId: number) => {
    const registration = registrations.find(reg => reg.course.id === courseId);
    return registration ? registration.status : null;
  };

  const handleRegister = async (courseId: number) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      await handleShowSections(course);
    }
  };

  const handleDirectRegistration = async (courseId: number) => {
    try {
      const response = await axios.post('/api/courses/register', {
        course_id: courseId,
        student_id: user?.id // Use the logged-in user's ID directly
      });

      setRegistrationSuccess(true);
      toast.success('Registration request submitted successfully!');
      // Refresh registrations to update the UI
      fetchMyRegistrations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registration failed');
    }
  };

  const handleShowSections = async (course: Course) => {
    if (!user) {
      toast.info(t('loginRequired'));
      navigate('/login');
      return;
    }

    // Fetch sections if not already loaded
    if (!courseSections[course.id]) {
      await fetchCourseSections(course.id);
    }

    const sections = courseSections[course.id] || [];
    if (sections.length === 0) {
      // No sections available, use direct registration
      await handleDirectRegistration(course.id);
    } else {
      // Show sections modal
      setSelectedCourse(course);
      setSelectedCourseSections(sections);
      setShowSectionsModal(true);
    }
  };

  const handleSectionEnrollment = async (sectionId: number) => {
    try {
      const response = await axios.post(`/api/courses/sections/${sectionId}/enroll`);
      toast.success('Successfully enrolled in section!');
      setShowSectionsModal(false);
      setSelectedCourse(null);
      setSelectedCourseSections(null);
      fetchUserEnrollments(); // Refresh enrollments
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Enrollment failed');
    }
  };

  const getUserSectionEnrollment = (courseId: number) => {
    return userEnrollments.find(enrollment => enrollment.course.id === courseId);
  };

  if (loading) {
    return (
      <div className={`w-full min-h-screen bg-background flex items-center justify-center ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loadingCoursesPage')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen bg-background py-20 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              {t('coursesPageTitle')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('coursesPageDesc')}
            </p>
          </div>

          {/* Search and Filter Section */}
          <div className="mb-8 bg-card rounded-xl shadow-luxury p-6 border border-border">
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
                    {filters?.levels?.map((level: any) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grade Filter */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('gradeLevel')}
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="block w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={selectedLevel === 'All'}
                  >
                    <option value="All">{t('allGrades')}</option>
                    {filters?.levels?.find((level: any) => level.id === selectedLevel)?.grades?.map((grade: any) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.name}
                      </option>
                    ))}
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
                    {filters?.subjects?.[selectedLevel]?.map((subject: string) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
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
                    <option value="session">{t('perSession')}</option>
                    <option value="monthly">{t('monthly')}</option>
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
                  مسح جميع المرشحات
                </button>
              </div>
            </div>

            {/* Results Count */}
            <div className="mt-4 text-sm text-muted-foreground">
              عرض {filteredCourses.length} من {courses.length} درس
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="text-center">
              <p className="text-muted-foreground">
                {courses.length === 0 ? 'No courses available at the moment' : 'No courses found matching your criteria'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => {
                const registrationStatus = getCourseRegistrationStatus(course.id);
                const sectionEnrollment = getUserSectionEnrollment(course.id);
                const isRegistered = registrationStatus !== null || sectionEnrollment !== undefined;
                
                return (
                  <div key={course.id} className="bg-card rounded-xl shadow-luxury overflow-hidden hover:shadow-dark transition-all duration-300 transform hover:-translate-y-2">
                    {course.image_url && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={course.image_url}
                          alt={getCourseName(course)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium px-2 py-1 rounded-full ${getCategoryColors(course.category).bg} ${getCategoryColors(course.category).text}`}>
                          {translateCategory(course.category)}
                        </span>
                        {isRegistered && (
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (registrationStatus === 'approved' || sectionEnrollment) 
                              ? 'bg-green-100 text-green-800' 
                              : registrationStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {(registrationStatus === 'approved' || sectionEnrollment) ? 'Enrolled' : registrationStatus?.charAt(0).toUpperCase() + registrationStatus?.slice(1)}
                          </div>
                        )}
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
                            <span className="font-medium capitalize text-sm">
                              {course.pricing_info.session_duration_hours ? `${course.pricing_info.session_duration_hours}h ${course.pricing_info.pricing_type === 'session' ? t('perSessionLabel') : t('monthlyLabel')}` : course.pricing_info.pricing_type === 'monthly' ? t('monthlyLabel') : t('perSessionLabel')}
                            </span>
                          </div>
                        )}
                      </div>

                      {isRegistered ? (
                        <div className="space-y-2">
                          <div className={`w-full py-3 px-4 rounded-lg font-medium text-center ${
                            (registrationStatus === 'approved' || sectionEnrollment) 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : registrationStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {(registrationStatus === 'approved' || sectionEnrollment) 
                              ? t('enrolled') 
                              : registrationStatus === 'pending'
                              ? t('registrationPending')
                              : t('registrationRejected')
                            }
                          </div>
                          {sectionEnrollment && (
                            <div className="text-xs text-center text-muted-foreground">
                              {getCourseName(sectionEnrollment.course)} - {sectionEnrollment.section.section_name}
                            </div>
                          )}
                          {registrationStatus === 'pending' && (
                            <div className="text-xs text-center text-muted-foreground">
                              {t('contactForUpdates')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRegister(course.id)}
                          className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 bg-gradient-gold text-secondary hover:shadow-luxury transform hover:scale-105`}
                        >
                          {t('registerNowCourses')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Student Selection Modal - REMOVED: Direct registration for logged-in user */}
      {/* Registration Success Modal */}
      {registrationSuccess && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl shadow-luxury max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{t('registrationSubmitted')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('registrationSubmittedDesc')} {getCourseName(selectedCourse)}
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  <strong>{t('statusPending')}</strong>
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('statusPendingDesc')}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  <strong>{t('contactInfo')}</strong>
                </p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  📞 0549322594
                </p>
              </div>
              <button
                onClick={() => {
                  setRegistrationSuccess(false);
                  setSelectedCourse(null);
                }}
                className="w-full bg-gradient-gold text-secondary py-3 px-4 rounded-lg font-medium hover:shadow-luxury transition-all duration-300"
              >
                {t('continueBrowsing')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Sections Modal */}
      {showSectionsModal && selectedCourse && selectedCourseSections && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl shadow-luxury max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-foreground mb-2">{t('chooseSection')}</h3>
              <p className="text-muted-foreground">
                {t('selectSectionDesc').replace('{{courseName}}', getCourseName(selectedCourse))}
              </p>
            </div>

            <div className="space-y-4">
              {selectedCourseSections.map((section) => (
                <div key={section.id} className="border border-border rounded-lg p-4 hover:border-primary transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground">{getCourseName(selectedCourse)} - {section.section_name}</h4>
                      <p className="text-sm text-muted-foreground">{section.schedule}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {section.current_students}/{section.max_students} {t('enrolled')}
                      </div>
                      {section.start_date && (
                        <div className="text-xs text-muted-foreground">
                          {t('starts')}: {new Date(section.start_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {section.current_students >= section.max_students ? (
                        <span className="text-red-500 font-medium">{t('sectionFull')}</span>
                      ) : (
                        <span className="text-green-500 font-medium">
                          {section.max_students - section.current_students} {t('seatsAvailable')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleSectionEnrollment(section.id)}
                      disabled={section.current_students >= section.max_students}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                        section.current_students >= section.max_students
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-gradient-gold text-secondary hover:shadow-luxury transform hover:scale-105'
                      }`}
                    >
                      {section.current_students >= section.max_students ? t('sectionFull') : t('enroll')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowSectionsModal(false);
                  setSelectedCourse(null);
                  setSelectedCourseSections(null);
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
