import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
        const savedTheme = localStorage.getItem('pci-app-theme') as Theme | null;
        // Also check user's system preference
        const userPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return savedTheme || (userPrefersDark ? 'dark' : 'light');
    } catch (e) {
        return 'light';
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);

    // Update the meta theme-color tag for a more immersive PWA experience
    const themeColor = theme === 'dark' ? '#14181E' : '#E6EBE0'; 
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);

    try {
        localStorage.setItem('pci-app-theme', theme);
    } catch(e) {
        console.error("Could not save theme to localStorage.", e);
    }
  }, [theme]);
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};