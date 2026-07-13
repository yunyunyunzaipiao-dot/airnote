import {
  DEFAULT_SETTINGS,
  type AirNoteSettings,
  type BrushWidth,
  type WritingROI,
} from '../types/workspace'

export const SETTINGS_STORAGE_KEY = 'airnote.settings.current'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const BRUSH_WIDTHS = new Set<BrushWidth>([2, 4, 8])

export function normalizeBrushColor(value: string) {
  return HEX_COLOR.test(value) ? value.toUpperCase() : DEFAULT_SETTINGS.brush.color
}

export function isValidWritingROI(value: unknown): value is WritingROI {
  if (!value || typeof value !== 'object') return false
  const roi = value as WritingROI
  const values = [roi.left, roi.top, roi.right, roi.bottom]
  return values.every(Number.isFinite)
    && roi.left >= 0
    && roi.top >= 0
    && roi.right <= 1
    && roi.bottom <= 1
    && roi.right - roi.left >= 0.25
    && roi.bottom - roi.top >= 0.25
}

export function parseSettings(value: unknown): AirNoteSettings {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_SETTINGS)
  const candidate = value as Partial<AirNoteSettings>
  const down = candidate.gesture?.pinchDownThreshold
  const up = candidate.gesture?.pinchUpThreshold
  const thresholdsValid = Number.isFinite(down)
    && Number.isFinite(up)
    && (down as number) < (up as number)

  return {
    inputMode: candidate.inputMode === 'gesture' ? 'gesture' : 'mouse',
    brush: {
      color: normalizeBrushColor(candidate.brush?.color ?? ''),
      width: BRUSH_WIDTHS.has(candidate.brush?.width as BrushWidth)
        ? candidate.brush!.width
        : DEFAULT_SETTINGS.brush.width,
      style: 'ink',
    },
    gesture: {
      writingROI: isValidWritingROI(candidate.gesture?.writingROI)
        ? candidate.gesture.writingROI
        : DEFAULT_SETTINGS.gesture.writingROI,
      pinchDownThreshold: thresholdsValid ? down as number : DEFAULT_SETTINGS.gesture.pinchDownThreshold,
      pinchUpThreshold: thresholdsValid ? up as number : DEFAULT_SETTINGS.gesture.pinchUpThreshold,
      handPreference: 'any',
      calibrated: candidate.gesture?.calibrated === true && isValidWritingROI(candidate.gesture.writingROI),
      usesDefaultCalibration: candidate.gesture?.usesDefaultCalibration !== false,
    },
  }
}

export function loadSettings(storage: Pick<Storage, 'getItem'> = localStorage) {
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? parseSettings(JSON.parse(raw)) : structuredClone(DEFAULT_SETTINGS)
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export function saveSettings(
  settings: AirNoteSettings,
  storage: Pick<Storage, 'setItem'> = localStorage,
) {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
