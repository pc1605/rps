# RPS Design Tokens

> **Single Source of Truth**:
> - Web: `apps/admin-web/app/globals.css` (CSS variables & Tailwind theme) + `apps/admin-web/lib/tokens.ts` (utility mapping).
> - Mobile: `apps/mobile/lib/theme.ts` (Unistyles theme object).
> - Shared constants: `packages/shared/src/index.ts`.

---

## 1. Core Principles

1. **The Amber Rule ("Act Here" Only)**: Amber (`--accent` / `#b45309` light, `#f59e0b` dark) represents urgent user attention or call-to-action. It is used exclusively for:
   - Primary action buttons ("Add batch", "Save", "Start cutting", "Scan units").
   - The "Ready for stitching" pipeline count and subnav dot (admin must assign workers).
   - "Assigned to you" card border highlight on mobile.
   - Interactive focus rings (`:focus-visible`).
   - It is **never** used as a generic aesthetic accent, status chip background, or decorative flourish.
2. **Phase Hues**: Each manufacturing phase has a dedicated, non-overlapping color:
   - Cutting: Blue (`#2563eb` light / `#60a5fa` dark)
   - Stitching: Purple (`#9333ea` light / `#c084fc` dark)
   - Packing: Teal (`#0f766e` light / `#2dd4bf` dark)
   - Completed: Green (`#15803d` light / `#4ade80` dark)
3. **Numerals are the Hero**: Production counts, roll meters, piece counts, and metrics are rendered with tabular figures (`tabular-nums` / `font-variant-numeric: tabular-nums`).
4. **Mono Only for Codes**: Monospace (`IBMPlexMono` / `font-mono`) is strictly reserved for machine-scannable and verifiable identifiers:
   - Batch codes (`B-261027-01`)
   - Roll codes (`R-005`)
   - Barcodes (`386100000018`)
   - Worker PINs and enrollment badges (`W-7890`)
   - Never use mono for regular UI labels, headers, or timestamps.
5. **Sentence Case**: All interface copy uses sentence case ("Add item", "Car model", "Ready for stitching", "Pieces per set", "Finished goods"). Title Case is prohibited except for proper nouns and acronyms (RPS, PVC, QR).

---

## 2. Color Tokens

### 2.1 Surfaces & Neutrals
Warm workshop neutrals tailored for manufacturing floors rather than corporate offices.

| Token (Web / Mobile) | Light | Dark | WCAG Role & Contrast |
|---|---|---|---|
| `--paper` / `bg` | `#fafaf7` | `#161514` | App background canvas |
| `--surface` / `surface` | `#ffffff` | `#1f1d1b` | Cards, modals, sheets |
| `--surface-2` / `surface2` | `#f3f2ee` | `#262321` | Secondary buttons, zebra stripes, hover states |
| `--line` / `border` | `#e6e3dc` | `#33302c` | Subtle structural borders |
| `--line-strong` / `borderStrong`| `#d3cfc6` | `#454039` | Input borders, elevated element outlines |

### 2.2 Ink (Typography)

| Token (Web / Mobile) | Light | Dark | Ratio on Canvas | Role |
|---|---|---|---|---|
| `--ink` / `text` | `#1c1917` | `#f5f5f0` | 16.7:1 (AA/AAA) | Primary headings, body copy, active labels |
| `--ink-muted` / `textMuted` | `#6b6560` | `#a8a29e` | 5.5:1 (AA) | Secondary descriptions, timestamps, table headers |
| `--ink-faint` / `textFaint` | `#9c958e` | `#6b6560` | UI / Non-text | Placeholder text, disabled labels |

### 2.3 Brand ("Act Here")

| Token (Web / Mobile) | Light | Dark | Ratio on Surface | Role |
|---|---|---|---|---|
| `--accent` / `accent` | `#b45309` | `#f59e0b` | 4.8:1 / 8.5:1 (AA) | "Act here": primary buttons, active task indicators |
| `--accent-fg` / `accentFg` | `#ffffff` | `#1c1917` | 5.0:1 / 8.1:1 (AA) | Text on primary brand buttons |
| `--accent-soft` / `accentSoft` | `rgba(180,83,9,0.10)` | `rgba(245,158,11,0.14)` | — | Accent chip tint, card callout wash |

### 2.4 Phases & Stations

