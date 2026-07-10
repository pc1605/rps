// Shared scales — identical in both themes
const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 36 } as const;
const radius = { sm: 8, md: 12, lg: 16 } as const;
const text = {
  eyebrow: { fontSize: 12, letterSpacing: 3, fontWeight: "600" as const },
  title: { fontSize: 32, fontWeight: "800" as const },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: "600" as const },
  body: { fontSize: 14 },
  button: { fontSize: 17, fontWeight: "700" as const },
} as const;

// Explicit color contract — string, not literals, so both themes fit
interface ThemeColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  accent: string;
  accentFg: string;
  text: string;
  textMuted: string;
  textFaint: string;
  danger: string;
  dangerBg: string;
  success: string;
  disabledBg: string;
  disabledFg: string;
}

export interface AppTheme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  text: typeof text;
}

export const darkTheme: AppTheme = {
  colors: {
    bg: "#141416",
    surface: "#1e1e21",
    surfaceRaised: "#26262a",
    border: "#2e2e32",
    accent: "#f59e0b",
    accentFg: "#141416",
    text: "#ffffff",
    textMuted: "#9a9a9f",
    textFaint: "#5c5c62",
    danger: "#f87171",
    dangerBg: "#3a1214",
    success: "#4ade80",
    disabledBg: "#3a3a3e",
    disabledFg: "#777777",
  },
  spacing,
  radius,
  text,
};

export const lightTheme: AppTheme = {
  colors: {
    bg: "#f7f6f3",
    surface: "#ffffff",
    surfaceRaised: "#ffffff",
    border: "#e4e2dd",
    accent: "#d97706",
    accentFg: "#ffffff",
    text: "#26241f",
    textMuted: "#6b6862",
    textFaint: "#a09d96",
    danger: "#dc2626",
    dangerBg: "#fee2e2",
    success: "#16a34a",
    disabledBg: "#e4e2dd",
    disabledFg: "#a09d96",
  },
  spacing,
  radius,
  text,
};
