# RPS Primitives & Components

This document catalogs every reusable UI primitive across the Web and Mobile codebases.

---

## 1. Web Primitives (`apps/admin-web/components/rps/` & `ui/`)

### 1.1 `Chip` (`components/rps/chip.tsx`)
A compact status badge displaying semantic phase, roll state, or station.

- **Props**:
  - `tone`: `{ text: string; bg?: string; dot?: string; border?: string }`
  - `dot`: `boolean` (optional, defaults to false)
  - `children`: `React.ReactNode`
- **When to use**: Displaying batch phases, worker stations, unit statuses, or active roll flags.
- **Do / Don't**:
  - **Do**: Use predefined token mappings from `lib/tokens.ts` (`phaseTone`, `stationTone`, `unitTone`).
  - **Don't**: Hardcode ad-hoc Tailwind colors like `bg-blue-500` or `text-yellow-600`.
- **Usage**:
```tsx
import { Chip } from "@/components/rps/chip";
import { phaseTone } from "@/lib/tokens";

<Chip tone={phaseTone.stitching} dot>
  Stitching
</Chip>
```

---

### 1.2 `Stat` (`components/rps/stat.tsx`)
KPI and metric display highlighting key factory numerals.

- **Props**:
  - `label`: `React.ReactNode` (caption underneath or above)
  - `value`: `React.ReactNode` (primary numeral, rendered in tabular figures)
  - `hint`: `React.ReactNode` (optional contextual delta or subtext)
  - `accent`: `boolean` (optional, renders value in amber text when action is needed)
- **When to use**: Dashboard summary cards, batch headers, roll stock totals.
- **Do / Don't**:
  - **Do**: Render numeric values in tabular font to prevent layout jitter on polling.
  - **Don't**: Overuse `accent=true`; set accent only if attention is required (e.g. low stock, unassigned batch).
- **Usage**:
```tsx
import { Stat } from "@/components/rps/stat";

<Stat label="Cut pieces today" value={142} hint="Across 6 batches" />
```

---

### 1.3 `PageHeader` (`components/rps/section.tsx`)
The top title bar of every dashboard page. Provides the single `<h1>` for the document.

- **Props**:
  - `title`: `React.ReactNode`
  - `description`: `React.ReactNode` (optional)
  - `actions`: `React.ReactNode` (optional right-aligned action buttons)
  - `back`: `{ href: string; label: string }` (optional back button)
  - `mono`: `boolean` (optional, enables font-mono for batch detail codes)
- **When to use**: Always exactly once at the top of every dashboard view.
- **Do / Don't**:
  - **Do**: Use sentence case for `title` and provide actionable buttons via `actions`.
  - **Don't**: Render an `<h1>` anywhere else on the page.
- **Usage**:
```tsx
import { PageHeader } from "@/components/rps/section";
import { CreateBatchDialog } from "@/features/batches/components/create-batch-dialog";

<PageHeader
  title="Batches"
  description="Active floor work and completed lots."
  actions={<CreateBatchDialog />}
/>
```

---

### 1.4 `SectionTitle` (`components/rps/section.tsx`)
Section delimiter heading rendering an `<h2>`.

- **Props**:
  - `children`: `React.ReactNode`
  - `aside`: `React.ReactNode` (optional count, filter, or right-side text)
  - `className`: `string` (optional)
- **When to use**: Grouping tables, lists, or card grids under a named section.
- **Do / Don't**:
  - **Do**: Keep titles concise and in sentence case.
  - **Don't**: Use `<h3>` or raw `<div>` for primary section titles.
- **Usage**:
```tsx
import { SectionTitle } from "@/components/rps/section";

<SectionTitle aside={<span className="tabular font-medium text-foreground">12 rolls</span>}>
  Raw materials
</SectionTitle>
```

---

### 1.5 `EmptyState` (`components/rps/empty-state.tsx`)
A centered, dashed container shown when a collection or query returns no results.

- **Props**:
  - `title`: `string`
  - `body`: `string`
  - `icon`: `LucideIcon` (optional)
  - `action`: `React.ReactNode` (optional button or link)
