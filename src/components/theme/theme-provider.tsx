"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { saveTheme } from "@/lib/actions/theme";

export type Theme = "dark" | "light";
const STORAGE_KEY = "adminTheme.v1";
const SYSTEM_KEY = "adminThemeSystem.v1";

const ThemeContext = createContext<{
  theme: Theme;
  followSystem: boolean;
  setTheme: (t: Theme) => void;
  setFollowSystem: (v: boolean) => void;
  toggle: () => void;
}>({
  theme: "dark",
  followSystem: false,
  setTheme: () => {},
  setFollowSystem: () => {},
  toggle: () => {},
});

function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [followSystem, setFollowSystemState] = useState(false);

  // Restore the "follow system" choice, which lives only on the device
  useEffect(() => {
    try {
      if (localStorage.getItem(SYSTEM_KEY) === "true") {
        setFollowSystemState(true);
        setThemeState(systemTheme());
      }
    } catch {
      // storage blocked — stick with the account value
    }
  }, []);

  // Track OS changes while "system" is selected
  useEffect(() => {
    if (!followSystem || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setThemeState(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [followSystem]);

  // Reflect on <html> so every CSS variable swaps at once. The transition
  // class is added only for the swap itself — leaving it on would make every
  // tap elsewhere in the app animate its colours.
  const first = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;

    if (first.current) {
      first.current = false;
      return;
    }
    root.classList.add("theme-switching");
    const id = setTimeout(() => root.classList.remove("theme-switching"), 260);
    return () => clearTimeout(id);
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

  const setFollowSystem = useCallback((value: boolean) => {
    setFollowSystemState(value);
    try {
      localStorage.setItem(SYSTEM_KEY, String(value));
    } catch {
      // ignore
    }
    if (value) {
      const next = systemTheme();
      setThemeState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      saveTheme(next);
    }
  }, []);

  const toggle = useCallback(() => {
    setFollowSystem(false);
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme, setFollowSystem]);

  return (
    <ThemeContext.Provider
      value={{ theme, followSystem, setTheme, setFollowSystem, toggle }}
    >
      {children}
    </ThemeContext.Provider>
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
