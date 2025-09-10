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

  // English categories
  'preschool': 'preschoolLevel',
  'primary': 'primaryLevel',
  'middle': 'middleLevel',
  'high': 'highLevel',
  'preschool and preparatory': 'preschoolLevel',
  'elementary': 'primaryLevel',
  'secondary': 'middleLevel',
  'high school': 'highLevel',

  // Case variations
  'Preschool': 'preschoolLevel',
  'Primary': 'primaryLevel',
  'Middle': 'middleLevel',
  'High': 'highLevel',
  'Middle School': 'middleLevel',
  'High School': 'highLevel',
};

// Category colors for visual distinction
export const CATEGORY_COLORS: { [key: string]: { bg: string; text: string; border: string } } = {
  preschoolLevel: {
    bg: 'bg-pink-100',
    text: 'text-pink-800',
    border: 'border-pink-200'
  },
  primaryLevel: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200'
  },
  middleLevel: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200'
  },
  highLevel: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200'
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