| Phase / Station | Web Light / Dark | Mobile Light / Dark | Contrast on Surface | Meaning |
|---|---|---|---|---|
| **Cutting** (`cutter`) | `#2563eb` / `#60a5fa` | `#2563EB` / `#60A5FA` | 4.9:1 / 7.2:1 (AA) | Cutting station, cloth cutting logs |
| **Stitching** (`stitcher`) | `#9333ea` / `#c084fc` | `#9333EA` / `#C084FC` | 5.2:1 / 6.9:1 (AA) | Stitching station, piece stitching logs |
| **Packing** (`packer`) | `#0f766e` / `#2dd4bf` | `#0F766E` / `#2DD4BF` | 5.5:1 / 9.0:1 (AA) | Packing station, unit packing logs |
| **Completed** | `#15803d` / `#4ade80` | `#15803D` / `#4ADE80` | 5.0:1 / 9.6:1 (AA) | Finished goods, fully packed batches |

### 2.5 System States & Alerts

| State Token | Light | Dark | Usage |
|---|---|---|---|
| `--state-working` / `success` | `#15803d` | `#4ade80` | Operational status, active rolls, healthy workers |
| `--state-danger` / `danger` | `#b91c1c` | `#f87171` | Defective units, short-cut cuts, offline banners |
| `--state-info` / `info` | `#2563eb` | `#60a5fa` | Dispatched units, system announcements |

### 2.6 Mobile Scanner & Feedback Flashes

| Flash Key | Hex (Light & Dark) | Text Color | Contrast Ratio | Trigger / Meaning |
|---|---|---|---|---|
| `flash.ok` | `#15803D` | `#FFFFFF` | 5.0:1 (AA) | Valid unit scanned, quota incremented |
| `flash.dup` | `#B45309` | `#FFFFFF` | 5.0:1 (AA) | Duplicate barcode scanned |
| `flash.quota` | `#2563EB` | `#FFFFFF` | 5.2:1 (AA) | Worker quota reached for batch |
| `flash.err` | `#B91C1C` (L) / `#DC2626` (D) | `#FFFFFF` | 6.5:1 / 4.8:1 (AA) | Invalid barcode, wrong batch, or system error |

---

## 3. Typography Scale

Fonts: **IBM Plex Sans** (body, headings, UI) and **IBM Plex Mono** (codes, tabular data).

| Scale Step | Web Size / Leading | Mobile Size / Leading | Font Family & Weight |
|---|---|---|---|
| `display` | 40px (2.5rem) / 1.1 | 44px / 48px | Plex Sans SemiBold (600) |
| `stat` / `h1` | 28px (1.75rem) / 1.2 | 32px / 36px | Plex Sans SemiBold (600) |
| `title` / `h2` | 20px (1.25rem) / 1.35 | 24px / 30px | Plex Sans SemiBold (600) |
| `heading` | 18px (1.125rem) / 1.4 | 18px / 24px | Plex Sans SemiBold (600) |
| `body` | 15px (0.9375rem) / 1.5 | 16px / 24px | Plex Sans Regular (400) |
| `bodyMed` / `button` | 15px / 1.5 | 16px / 20px | Plex Sans Medium / SemiBold |
| `small` | 13px (0.8125rem) / 1.4 | 14px / 20px | Plex Sans Regular (400) |
| `caption` | 12px (0.75rem) / 1.35 | 12px / 16px | Plex Sans Medium (500) |
| `code` | 14px (0.875rem) / 1.4 | 14px / 20px | Plex Mono Medium (500) |
| `codeLarge` | 24px (1.5rem) / 1.3 | 24px / 30px | Plex Mono Medium (500) |

---

## 4. Spacing, Radii, Touch & Motion

### 4.1 Spacing (4-pt Grid)
- `xxs`: 4px
- `xs`: 8px
- `sm`: 12px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `xxl`: 48px

### 4.2 Radii
- `sm`: 6px (Chips, small badges, inline tags)
- `md`: 10px (Buttons, inputs, cards, dialogs)
- `lg`: 14px (Large modals, flash cards, containers)
- `pill`: 999px (Circular tags, dot badges)

### 4.3 Touch Sizes (Mobile & Coarse Pointers)
- `touch.min`: 48px (Strict minimum interactive touch target)
- `touch.primary`: 56px (Primary screen action buttons, scan triggers, steppers)

### 4.4 Motion
- Fast duration: `120ms` (`--dur-fast` / `motion.fast`)
- Base duration: `200ms` (`--dur` / `motion.base`)
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` globally clamps `animation-duration` and `transition-duration` to `0.01ms !important`. Pulse animations and transitions cease immediately.
