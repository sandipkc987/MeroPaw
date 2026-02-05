// Legacy theme - use useTheme() hook instead
export const THEME = {
  // Primary colors
  bg: "#ffffff",
  bgSecondary: "#f8fafc",
  accent: "#8b5cf6",
  accentLight: "#a78bfa",
  accentDark: "#7c3aed",
  accentVeryLight: "#ede9fe",
  
  // Card and surface colors
  card: "#ffffff",
  cardSecondary: "#f8fafc",
  surface: "#f1f5f9",
  surfaceHover: "#e2e8f0",
  
  // Text colors
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  textLight: "#94a3b8",
  
  // Interactive colors
  chip: "#e2e8f0",
  chipActive: "#dbeafe",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  
  // Status colors
  success: "#10b981",
  successLight: "#d1fae5",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  danger: "#ef4444",
  dangerLight: "#fecaca",
  error: "#ef4444",
  info: "#3b82f6",
  infoLight: "#dbeafe",
  
  // Utility colors
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent"
} as const;

export const RADIUS = { 
  xs: 4, 
  sm: 8, 
  md: 12, 
  lg: 16, 
  xl: 20, 
  xxl: 24, 
  pill: 999 
} as const;

export const SPACING = { 
  xs: 4, 
  sm: 8, 
  md: 12, 
  lg: 16, 
  xl: 20, 
  xxl: 24, 
  xxxl: 32 
} as const;

export const TYPOGRAPHY = {
  xs: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular" },
  sm: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  base: { fontSize: 16, lineHeight: 24, fontFamily: "Inter_400Regular" },
  lg: { fontSize: 18, lineHeight: 28, fontFamily: "Inter_400Regular" },
  xl: { fontSize: 20, lineHeight: 28, fontFamily: "Inter_400Regular" },
  "2xl": { fontSize: 24, lineHeight: 32, fontFamily: "Inter_400Regular" },
  "3xl": { fontSize: 30, lineHeight: 36, fontFamily: "Inter_400Regular" },
  "4xl": { fontSize: 36, lineHeight: 40, fontFamily: "Inter_400Regular" }
} as const;

// Fallback typography for development (when Instagram Sans is not available)
export const TYPOGRAPHY_FALLBACK = {
  xs: { fontSize: 12, lineHeight: 16, fontFamily: "System" },
  sm: { fontSize: 14, lineHeight: 20, fontFamily: "System" },
  base: { fontSize: 16, lineHeight: 24, fontFamily: "System" },
  lg: { fontSize: 18, lineHeight: 28, fontFamily: "System" },
  xl: { fontSize: 20, lineHeight: 28, fontFamily: "System" },
  "2xl": { fontSize: 24, lineHeight: 32, fontFamily: "System" },
  "3xl": { fontSize: 30, lineHeight: 36, fontFamily: "System" },
  "4xl": { fontSize: 36, lineHeight: 40, fontFamily: "System" }
} as const;

// Inter font weights (similar to Instagram Sans)
export const FONT_WEIGHTS = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium", 
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold"
} as const;

export const SHADOWS = {
  xs: { 
    shadowColor: "#000", 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    shadowOffset: { width: 0, height: 1 }, 
    elevation: 1 
  },
  sm: { 
    shadowColor: "#000", 
    shadowOpacity: 0.08, 
    shadowRadius: 6, 
    shadowOffset: { width: 0, height: 2 }, 
    elevation: 2 
  },
  md: { 
    shadowColor: "#000", 
    shadowOpacity: 0.12, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 4 
  },
  lg: { 
    shadowColor: "#000", 
    shadowOpacity: 0.15, 
    shadowRadius: 14, 
    shadowOffset: { width: 0, height: 6 }, 
    elevation: 8 
  },
  xl: { 
    shadowColor: "#000", 
    shadowOpacity: 0.2, 
    shadowRadius: 20, 
    shadowOffset: { width: 0, height: 8 }, 
    elevation: 12 
  }
} as const;
