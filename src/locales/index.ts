import { arabicTranslations } from './ar';
import { englishTranslations } from './en';

export const translations = {
  ar: arabicTranslations,
  en: englishTranslations,
};

export type TranslationKey = keyof typeof arabicTranslations;
