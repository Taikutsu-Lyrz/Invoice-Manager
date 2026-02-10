import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    actualTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme') as Theme;
        return saved || 'dark'; // Default to dark since that was the original
    });

    const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        const root = document.documentElement;

        const applyTheme = (isDark: boolean) => {
            if (isDark) {
                root.classList.add('dark');
                setActualTheme('dark');
            } else {
                root.classList.remove('dark');
                setActualTheme('light');
            }
        };

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            applyTheme(mediaQuery.matches);

            const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        } else {
            applyTheme(theme === 'dark');
        }
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, actualTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
