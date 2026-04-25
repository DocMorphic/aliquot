"use client";

import { createContext, useContext, useEffect, useCallback } from "react";
import type { ThemeMode, ThemeState } from "@/lib/types";
import { STORAGE_KEYS, DEFAULT_THEME } from "@/lib/constants";
import { useLocalStorage } from "./use-local-storage";

interface ThemeContextValue extends ThemeState {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setBrightness: (value: number) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function useThemeProvider(): ThemeContextValue {
  const [mode, setModeRaw] = useLocalStorage<ThemeMode>(STORAGE_KEYS.theme, DEFAULT_THEME.mode);
  const [brightness, setBrightnessRaw] = useLocalStorage<number>(
    STORAGE_KEYS.brightness,
    DEFAULT_THEME.brightness
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.style.setProperty("--display-brightness", String(brightness / 100));
  }, [brightness]);

  const setMode = useCallback((m: ThemeMode) => setModeRaw(m), [setModeRaw]);
  const toggleMode = useCallback(
    () => setModeRaw((prev) => (prev === "dark" ? "light" : "dark")),
    [setModeRaw]
  );
  const setBrightness = useCallback(
    (v: number) => setBrightnessRaw(Math.max(70, Math.min(100, v))),
    [setBrightnessRaw]
  );

  return {
    mode,
    brightness,
    setMode,
    toggleMode,
    setBrightness,
  };
}
