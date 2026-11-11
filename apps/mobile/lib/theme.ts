// RPS mobile design tokens. Mirrors admin-web/app/globals.css.
// Fonts are loaded in app/_layout.tsx via @expo-google-fonts/*.
import type { Language } from "./strings";

type Fonts = Record<"regular" | "medium" | "semibold" | "bold" | "mono", string>;

const fontsLatin: Fonts = {
  regular: "IBMPlexSans_400Regular",
  medium: "IBMPlexSans_500Medium",
  semibold: "IBMPlexSans_600SemiBold",
  bold: "IBMPlexSans_700Bold",
  mono: "IBMPlexMono_500Medium",
};

// IBM Plex Sans has no Devanagari letters. Noto Sans Devanagari also has Latin letters and digits,
// so a Hindi line with a name or a number in it renders in one font. Codes keep the mono font.
const fontsHindi: Fonts = {
  regular: "NotoSansDevanagari_400Regular",
  medium: "NotoSansDevanagari_500Medium",
  semibold: "NotoSansDevanagari_600SemiBold",
  bold: "NotoSansDevanagari_700Bold",
  mono: "IBMPlexMono_500Medium",
};

// 4-pt grid
const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
const touch = { min: 48, primary: 56 } as const;
const motion = { fast: 120, base: 200 } as const;

// With custom font files, weight lives in fontFamily — never set fontWeight alongside.
// Hindi: Devanagari marks sit above and below the letters, so every line height is at least
// 1.4 × the font size (else Android clips them), and letter spacing is 0 (it breaks words apart).
function textFor(fonts: Fonts, hindi: boolean) {
  const lh = (latin: number, devanagari: number) => (hindi ? devanagari : latin);
  const ls = (latin: number) => (hindi ? 0 : latin);
  return {
    display: { fontSize: 44, lineHeight: lh(48, 62), fontFamily: fonts.semibold },
    stat: { fontSize: 32, lineHeight: lh(36, 46), fontFamily: fonts.semibold },
    title: { fontSize: 24, lineHeight: lh(30, 34), fontFamily: fonts.semibold },
    heading: { fontSize: 18, lineHeight: lh(24, 26), fontFamily: fonts.semibold },
    body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.regular },
    bodyMed: { fontSize: 16, lineHeight: 24, fontFamily: fonts.medium },
    small: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
    caption: { fontSize: 12, lineHeight: lh(16, 18), fontFamily: fonts.medium },
    code: { fontSize: 14, lineHeight: 20, fontFamily: fonts.mono },
    codeLarge: { fontSize: 24, lineHeight: 30, fontFamily: fonts.mono },
    button: { fontSize: 16, lineHeight: lh(20, 24), fontFamily: fonts.semibold },
    eyebrow: { fontSize: 12, lineHeight: lh(16, 18), letterSpacing: ls(2), fontFamily: fonts.medium },
    label: { fontSize: 12, lineHeight: lh(16, 18), letterSpacing: ls(1), fontFamily: fonts.medium },
    emoji: { fontSize: 32, lineHeight: 36 },
  };
}

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
  overlaySurface: string;
  overlayText: string;
  overlayTextMuted: string;
  overlayBorder: string;
  cameraBg: string;
  flash: FlashColors;
}

export interface AppTheme {
  isDark: boolean;
  fonts: Fonts;
  spacing: typeof spacing;
  radius: typeof radius;
  touch: typeof touch;
  motion: typeof motion;
  text: ReturnType<typeof textFor>;
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
  phase: { cutting: "#2563EB", stitching: "#9333EA", packing: "#0F766E", completed: "#15803D" },
  success: "#15803D",
  danger: "#B91C1C",
  dangerBg: "rgba(185,28,28,0.10)",
  warning: "#B45309",
  info: "#2563EB",
  disabledBg: "#E6E3DC",
  disabledFg: "#9C958E",
  overlay: "rgba(0,0,0,0.45)",
  overlaySurface: "rgba(0,0,0,0.60)",
  overlayText: "#FFFFFF",
  overlayTextMuted: "rgba(255,255,255,0.80)",
  overlayBorder: "rgba(255,255,255,0.85)",
  cameraBg: "#000000",
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
  overlaySurface: "rgba(0,0,0,0.60)",
  overlayText: "#FFFFFF",
  overlayTextMuted: "rgba(255,255,255,0.80)",
  overlayBorder: "rgba(255,255,255,0.85)",
  cameraBg: "#000000",
  flash: { ok: "#15803D", dup: "#B45309", quota: "#2563EB", err: "#DC2626" },
};

/** Light and dark theme for a language: same colours and sizes, the font and line heights differ. */
export function themesFor(language: Language): { light: AppTheme; dark: AppTheme } {
  const hindi = language === "hi";
  const fonts = hindi ? fontsHindi : fontsLatin;
  const base = { fonts, spacing, radius, touch, motion, text: textFor(fonts, hindi) };
  return {
    light: { isDark: false, ...base, colors: light },
    dark: { isDark: true, ...base, colors: dark },
  };
}
