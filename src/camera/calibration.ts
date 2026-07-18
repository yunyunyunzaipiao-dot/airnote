import type { NormalizedPoint } from '../types/m0'
import { DEFAULT_SETTINGS, type GestureSettings, type WritingROI } from '../types/workspace'

export const ROI_TARGETS = ['左上', '右上', '右下', '左下'] as const
const SAFETY_MARGIN_RATIO = 0.08
const MIN_ROI_SIZE = 0.25
const PINCH_CONTACT_MARGIN = 0.08
const MAX_PINCH_DOWN_THRESHOLD = 0.45

export interface PinchCycle {
  pinch: number
  release: number
}

export interface CalibrationDraft {
  roiPoints: NormalizedPoint[]
  pinchCycles: PinchCycle[]
  pendingPinch: number | null
}

export function createCalibrationDraft(): CalibrationDraft {
  return { roiPoints: [], pinchCycles: [], pendingPinch: null }
}

export function calculateWritingROI(points: NormalizedPoint[]): WritingROI | null {
  if (points.length !== 4 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return null
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY
  if (width < MIN_ROI_SIZE || height < MIN_ROI_SIZE) return null

  const horizontalMargin = width * SAFETY_MARGIN_RATIO
  const verticalMargin = height * SAFETY_MARGIN_RATIO
  return {
    left: Math.max(0, minX - horizontalMargin),
    top: Math.max(0, minY - verticalMargin),
    right: Math.min(1, maxX + horizontalMargin),
    bottom: Math.min(1, maxY + verticalMargin),
  }
}

function median(values: number[]) {
  const ordered = [...values].sort((first, second) => first - second)
  return ordered[Math.floor(ordered.length / 2)]
}

export function calculatePinchThresholds(cycles: PinchCycle[]) {
  if (
    cycles.length !== 3
    || cycles.some(({ pinch, release }) => !Number.isFinite(pinch) || !Number.isFinite(release) || pinch >= release)
  ) {
    return null
  }

  const pinch = median(cycles.map((cycle) => cycle.pinch))
  const release = median(cycles.map((cycle) => cycle.release))
  if (release - pinch < 0.08) return null

  // Landmark tips still retain a small model-dependent gap when fingers touch.
  // Keep calibration at least as permissive as the validated default so a
  // threshold captured with one hand remains usable after switching hands.
  const down = Math.min(
    MAX_PINCH_DOWN_THRESHOLD,
    Math.max(DEFAULT_SETTINGS.gesture.pinchDownThreshold, pinch + PINCH_CONTACT_MARGIN),
  )
  const up = Math.min(0.8, Math.max(down + 0.06, release * 0.9))
  return down < up ? { down, up } : null
}

export function finalizeCalibration(draft: CalibrationDraft): GestureSettings {
  const writingROI = calculateWritingROI(draft.roiPoints)
  const thresholds = calculatePinchThresholds(draft.pinchCycles)
  if (!writingROI) throw new Error('roi-too-small')

  return {
    writingROI,
    pinchDownThreshold: thresholds?.down ?? DEFAULT_SETTINGS.gesture.pinchDownThreshold,
    pinchUpThreshold: thresholds?.up ?? DEFAULT_SETTINGS.gesture.pinchUpThreshold,
    handPreference: 'any',
    calibrated: true,
    usesDefaultCalibration: thresholds === null,
  }
}
