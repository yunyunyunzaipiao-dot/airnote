# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Visual creators and creative thinkers—designers, students, content creators, and digital artists—who want a more embodied, physical way to capture early ideas. They hire AirNote for 1–5 minute bursts of gestural ideation: drawing in the air, turning those strokes into named cards, and connecting them to see relationships.

**Secondary:** Short-term experiencers in exhibitions, classrooms, or demos who need to participate without learning complex rules or installing anything.

## Product Purpose

AirNote is a lightweight “air input + visual canvas” creative recorder. It lets users draw in mid-air with an ordinary webcam (pinch to draw, release to lift), then groups those strokes into moveable idea cards and connects them with lines. It exists to turn brief body gestures into persistent, re-organizable visual thinking material—without requiring XR hardware, client installation, or accounts.

## Positioning

AirNote’s meaningful difference is **body-first capture without device barriers**. Competitors either demand XR headsets and controllers (spatial drawing tools) or skip the body entirely (whiteboards, note apps). AirNote bridges the gap using only a laptop webcam and a pinch gesture, then immediately structures the output into cards and connections. It is deliberately not a full whiteboard (Miro, Excalidraw) and not a system input method; it is a single-session, local-first ideation tool where the stroke is the original truth and everything else (cards, OCR, visual effects) is layered on top.

## Operating Context

- **Environment:** Desktop web, Chrome/Edge preferred; HTTPS or localhost required for camera.
- **Session length:** Designed for 1–5 minutes of quick recording and reorganization.
- **Input modes:** Camera gesture (single-hand pinch) with mandatory mouse fallback; no external devices.
- **Workspace model:** Single local workspace per browser; no account, cloud sync, or multi-project gallery in MVP.
- **Privacy ritual:** User must actively click “Enable camera” after reading a short privacy notice; camera frames never recorded, saved, or uploaded by default.
- **Calibration:** 30-second one-time writing-area and pinch-threshold calibration; skippable with defaults.
- **Export artifacts:** PNG/JPG (visual output) and project JSON (editable backup with schemaVersion=2).
- **Design references:** 14 interface reference images in `docs/design/design-reference/`; Figma Make configuration maintained separately.

## Capabilities and Constraints

**Confirmed capabilities (P0):**
- Camera authorization, preview, single-hand landmark tracking, and pinch calibration.
- Gesture state machine: hover → draw → lift → lost-hand; forced lift on mode switch or tracking loss.
- Mouse fallback for all drawing, card, and edge operations.
- Stroke creation with EMA smoothing, 2 CSS-pixel sampling, color, and 2/4/8 px fixed widths.
- Undo/redo (≥50 steps) and confirmed workspace clear.
- Stroke grouping with 1.2 s idle timer; user-confirmed conversion to idea cards.
- Card move, rename, resize, delete (with confirmation and cascade delete of linked edges).
- Text cards with whole-card bold, italic, underline, and text color.
- Four-direction anchor connections (undirected/directed) between cards.
- Canvas pan and 25%–300% zoom.
- Rectangle and freehand lasso selection; Shift multi-select; group card move.
- Whole-stroke eraser (only on uncarded strokes).
- 6-step onboarding (skippable, re-openable from help).
- Local autosave (800 ms debounce) with validation and recovery.
- PNG/JPG export and safe project JSON import/export.
- Day/night theme toggle (local preference).

**Confirmed experimental capabilities (P1, switchable/gradable):**
- Optional OCR on user-selected cards (uploads cropped stroke image only after explicit consent).
- Visual render styles: Ink (default), Glow, Particle; degrades safely under low frame rate.
- Palm-open pause/resume gesture.

**Hard constraints:**
- No auto camera request; no default video recording/upload.
- Original Stroke.points are immutable; OCR and visual effects must not rewrite geometry.
- No account, backend, cloud sync, or multiplayer in MVP.
- No system-level input method; no full whiteboard SDK.
- API keys never in frontend code or exported JSON.
- All destructive actions require confirmation or are undoable.

## Brand Commitments

- **Name:** AirNote / 空书.
- **Voice:** Chinese-first, direct, privacy-transparent. Errors tell the user what happened and what to do next.
- **Personality:** Calm, minimal, respectful of the user’s body and data. The interface recedes so the gesture and the idea lead.
- **Visual defaults:** “Ink” is the canonical, stable look; Glow and Particle are experimental enhancements that must degrade gracefully. Day mode is default; night mode is a local preference.
- **Privacy promise:** Camera data stays in browser memory; any upload requires active user consent and explicit explanation of what is sent.

## Evidence on Hand

- Product background, AI-executable PRD, and product boundaries: `AirNote_01_产品背景文档_v0.3.docx`, `AirNote_02_产品需求文档_AI执行版_v0.3.docx`, `AirNote_03_产品边界文档_v0.3.docx`.
- Design reference images: `docs/design/design-reference/` (14 images).
- Figma Make configuration: maintained in a separate Figma file (not in repo).
- **Absent:** No real user research, testimonials, or usage metrics on hand; future work must not fabricate them.

## Product Principles

1. **Body first, then structure.** Let the gesture feel natural and immediate before adding features.
2. **The stroke is the source of truth.** Cards, OCR, and visual effects enhance the original ink; they never replace or destroy it.
3. **Graceful degradation.** Camera failure, permission denial, or low performance must never block core recording; mouse mode is always available.
4. **Transparent privacy.** Every sensor use is explicit, local by default, and optional when remote.
5. **Progressive enhancement.** Ink works everywhere; Glow, Particle, and OCR are layered on only when the user chooses and the device allows.

## Accessibility & Inclusion

- All gesture functions have mouse/keyboard alternatives (e.g., Ctrl/Cmd+Z for undo).
- Status feedback never relies on color alone.
- Respects `prefers-reduced-motion`: disables Particle and non-essential animations when the user prefers reduced motion.
