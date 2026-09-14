import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Theme = 'dark' | 'bright';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isBright: boolean;
}

const THEME_STORAGE_KEY = 'bounty_ui_theme';

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'bright' || stored === 'dark') {
      return stored;
    }
  } catch (e) {
    // Graceful fallback for restricted environments / private browsing
  }
  return 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Synchronize DOM classes and mobile meta theme-color
  const applyThemeToDom = useCallback((activeTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (activeTheme === 'bright') {
      root.classList.add('theme-bright');
      root.classList.remove('dark');
    } else {
      root.classList.remove('theme-bright');
      root.classList.add('dark');
    }

    // Update native mobile browser status bar tint
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', activeTheme === 'bright' ? '#f8fafc' : '#0b0c10');
    }
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme, applyThemeToDom]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Failed to persist theme to localStorage', e);
    }
    applyThemeToDom(newTheme);
  }, [applyThemeToDom]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'bright' : 'dark');
  }, [theme, setTheme]);

  const contextValue = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      isBright: theme === 'bright'
    }),
    [theme, toggleTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
