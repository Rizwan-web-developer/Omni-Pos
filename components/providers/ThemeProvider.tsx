"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ThemeMode } from "@/lib/types";

const STORAGE_KEY = "omnipos-theme";

interface ThemeContextValue {
  theme: ThemeMode;
  /** False until the client has read the pre-paint theme script result. */
  mounted: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readTheme(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-light");
  if (theme === "dark") root.classList.add("dark");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled — theme still applies for this session.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light (orange & white) is the default. The inline script in app/layout.tsx
  // applies the persisted choice before first paint.
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, mounted, setTheme, toggleTheme }),
    [theme, mounted, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
