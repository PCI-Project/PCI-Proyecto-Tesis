
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations/index';

// Helper function to safely access nested properties
const getNestedValue = (obj: any, path: string): string | undefined => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export const useTranslations = () => {
  const { language } = useLanguage();

  const t = React.useCallback((key: string, replacements?: { [key: string]: string | number }): string => {
    const langFile = (translations as any)[language] || translations['en'];
    let text = getNestedValue(langFile, key);

    // If key not found in current language, try fallback to English
    if (text === undefined) {
        const fallbackLangFile = translations['en'];
        text = getNestedValue(fallbackLangFile, key);
    }

    // If still not found, return the key itself
    if (text === undefined) {
        return key;
    }

    if (replacements) {
        Object.keys(replacements).forEach(placeholder => {
            text = text!.replace(`{${placeholder}}`, String(replacements[placeholder]));
        });
    }

    return text;
  }, [language]);

  return { t };
};
