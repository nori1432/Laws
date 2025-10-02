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

export const getCourseName = (course: Course | {name: string, name_en?: string, name_ar?: string}, language: string): string => {
  if (language === 'ar' && course.name_ar) {
    return course.name_ar;
  }
  return course.name_en || course.name;
};

export const getCourseDescription = (course: Course, language: string): string => {
  if (language === 'ar' && course.description_ar) {
    return course.description_ar;
  }
  return course.description_en || course.description;
};

export const filterCoursesByLevel = (courses: Course[], selectedLevel: string, language: string): Course[] => {
  if (selectedLevel === 'All') return courses;

  return courses.filter(course => {
    const courseName = getCourseName(course, language).toLowerCase();
    
    // Define keywords for each level in both languages
    const levelKeywords = {
      'preschool': ['روضة', 'تمهيدي', 'تحضيري', 'preschool', 'preparatory', 'kindergarten'],
      'primary': ['ابتدائي', 'primary', 'elementary'],
      'middle': ['متوسط', 'middle', 'intermediate'],
      'high': ['ثانوي', 'high', 'secondary']
    };
    
    const keywords = levelKeywords[selectedLevel as keyof typeof levelKeywords] || [];
    return keywords.some(keyword => courseName.includes(keyword.toLowerCase()));
  });
};

export const filterCoursesBySubject = (courses: Course[], selectedSubject: string, language: string): Course[] => {
  if (selectedSubject === 'All') return courses;
  
  return courses.filter(course => {
    const courseName = getCourseName(course, language).toLowerCase();
    const courseDescription = getCourseDescription(course, language).toLowerCase();
    
    // Define subject mappings for both languages
    const subjectMappings: { [key: string]: string[] } = {
      // Mathematics
      'الرياضيات': ['الرياضيات', 'رياضيات', 'mathematics', 'math', 'algebra', 'geometry'],
      'Mathematics': ['الرياضيات', 'رياضيات', 'mathematics', 'math', 'algebra', 'geometry'],
      
      // Arabic Language
      'اللغة العربية': ['اللغة العربية', 'العربية', 'arabic', 'arab'],
      'Arabic': ['اللغة العربية', 'العربية', 'arabic', 'arab'],
      
      // English Language
      'اللغة الإنجليزية': ['اللغة الإنجليزية', 'الإنجليزية', 'إنجليزي', 'english'],
      'English': ['اللغة الإنجليزية', 'الإنجليزية', 'إنجليزي', 'english'],
      
      // Science
      'العلوم': ['العلوم', 'علوم', 'science', 'sciences'],
      'Science': ['العلوم', 'علوم', 'science', 'sciences'],
      
      // Physics
      'الفيزياء': ['الفيزياء', 'فيزياء', 'physics'],
      'Physics': ['الفيزياء', 'فيزياء', 'physics'],
      
      // Chemistry
      'الكيمياء': ['الكيمياء', 'كيمياء', 'chemistry'],
      'Chemistry': ['الكيمياء', 'كيمياء', 'chemistry'],
      
      // Biology
      'الأحياء': ['الأحياء', 'أحياء', 'biology'],
      'Biology': ['الأحياء', 'أحياء', 'biology'],
      
      // Social Studies
      'الدراسات الاجتماعية': ['الدراسات الاجتماعية', 'دراسات اجتماعية', 'social studies', 'history'],
      'Social Studies': ['الدراسات الاجتماعية', 'دراسات اجتماعية', 'social studies', 'history'],
      
      // Philosophy
      'الفلسفة': ['الفلسفة', 'فلسفة', 'philosophy'],
      'Philosophy': ['الفلسفة', 'فلسفة', 'philosophy']
    };
    
    // Get keywords for the selected subject
    const keywords = subjectMappings[selectedSubject] || [selectedSubject.toLowerCase()];
    
    return keywords.some(keyword => 
      courseName.includes(keyword.toLowerCase()) || 
      courseDescription.includes(keyword.toLowerCase())
    );
  });
};

export const filterCoursesBySearch = (courses: Course[], searchTerm: string, language: string): Course[] => {
  if (!searchTerm) return courses;
  
  const term = searchTerm.toLowerCase();
  return courses.filter(course => {
    const courseName = getCourseName(course, language).toLowerCase();
    const courseDescription = getCourseDescription(course, language).toLowerCase();
    
    return courseName.includes(term) || courseDescription.includes(term);
  });
};

export const filterCoursesByCategory = (courses: Course[], selectedCategory: string): Course[] => {
  if (selectedCategory === 'All') return courses;
  
  return courses.filter(course => course.category === selectedCategory);
};

export const filterCoursesByPricingType = (courses: Course[], selectedPricingType: string): Course[] => {
  if (selectedPricingType === 'All') return courses;
  
  return courses.filter(course => course.pricing_info?.pricing_type === selectedPricingType);
};

// Combined filter function for all filters
export const filterCourses = (
  courses: Course[],
  filters: {
    searchTerm?: string;
    category?: string;
    level?: string;
    subject?: string;
    pricingType?: string;
  },
  language: string
): Course[] => {
  let filtered = [...courses];
  
  // Apply search filter
  if (filters.searchTerm) {
    filtered = filterCoursesBySearch(filtered, filters.searchTerm, language);
  }
  
  // Apply category filter
  if (filters.category && filters.category !== 'All') {
    filtered = filterCoursesByCategory(filtered, filters.category);
  }
  
  // Apply level filter
  if (filters.level && filters.level !== 'All') {
    filtered = filterCoursesByLevel(filtered, filters.level, language);
  }
  
  // Apply subject filter
  if (filters.subject && filters.subject !== 'All') {
    filtered = filterCoursesBySubject(filtered, filters.subject, language);
  }
  
  // Apply pricing type filter
  if (filters.pricingType && filters.pricingType !== 'All') {
    filtered = filterCoursesByPricingType(filtered, filters.pricingType);
  }
  
  return filtered;
};