- **When to use**: Empty table results, zero queue items, empty search filters.
- **Do / Don't**:
  - **Do**: Explain *why* it is empty and *what* the user should do next.
  - **Don't**: Leave blank space or display raw "No data found".
- **Usage**:
```tsx
import { PackageCheck } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";

<EmptyState
  icon={PackageCheck}
  title="Stockyard is empty"
  body="Mats land here automatically when the packer scans the last one in a batch."
/>
```

---

### 1.6 `DataTable` (`components/rps/data-table.tsx`)
Adaptive table component that renders as a full `<table>` on desktop (`>= md`) and responsive stacked cards on mobile (`< md`).

- **Props**:
  - `rows`: `T[]`
  - `columns`: `Column<T>[]` (`key`, `header`, `align`, `width`, `cell`, `card: "title" | "hide"`)
  - `rowKey`: `(row: T) => string`
  - `loading`: `boolean` (optional)
  - `empty`: `React.ReactNode` (optional)
  - `onRowClick`: `(row: T) => void` (optional, makes rows keyboard accessible)
- **When to use**: Listing batches, roll stock, workers, car items, productivity reports.
- **Do / Don't**:
  - **Do**: Mark one column with `card: "title"` for optimal mobile presentation.
  - **Don't**: Render horizontal scrolling tables on mobile viewports.
- **Usage**:
```tsx
import { DataTable } from "@/components/rps/data-table";

<DataTable
  rows={batches}
  columns={columns}
  rowKey={(b) => b.id}
  onRowClick={(b) => router.push(`/batches/${b.id}`)}
/>
```

---

### 1.7 `Skeleton` (`components/ui/skeleton.tsx`)
Pulsing placeholder mimicking the shape of upcoming content.

- **Props**: `React.ComponentProps<"div">`
- **When to use**: Initial loading states before React Query cache populates.
- **Do / Don't**:
  - **Do**: Match the height and count of the expected cards/rows.
  - **Don't**: Use full-page blocking spinners.
- **Usage**:
```tsx
import { Skeleton } from "@/components/ui/skeleton";

<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <Skeleton className="h-24 w-full" />
  <Skeleton className="h-24 w-full" />
  <Skeleton className="h-24 w-full" />
</div>
```

---

## 2. Mobile Primitives (`apps/mobile/components/ui/`)

### 2.1 `AppButton` (`components/ui/AppButton.tsx`)
Primary interactive button built on React Native `Pressable`.

- **Props**:
  - `title`: `string`
  - `onPress`: `() => void`
  - `variant`: `"primary" | "secondary" | "ghost" | "danger"` (default `"primary"`)
  - `size`: `"md" | "lg"` (minHeight: 48px or 56px, default `"lg"`)
  - `loading`: `boolean` (optional)
  - `disabled`: `boolean` (optional)
  - `icon`: `React.ReactNode` (optional)
  - `accessibilityRole`: `"button" | "link"`
  - `accessibilityLabel`: `string`
- **When to use**: Every user-triggered action on mobile (login, complete batch, scan unit).
- **Do / Don't**:
  - **Do**: Use `"primary"` only for the main action on the screen.
  - **Don't**: Place multiple primary amber buttons side-by-side.
- **Usage**:
```tsx
import { AppButton } from "@/components/ui/AppButton";

<AppButton
  title="Complete cutting"
  onPress={handleComplete}
  variant="primary"
  size="lg"
/>
```

---

### 2.2 `Chip` (`components/ui/Chip.tsx`)
Mobile status chip for batch phase, station, and unit state.

- **Props**:
  - `label`: `string`
  - `color`: `string` (optional hex color)
  - `dot`: `boolean` (optional)
- **When to use**: Batch cards on the queue screen, header badges in scanner.
- **Do / Don't**:
  - **Do**: Pass colors directly from `theme.colors.phase` or `theme.colors.success`.
  - **Don't**: Set fixed heights; let text and vertical padding control height.
