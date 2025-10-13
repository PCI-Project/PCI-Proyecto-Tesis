import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslations } from '../hooks/useTranslations';

const LANGUAGES = [
  { code: 'es', name: 'ES' },
  { code: 'en', name: 'EN' },
  { code: 'fr', name: 'FR' },
  { code: 'de', name: 'DE' },
  { code: 'pt', name: 'PT' },
  { code: 'zh', name: 'ZH' },
];

const FULL_LANG_NAMES: {[key: string]: string} = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  zh: "中文"
}

const ChevronDownIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

interface LanguageSwitcherProps {
  variant?: 'default' | 'in-menu';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'default' }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
  const selectedLanguageFullName = FULL_LANG_NAMES[selectedLanguage.code];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);
  
  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    setIsOpen(false);
  }
  
  if (variant === 'in-menu') {
    return (
       <div className="w-full relative" ref={wrapperRef}>
            <p className="px-4 text-xs font-bold uppercase text-text-muted mb-1">{t('header.language')}</p>
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg bg-bg-base/60 hover:bg-secondary/20 hover:text-secondary-dark text-text-base transition-colors flex items-center justify-between border border-border-muted"
              aria-haspopup="true"
              aria-expanded={isOpen}
            >
                <span>{selectedLanguageFullName}</span>
                <ChevronDownIcon className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}/>
            </button>

            {isOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-bg-surface p-1.5 rounded-lg shadow-lg border border-border-muted z-10">
                  {LANGUAGES.map(lang => (
                      <button
                          key={lang.code}
                          onClick={() => handleLanguageChange(lang.code)}
                          className={`w-full text-left px-3 py-2 text-base font-semibold rounded-md transition-colors flex items-center justify-between ${
                              language === lang.code
                                  ? 'bg-primary text-text-inverted'
                                  : 'text-text-base hover:bg-primary/10'
                          }`}
                      >
                          <span>{FULL_LANG_NAMES[lang.code]}</span>
                          <span className="text-xs font-bold">{lang.name}</span>
                      </button>
                  ))}
              </div>
            )}
        </div>
    );
  }

  // Default dropdown for the header
  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg border-2 border-border-muted hover:border-border-base transition-colors duration-200 text-text-muted hover:text-text-base"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t('header.language')}
      >
        <span>{selectedLanguage.name}</span>
        <ChevronDownIcon className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}/>
      </button>

      {isOpen && (
        <div 
          className="absolute top-full right-0 mt-2 w-48 bg-bg-surface rounded-xl shadow-lg border border-border-muted p-2 z-50"
          role="menu"
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex justify-between items-center transition-colors ${
                language === lang.code
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-text-base hover:bg-bg-base'
              }`}
              role="menuitem"
            >
              <span>{FULL_LANG_NAMES[lang.code]}</span>
              <span className="text-xs font-bold opacity-60">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
