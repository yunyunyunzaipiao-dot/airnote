# Design

<!-- impeccable:design-schema 1 -->

## Direction

**THESIS:** AirNote is a body-first creative tool; its interface must feel as immediate and unobtrusive as the gesture itself. The design refuses the warm-cream "creative app" default and the busy whiteboard density of Miro. Instead it adopts a calm, clinical-yet-friendly native-desktop grammar—large rounded surfaces, soft diffused shadows, and translucent panels that let the canvas breathe—so the user's ink and cards remain the protagonists.

**OWN-WORLD:** Apple-system minimalism translated for a gestural canvas. The palette is restrained neutral with a single electric-blue accent (`#0A84FF`). Surfaces are large-radius, border-thin, and shadow-soft. Every floating element (card, panel, toast) uses translucent white or dark glass with backdrop blur. Typography is the system stack at 15 px, medium weight, with no display face. The only strong color moments are the accent blue (selection, connections, primary actions) and the red alert (`#FF453A`).

**STORY:** The visitor opens a clean, light workspace. Their strokes appear in crisp ink by default. When they group strokes into cards, those cards lift off the canvas with a gentle shadow and rounded corners. Connections draw as calm blue curves. Errors and confirmations appear as small rounded pills that do not block the center. At night, the same structure inverts to dark glass without changing the ink or card content.

**FIRST VIEWPORT:** Full-bleed canvas on `#F7F8FA`. A translucent top bar floats at the top with tool icons and file actions. The canvas center is empty, inviting. No heavy chrome, no persistent sidebar, no hero imagery.

**FORM:** Single-page operate surface. The native grammar is macOS/iOS design language: SF-style spacing, 18 px radius cards, 8–10 px radius controls, and hierarchical shadow depths.

## Color

### Strategy
Restrained neutrals plus one accent. The accent (`#0A84FF`) carries selection, primary actions, and connections. No competing saturated hues. Dark mode is a true inverse, not a sepia or tinted dark.

### Tokens

| Token | Day | Night | Usage |
|-------|-----|-------|-------|
| `--background` | `#F7F8FA` | `#1C1C1E` | App/page background |
| `--foreground` | `#1D1D1F` | `#F5F5F7` | Primary text, icons |
| `--card` | `#ffffff` | `#2C2C2E` | Card and panel fill |
| `--card-foreground` | `#1D1D1F` | `#F5F5F7` | Text on cards |
| `--popover` | `#ffffff` | `#2C2C2E` | Dropdowns, menus |
| `--primary` | `#0A84FF` | `#0A84FF` | Accent, selection, links |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text on primary buttons |
| `--secondary` | `#F0F1F3` | `#3A3A3C` | Secondary buttons, tool bg |
| `--secondary-foreground` | `#1D1D1F` | `#F5F5F7` | Text on secondary surfaces |
| `--muted` | `#EDEEF1` | `#3A3A3C` | Disabled, subtle fills |
| `--muted-foreground` | `#6E6E73` | `#98989E` | Placeholder, captions, hints |
| `--accent` | `rgba(10,132,255,0.10)` | `rgba(10,132,255,0.18)` | Hover/select tint |
| `--accent-foreground` | `#0A84FF` | `#4DA3FF` | Text on accent surfaces |
| `--destructive` | `#FF453A` | `#FF453A` | Errors, delete, warnings |
| `--destructive-foreground` | `#ffffff` | `#ffffff` | Text on destructive buttons |
| `--border` | `rgba(29,29,31,0.10)` | `rgba(255,255,255,0.10)` | Card borders, dividers |
| `--input-background` | `#F0F1F3` | `#3A3A3C` | Text inputs, search fields |
| `--ring` | `rgba(10,132,255,0.40)` | `rgba(10,132,255,0.50)` | Focus rings |
| `--success` | `#30A46C` | `#30A46C` | Success states, confirmations |
| `--warning` | `#F59E0B` | `#F59E0B` | Warnings, caution |

### Rules
- Never use hard black (`#000000`) or hard white (`#FFFFFF`) for large surfaces; use `--card` and `--background`.
- Borders are always translucent; never use opaque gray borders.
- The canvas itself may stay slightly warmer than pure `#F7F8FA` if needed for ink contrast, but must not revert to the old cream `#e8e4d8`.
- Stroke colors are user-chosen and independent of theme; theme切换 must not rewrite stroke, card text, or exported image colors.

## Typography

- **Stack:** system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif.
- **Base size:** 15 px.
- **Weights:** 400 for body, 500 for labels, buttons, and headings.
- **Scale:**
  - H1: 24 px / 500 / 1.5
  - H2: 20 px / 500 / 1.5
  - H3: 18 px / 500 / 1.5
  - Body: 15 px / 400 / 1.5
  - Small: 13 px / 400 / 1.5 (card titles, panel headers)
  - Caption: 12 px / 400 / 1.5 (labels, hints, timestamps)
  - Micro: 11 px / 500 / 1.4 (badges, counters, tooltips)
  - Mono (for data): 12 px / 400 / 1.4, system monospace
- **Line length:** max 48 characters for card text; no justified text.

## Spacing

- **Base unit:** 4 px.
- **Radii:**
  - Cards, panels, modals: `18px`
  - Buttons, inputs, tags: `10px`
  - Small chips, icons: `8px`
  - Circles, avatars: `9999px`
- **Shadow depths:**
  - Level 1 (static card): `0 4px 24px rgba(20,24,32,0.07)`
  - Level 2 (hovered card): `0 8px 32px rgba(20,24,32,0.10)`
  - Level 3 (selected card): `0 0 0 2px rgba(10,132,255,0.18), 0 8px 32px rgba(20,24,32,0.10)`
  - Level 4 (floating panel): `0 8px 40px rgba(20,24,32,0.12)`
  - Level 5 (toast / blocking modal): `0 12px 48px rgba(20,24,32,0.16)`

