// RPS mobile design tokens. Mirrors admin-web/app/globals.css.
// Fonts are loaded in app/_layout.tsx via @expo-google-fonts/ibm-plex-*.

const fonts = {
  regular: "IBMPlexSans_400Regular",
  medium: "IBMPlexSans_500Medium",
  semibold: "IBMPlexSans_600SemiBold",
  bold: "IBMPlexSans_700Bold",
  mono: "IBMPlexMono_500Medium",
} as const;

// 4-pt grid
const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
const touch = { min: 48, primary: 56 } as const;
const motion = { fast: 120, base: 200 } as const;

// With custom font files, weight lives in fontFamily — never set fontWeight alongside.
const text = {
  display: { fontSize: 44, lineHeight: 48, fontFamily: fonts.semibold },
  stat: { fontSize: 32, lineHeight: 36, fontFamily: fonts.semibold },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fonts.semibold },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.regular },
  bodyMed: { fontSize: 16, lineHeight: 24, fontFamily: fonts.medium },
  small: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.medium },
  code: { fontSize: 14, lineHeight: 20, fontFamily: fonts.mono },
  button: { fontSize: 16, lineHeight: 20, fontFamily: fonts.semibold },
  // legacy — kept so current screens render unchanged; P4 migrates them off these
  eyebrow: { fontSize: 12, lineHeight: 16, letterSpacing: 2, fontFamily: fonts.medium },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 1, fontFamily: fonts.medium },
} as const;

interface PhaseColors {
  cutting: string;
  stitching: string;
  packing: string;
  completed: string;
}
interface FlashColors {
  ok: string;
  dup: string;
  quota: string;
  err: string;
}

interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentFg: string;
  accentSoft: string;
  phase: PhaseColors;
  success: string;
  danger: string;
  dangerBg: string;
  warning: string;
  info: string;
  disabledBg: string;
  disabledFg: string;
  overlay: string;
  flash: FlashColors;
}

export interface AppTheme {
  isDark: boolean;
  fonts: typeof fonts;
  spacing: typeof spacing;
  radius: typeof radius;
  touch: typeof touch;
  motion: typeof motion;
  text: typeof text;
  colors: ThemeColors;
}

const light: ThemeColors = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surface2: "#F3F2EE",
  surfaceRaised: "#F3F2EE",
  border: "#E6E3DC",
  borderStrong: "#D3CFC6",
  text: "#1C1917",
  textMuted: "#6B6560",
  textFaint: "#9C958E",
  accent: "#B45309",
  accentFg: "#FFFFFF",
  accentSoft: "rgba(180,83,9,0.10)",
  phase: { cutting: "#2563EB", stitching: "#9333EA", packing: "#0D9488", completed: "#15803D" },
  success: "#16A34A",
  danger: "#B91C1C",
  dangerBg: "rgba(185,28,28,0.10)",
  warning: "#B45309",
  info: "#2563EB",
  disabledBg: "#E6E3DC",
  disabledFg: "#9C958E",
  overlay: "rgba(0,0,0,0.45)",
  flash: { ok: "#15803D", dup: "#B45309", quota: "#2563EB", err: "#B91C1C" },
};

const dark: ThemeColors = {
  bg: "#161514",
  surface: "#1F1D1B",
  surface2: "#262321",
  surfaceRaised: "#262321",
  border: "#33302C",
  borderStrong: "#454039",
  text: "#F5F5F0",
  textMuted: "#A8A29E",
  textFaint: "#6B6560",
  accent: "#F59E0B",
  accentFg: "#1C1917",
  accentSoft: "rgba(245,158,11,0.14)",
  phase: { cutting: "#60A5FA", stitching: "#C084FC", packing: "#2DD4BF", completed: "#4ADE80" },
  success: "#4ADE80",
  danger: "#F87171",
  dangerBg: "rgba(248,113,113,0.14)",
  warning: "#F59E0B",
  info: "#60A5FA",
  disabledBg: "#33302C",
  disabledFg: "#6B6560",
  overlay: "rgba(0,0,0,0.55)",
  flash: { ok: "#16A34A", dup: "#D97706", quota: "#2563EB", err: "#DC2626" },
};

export const lightTheme: AppTheme = {
  isDark: false,
  fonts,
  spacing,
  radius,
  touch,
  motion,
  text,
  colors: light,
};
export const darkTheme: AppTheme = {
  isDark: true,
  fonts,
  spacing,
  radius,
  touch,
  motion,
  text,
  colors: dark,
};
