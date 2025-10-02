import { useLanguage } from '../contexts/LanguageContext';

// Category mapping for educational levels
const CATEGORY_TRANSLATION_MAP: { [key: string]: string } = {
  // Arabic categories
  'روضة': 'preschoolLevel',
  'روضة وتمهيدي': 'preschoolLevel',
  'تمهيدي': 'preschoolLevel',
  'تحضيري': 'preschoolLevel',
  'ابتدائي': 'primaryLevel',
  'متوسط': 'middleLevel',
  'ثانوي': 'highLevel',
  'باكالوريا': 'bachelorLevel',

  // English categories
  'preschool': 'preschoolLevel',
  'primary': 'primaryLevel',
  'middle': 'middleLevel',
  'high': 'highLevel',
  'bachelor': 'bachelorLevel',
  'bachelore': 'bachelorLevel',
  'preschool and preparatory': 'preschoolLevel',
  'elementary': 'primaryLevel',
  'secondary': 'middleLevel',
  'high school': 'highLevel',

  // Case variations
  'Preschool': 'preschoolLevel',
  'Primary': 'primaryLevel',
  'Middle': 'middleLevel',
  'High': 'highLevel',
  'Bachelor': 'bachelorLevel',
  'Bachelore': 'bachelorLevel',
  'Middle School': 'middleLevel',
  'High School': 'highLevel',
};

// Category colors for visual distinction
export const CATEGORY_COLORS: { [key: string]: { bg: string; text: string; border: string } } = {
  preschoolLevel: {
    bg: 'bg-pink-600',
    text: 'text-white',
    border: 'border-pink-600'
  },
  primaryLevel: {
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-600'
  },
  middleLevel: {
    bg: 'bg-green-600',
    text: 'text-white',
    border: 'border-green-600'
  },
  highLevel: {
    bg: 'bg-purple-600',
    text: 'text-white',
    border: 'border-purple-600'
  },
  bachelorLevel: {
    bg: 'bg-orange-600',
    text: 'text-white',
    border: 'border-orange-600'
  }
};

// Function to get translated category
export const getTranslatedCategory = (category: string, t: (key: string) => string): string => {
  if (!category) return category;

  // First try to find exact match
  const translationKey = CATEGORY_TRANSLATION_MAP[category];
  if (translationKey) {
    return t(translationKey);
  }

  // Try case-insensitive match
  const lowerCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_TRANSLATION_MAP)) {
    if (key.toLowerCase() === lowerCategory) {
      return t(value);
    }
  }

  // If no match found, return original category
  return category;
};

// Function to get category color classes
export const getCategoryColorClasses = (category: string): { bg: string; text: string; border: string } => {
  if (!category) return CATEGORY_COLORS.preschoolLevel; // Default

  // First try to find exact match
  const translationKey = CATEGORY_TRANSLATION_MAP[category];
  if (translationKey && CATEGORY_COLORS[translationKey]) {
    return CATEGORY_COLORS[translationKey];
  }

  // Try case-insensitive match
  const lowerCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_TRANSLATION_MAP)) {
    if (key.toLowerCase() === lowerCategory && CATEGORY_COLORS[value]) {
      return CATEGORY_COLORS[value];
    }
  }

  // Default color
  return CATEGORY_COLORS.preschoolLevel;
};

// Hook to use translated category
export const useTranslatedCategory = () => {
  const { t } = useLanguage();

  const translateCategory = (category: string): string => {
    return getTranslatedCategory(category, t);
  };

  const getCategoryColors = (category: string) => {
    return getCategoryColorClasses(category);
  };

  return { translateCategory, getCategoryColors };
};