## Components

### Canvas Background
- Fill: `--background`.
- No gradients, no textures, no grid lines by default. Optional subtle dot grid may be added later as a preference.

### Top Bar
- Translucent glass: `bg-white/80 backdrop-blur-md` (day) / `bg-[#2C2C2E]/80 backdrop-blur-md` (night).
- Border bottom: `1px solid --border`.
- Height: `52–56 px`.
- Icons: 20 px, `--foreground`, hover `bg-secondary`.
- Segmented controls (tool picker): `8 px` radius, `secondary` fill, `primary` for active segment.

### Idea Card (Ink)
- Fill: `--card` at `0.95` opacity with `backdrop-blur-lg`.
- Radius: `18 px`.
- Border: `1px solid --border`.
- Shadow: Level 1; Level 2 on hover; Level 3 when selected.
- Title area: `13 px` medium, `--foreground`; placeholder in `--muted-foreground` italic.
- Divider: `1px solid rgba(29,29,31,0.06)` (day) / `rgba(255,255,255,0.06)` (night).
- Ink content: SVG strokes rendered inside the card, clipped.
- Resize handles: `12 px` white squares with `2 px` `--primary` border, `3 px` radius, visible only on selected card.
- Edge anchors: `12 px` circles, `--primary` fill, white `2 px` border. Hidden by default, fade in on card hover.

### Idea Card (Text)
- Same shell as Ink card.
- Body: `12 px` / 400, `--foreground`.
- Editing mode: textarea with transparent background, no border, `12 px` text.

### Connection Line
- Stroke: `--primary` at `1.5 px`.
- Opacity: `0.5`.
- Undirected: `6 4` dash array.
- Directed: solid with arrow marker.
- Bidirectional: solid with arrows on both ends.
- Hit area: `14 px` transparent stroke for selection.

### Panel / Popover
- Fill: `--card` at `0.96` opacity with `backdrop-blur-lg`.
- Radius: `18 px`.
- Shadow: Level 4.
- Border: `1px solid --border`.
- Header: `12 px` semibold, bottom border `1px solid --border`.
- Content padding: `12 px`.

### Button
- Primary: `bg-primary text-primary-foreground`, radius `10 px`, padding `8 px 16 px`.
- Secondary: `bg-secondary text-secondary-foreground`, radius `10 px`.
- Ghost: transparent, hover `bg-accent`.
- Danger: `text-destructive`, hover `bg-destructive/8`.
- Focus: `ring-2 ring-ring`.

### Input / Textarea
- Background: `--input-background`.
- Radius: `8 px`.
- Border: none (background distinguishes the field).
- Focus: `ring-1 ring-ring`.
- Placeholder: `--muted-foreground`.

### Toast
- Day: `bg-[#1D1D1F]/92 text-white`.
- Night: `bg-[#3A3A3C]/95 text-white`.
- Radius: `16 px` (`rounded-2xl`).
- Shadow: Level 5.
- Error toasts are persistent until manually dismissed; others auto-dismiss.

### Tooltip
- `bg-[#1D1D1F] text-white text-[11px]`.
- Radius: `6 px`.
- Padding: `4 px 8 px`.

## States

### Selection
- Card: border turns `--primary`, shadow upgrades to Level 3.
- Stroke: stroke color becomes `--primary`, width `+1 px`.
- Multi-select: same border style on all selected cards.

### Hover
- Card: shadow upgrades to Level 2.
- Button: `bg-accent` or darken `5%`.
- Icon button: `bg-secondary`.

### Press / Active
- Scale to `0.98` on buttons and cards (fast, 80 ms).

### Disabled
- Opacity `0.45`, no hover transform, cursor `not-allowed`.

### Loading / Processing
- Spinner: `16 px`, `--primary`, stroke width `2 px`.
- Backdrop: none (non-blocking); or `rgba(255,255,255,0.4)` with blur for blocking modals.

### Error
- Blocking errors: centered modal with `--destructive` icon and title.
- Inline errors: `11 px` `--destructive` text beneath the field.
- Toast errors: persistent dark pill with red dot indicator.

## Motion

- **Default easing:** `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Durations:**
  - Micro (hover, active): `80–120 ms`
  - UI (open, close, switch): `180–220 ms`
  - Structural (card appear, canvas zoom): `260–320 ms`
- **Shadow transitions:** `transition-shadow duration-150`.
- **Transform transitions:** `transition-transform duration-150`.
- **Color transitions:** `transition-colors duration-150`.
- **Reduced motion:** when `prefers-reduced-motion` is active, disable Particle style, toast slide-ins, and card scale effects; keep opacity and color transitions only.

## Day / Night

- Toggle is a top-bar icon button (Sun / Moon).
- Preference saved to `localStorage`; default is Day.
- Switching updates CSS custom properties via a `.dark` class on `<html>` or root.
- Stroke colors, card text colors, brush colors, and exported PNG/JPG content must not change.
- Only UI chrome (backgrounds, borders, panels, tooltips) inverts.

## Accessibility

- Minimum contrast: `4.5:1` for normal text, `3:1` for large text and UI components.
- Focus indicators: `2 px` `--ring` outline, offset `2 px`. Never rely on color alone for state.
- All icon buttons have `aria-label`.
- Toast messages are `role="status"` or `role="alert"`.
- Modal dialogs trap focus and restore on close.
- Canvas elements (strokes, cards) expose keyboard alternatives where possible (e.g., Ctrl+Z, Delete).
