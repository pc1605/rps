# RPS Interaction & UI Patterns

This document defines the core interaction, form, layout, and scanner patterns across RPS Web and Mobile.

---

## 1. Web Page Anatomy

Every dashboard view follows a strict vertical hierarchy designed for fast glanceability:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PageHeader                                               │
│    h1 Title + Description + Primary Action Button(s)        │
├─────────────────────────────────────────────────────────────┤
│ 2. Metric & Stat Strip (Summary Cards)                      │
│    Hero Numerals (Tabular) · Contextual Hints               │
├─────────────────────────────────────────────────────────────┤
│ 3. Action Zone / Subnav Filters                             │
│    Phase Filters · Search · Date Range Presets              │
├─────────────────────────────────────────────────────────────┤
│ 4. Content Area (DataTable / Card Grid / Pipeline)          │
│    Data table (desktop) / Stacked cards (mobile)            │
└─────────────────────────────────────────────────────────────┘
```

1. **PageHeader**: Exactly one `<h1>` per page. Contains title, descriptive subtitle, optional back link, and primary creation/action triggers.
2. **Stat Strip**: High-level production figures (e.g., active batches, ready for stitching, completed today). Numerals are always tabular.
3. **Action Zone**: Search bars, stage tabs (`/batches?phase=ready`), or preset pickers (`today`, `yesterday`, `this_week`).
4. **Content Area**: The core interactive table or card list.

---

## 2. Form Conventions & Submission

### 2.1 Programmatic Label Linkage
Every form input and select trigger MUST have an explicit programmatic label:
- Form inputs: `<Label htmlFor="item-name">` paired with `<Input id="item-name">`.
- Select controls: `<Label htmlFor="item-brand">` paired with `<SelectTrigger id="item-brand">`.
- Visually hidden labels (`<Label className="sr-only">`) are used when adjacent inputs don't have separate visual headers.

### 2.2 Form Wrapping & Button Types
- Every dialog body containing form controls is wrapped in `<form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>`.
- Every `<Button>` inside a form MUST declare an explicit `type`:
  - `type="submit"` for the primary submission button.
  - `type="button"` for dismiss, cancel, or accessory buttons (such as barcode generators or copy buttons).

### 2.3 Verb-Matching Toasts
Notifications provide concise feedback confirming the completed action using active, past-tense verbs:
- `toast.success("Item added · barcode 386100000018")`
- `toast.success("Batch created")`
- `toast.success("Stitchers assigned")`
- `toast.error("Couldn't save item", { description: err.message })`

### 2.4 Destructive Confirmation
Destructive operations (cancelling a batch, marking a roll finished, deactivating an item) require explicit two-step user confirmation via an AlertDialog before mutation execution.

---

## 3. The Loading / Empty / Error Trio

Every dynamic view MUST implement all three states cleanly:

| State | Implementation | Behavior |
|---|---|---|
| **Loading** | `Skeleton` layout matching final components | Never show full-screen blank spinners. Match shape, count, and layout of cards/table rows. |
| **Empty** | `EmptyState` component | Provide a clear, non-generic icon, sentence-case title, and actionable explanation of next steps. |
| **Error** | Themed banner or error card with retry trigger | Explain what went wrong in non-technical terms and give an immediate retry button. |

---

## 4. Responsive Rules

### 4.1 Adaptive DataTable (< md)
- Viewports `>= 768px` (desktop/tablet landscape): Renders standard `<table>` with sticky headers and zebra hover.
- Viewports `< 768px` (mobile): Transforms into a list of stacked cards (`<ul>` / `<li>` / `Card`), pulling the designated `card: "title"` column as the card header and displaying other columns in a definition list (`<dl>`).

### 4.2 Modal Dialogs to Bottom Sheets (< sm)
- On desktop (`>= 640px`), modals render centered (`sm:max-w-md`).
- On mobile (`< 640px`), modals pin to the bottom of the viewport with slide-up animations, preserving thumb ergonomics.

### 4.3 Coarse Pointers & Touch Sizing
- Elements targeting mobile browsers or touch tablets utilize media queries (`@media (pointer: coarse)`) to ensure all interactive targets meet or exceed `48px` height and padding.

---

## 5. Mobile Task-Screen Anatomy

Task screens in the Expo app (`app/batch/[id].tsx`, `app/home.tsx`, `app/login.tsx`) adhere to industrial ergonomics:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Header Bar: Station / Worker name / Back trigger         │
├─────────────────────────────────────────────────────────────┤
│ 2. Scrollable Body:                                         │
│    - Batch metadata (Code, Model, Roll, Pieces)             │
│    - Worker quotas (e.g. "Your quota: 10 of 25")            │
│    - Stepper inputs or unit history                         │
├─────────────────────────────────────────────────────────────┤
│ 3. Bottom-Anchored Action Zone:                             │
│    - Primary action button (minHeight: 56px, full width)    │
│    - Pinned above safe area bottom insets                   │
│    - Always accessible without scrolling                    │
└─────────────────────────────────────────────────────────────┘
```

The bottom button is the "act here" zone. It uses full width and `theme.touch.primary` (56px) so workers wearing factory gloves or holding parts can hit it effortlessly.

---

## 6. Barcode & QR Scanner Rules

The scanner screen (`apps/mobile/app/scan/[batchId].tsx`) operates in noisy factory environments with rapid repeat scans:

### 6.1 Stable Scan Handler & Lock Ref
- Avoid re-triggering during camera frames using a mutable `scanningRef`:
```ts
const scanningRef = useRef(false);

const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
  if (scanningRef.current) return;
  scanningRef.current = true;
  try {
    await processScan(data);
  } finally {
    // Debounce window to prevent double-scan
    setTimeout(() => { scanningRef.current = false; }, 800);
  }
}, [processScan]);
```

### 6.2 Haptics Feedback Map
Workers listen to haptic vibrations when the phone screen is angled away:
- **Success (`flash.ok`)**: `Haptics.notificationAsync(NotificationFeedbackType.Success)`
- **Duplicate (`flash.dup`)**: `Haptics.notificationAsync(NotificationFeedbackType.Warning)`
- **Quota Reached (`flash.quota`)**: `Haptics.impactAsync(ImpactFeedbackStyle.Heavy)`
- **Error (`flash.err`)**: `Haptics.notificationAsync(NotificationFeedbackType.Error)`

### 6.3 Flash Feedback Map
Full-screen colored banner flashes for 1.5 seconds with high-contrast text:
- `flash.ok` (Green `#15803D`, white text): "Piece verified & logged".
- `flash.dup` (Amber `#B45309`, white text): "Already scanned in this batch".
- `flash.quota` (Blue `#2563EB`, white text): "Your quota is complete".
- `flash.err` (Red `#B91C1C` / `#DC2626`, white text): "Barcode does not match batch".

### 6.4 Live Accessibility Announcements
Whenever a scan processes, it triggers a screen reader announcement via:
`AccessibilityInfo.announceForAccessibility("Piece 12 scanned. 13 remaining.");`
This ensures workers using accessibility tools receive immediate spoken confirmation.