- **Usage**:
```tsx
import { Chip } from "@/components/ui/Chip";
import { useTheme } from "@/lib/unistyles";

const { theme } = useTheme();
<Chip label="Stitching" color={theme.colors.phase.stitching} dot />
```

---

### 2.3 `Stat` (`components/ui/Stat.tsx`)
Hero numbers for worker queue and batch summary screens.

- **Props**:
  - `value`: `number | string`
  - `of`: `number | string` (optional denominator, e.g. `12 / 50`)
  - `label`: `string` (optional caption)
  - `big`: `boolean` (optional, uses display size 44pt)
- **When to use**: Displaying quotas (`10 / 25`), total pieces, target quantities.
- **Do / Don't**:
  - **Do**: Always use tabular numbers for figures.
  - **Don't**: Hardcode font weights alongside custom fonts.
- **Usage**:
```tsx
import { Stat } from "@/components/ui/Stat";

<Stat value={cutQty} of={targetQty} label="Pieces cut" big />
```

---

### 2.4 `Skeleton` (`components/ui/Skeleton.tsx`)
Placeholder wireframe blocks for mobile loading states.

- **Props**:
  - `height`: `number` (optional, default 20)
  - `width`: `number | DimensionValue` (optional, default "100%")
  - `radius`: `number` (optional)
  - `style`: `StyleProp<ViewStyle>`
- **When to use**: While worker queue batches or batch details are loading over Wi-Fi.
- **Do / Don't**:
  - **Do**: Match the outline of the batch card list.
  - **Don't**: Use blocking loading modals that prevent looking at already loaded data.
- **Usage**:
```tsx
import { Skeleton } from "@/components/ui/Skeleton";

<View style={{ gap: 12 }}>
  <Skeleton height={110} radius={10} />
  <Skeleton height={110} radius={10} />
</View>
```

---

### 2.5 `Banner` (`components/ui/Banner.tsx`)
Contextual notice banner for offline status, quota warnings, or errors.

- **Props**:
  - `kind`: `"info" | "warning" | "danger"`
  - `text`: `string`
  - `actionLabel`: `string` (optional)
  - `onAction`: `() => void` (optional)
- **When to use**: Network offline warnings, cutter lockout explanation, quota reach notice.
- **Do / Don't**:
  - **Do**: Ensure action pressables have programmatic accessibility labels.
  - **Don't**: Cover bottom primary buttons with banners.
- **Usage**:
```tsx
import { Banner } from "@/components/ui/Banner";

<Banner
  kind="warning"
  text="You are working offline. Scans will sync automatically."
  actionLabel="Retry"
  onAction={checkConnection}
/>
```

---

### 2.6 `Screen` (`components/ui/Screen.tsx`)
Root container providing safe area handling, keyboard avoiding, and themed background.

- **Props**:
  - `children`: `React.ReactNode`
  - `scroll`: `boolean` (optional, wraps in KeyboardAwareScrollView/ScrollView)
  - `style`: `StyleProp<ViewStyle>`
- **When to use**: Top-level container for every screen (`app/home.tsx`, `app/login.tsx`, `app/batch/[id].tsx`).
- **Do / Don't**:
  - **Do**: Use `Screen` for consistent insets and theme background rendering.
  - **Don't**: Manually write redundant SafeAreaView wrappers.
- **Usage**:
```tsx
import { Screen } from "@/components/ui/Screen";

export default function HomeScreen() {
  return (
    <Screen>
      {/* Content */}
    </Screen>
  );
}
```

---

### 2.7 `Card` (`components/ui/Card.tsx`)
Surface container with border, background, and rounded corners for grouping info.

- **Props**:
  - `children`: `React.ReactNode`
  - `style`: `StyleProp<ViewStyle>`
- **When to use**: Batch items in worker queues, stepper controls, form cards.
- **Do / Don't**:
  - **Do**: Use `theme.colors.surface` and standard `theme.radius.md`.
  - **Don't**: Apply heavy drop shadows; factory devices render borders more reliably.
- **Usage**:
```tsx
import { Card } from "@/components/ui/Card";

<Card style={styles.batchCard}>
  <Text style={styles.title}>B-261027-01</Text>
</Card>
```
