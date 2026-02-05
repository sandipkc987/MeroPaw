import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

const SETTINGS_KEY = "@kasper_settings";

interface Theme {
  isDark: boolean;
  colors: {
    bg: string;
    bgSecondary: string;
    card: string;
    cardSecondary: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    textLight: string;
    border: string;
    borderLight: string;
    accent: string;
    accentLight: string;
    accentDark: string;
    accentVeryLight: string;
    white: string;
    black: string;
    chip: string;
    chipActive: string;
    surface: string;
    surfaceHover: string;
    success: string;
    successLight: string;
    warning: string;
    warningLight: string;
    danger: string;
    dangerLight: string;
    error: string;
    info: string;
    infoLight: string;
  };
}

const lightTheme: Theme = {
  isDark: false,
  colors: {
    bg: "#ffffff",
    bgSecondary: "#f8fafc",
    card: "#ffffff",
    cardSecondary: "#f8fafc",
    text: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#64748b",
    textLight: "#94a3b8",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    accent: "#8b5cf6",
    accentLight: "#a78bfa",
    accentDark: "#7c3aed",
    accentVeryLight: "#ede9fe",
    white: "#ffffff",
    black: "#000000",
    chip: "#e2e8f0",
    chipActive: "#dbeafe",
    surface: "#f1f5f9",
    surfaceHover: "#e2e8f0",
    success: "#10b981",
    successLight: "#d1fae5",
    warning: "#f59e0b",
    warningLight: "#fef3c7",
    danger: "#ef4444",
    dangerLight: "#fecaca",
    error: "#ef4444",
    info: "#3b82f6",
    infoLight: "#dbeafe",
  },
};

const darkTheme: Theme = {
  isDark: true,
  colors: {
    bg: "#0f172a",
    bgSecondary: "#1e293b",
    card: "#1e293b",
    cardSecondary: "#334155",
    text: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#94a3b8",
    textLight: "#64748b",
    border: "#334155",
    borderLight: "#475569",
    accent: "#a78bfa",
    accentLight: "#c4b5fd",
    accentDark: "#8b5cf6",
    accentVeryLight: "#4c1d95",
    white: "#0f172a",
    black: "#ffffff",
    chip: "#334155",
    chipActive: "#1e40af",
    surface: "#1e293b",
    surfaceHover: "#334155",
    success: "#34d399",
    successLight: "#064e3b",
    warning: "#fbbf24",
    warningLight: "#451a03",
    danger: "#f87171",
    dangerLight: "#450a0a",
    error: "#f87171",
    info: "#60a5fa",
    infoLight: "#1e3a8a",
  },
};

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType extends Theme {
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  // Initialize theme based on system preference
  const getInitialTheme = () => {
    const systemIsDark = Appearance.getColorScheme() === "dark";
    return systemIsDark ? darkTheme : lightTheme;
  };
  const [theme, setTheme] = useState<Theme>(getInitialTheme());

  const applyTheme = useCallback((mode: ThemeMode) => {
    if (mode === "system") {
      const systemIsDark = Appearance.getColorScheme() === "dark";
      setTheme(systemIsDark ? darkTheme : lightTheme);
    } else {
      setTheme(mode === "dark" ? darkTheme : lightTheme);
    }
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          const savedTheme = settings.theme || "system";
          setThemeMode(savedTheme);
          applyTheme(savedTheme);
        } else {
          applyTheme("system");
        }
      } catch (e) {
        applyTheme("system");
      }
    };

    loadTheme();
  }, [applyTheme]);

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    });

    return () => listener.remove();
  }, [themeMode, applyTheme]);

  const setThemeHandler = async (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = saved ? JSON.parse(saved) : {};
      settings.theme = mode;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save theme", e);
    }
  };

  return (
    <ThemeContext.Provider value={{ ...theme, themeMode, setTheme: setThemeHandler }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};

