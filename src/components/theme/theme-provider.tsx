"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { saveTheme } from "@/lib/actions/theme";

export type Theme = "dark" | "light";
const STORAGE_KEY = "adminTheme.v1";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}>({ theme: "dark", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Reflect on <html> so every CSS variable swaps at once
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    // Local copy avoids a flash before the account value loads next visit
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked — the account value still persists
    }
    saveTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Applies the saved theme before first paint so the page never flashes the
 * wrong palette. Rendered in <head> as a blocking inline script.
 */
export function ThemeScript({ fallback }: { fallback: Theme }) {
  const code = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    STORAGE_KEY
  )})||${JSON.stringify(fallback)};document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(
    fallback
  )});}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
