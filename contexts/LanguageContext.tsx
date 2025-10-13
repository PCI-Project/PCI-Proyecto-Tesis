
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type LanguageContextType = {
  language: string;
  setLanguage: (language: string) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
        const savedLang = localStorage.getItem('pci-app-lang');
        return savedLang || 'es';
    } catch (e) {
        return 'es';
    }
  });

  useEffect(() => {
    try {
        localStorage.setItem('pci-app-lang', language);
    } catch(e) {
        console.error("Could not save language to localStorage.", e);
    }
  }, [language]);
  
  const setLanguage = (lang: string) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
