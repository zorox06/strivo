'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1020' : '#F5F7FB');
  }, [theme]);

  const setTheme = (t: Theme) => {
    sessionTheme = t;
    try {
      localStorage.setItem('strivo_theme', t);
    } catch {}
    window.dispatchEvent(new Event('strivo-theme-change'));
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

let sessionTheme: Theme | undefined;
function getTheme(): Theme {
  if (sessionTheme) return sessionTheme;
  try {
    const saved = localStorage.getItem('strivo_theme') ?? localStorage.getItem('smashelo_theme');
    return saved === 'light' ? 'light' : 'dark';
  } catch { return 'dark'; }
}

function subscribe(callback: () => void) {
  const onStorage = () => { sessionTheme = undefined; callback(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener('strivo-theme-change', callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('strivo-theme-change', callback);
  };
}

export function useTheme() {
  return useContext(ThemeContext);
}
