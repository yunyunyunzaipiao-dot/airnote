import type { CanvasPoint, NormalizedPoint } from '../types/m0'
import type { WritingROI } from '../types/workspace'

export const DEFAULT_EMA_ALPHA = 0.5
export const HORIZONTAL_FORWARD_ALPHA = 0.62
export const HORIZONTAL_ORTHOGONAL_ALPHA = 0.18
export const HORIZONTAL_DOMINANCE_RATIO = 4
export const MIN_POINT_DISTANCE = 2
export const CALIBRATED_ROI_INSET_RATIO = 0.06
export const GESTURE_DEAD_ZONE_PX = 3
export const GESTURE_SLOW_ALPHA = 0.18
export const GESTURE_MEDIUM_ALPHA = 0.35
export const GESTURE_FAST_ALPHA = 0.62

export function mapMirroredPoint(
  point: NormalizedPoint,
  width: number,
  height: number,
  roi: WritingROI = { left: 0, top: 0, right: 1, bottom: 1 },
): CanvasPoint | null {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < -0.25 ||
    point.x > 1.25 ||
    point.y < -0.25 ||
    point.y > 1.25 ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  const roiWidth = roi.right - roi.left
  const roiHeight = roi.bottom - roi.top
  if (roiWidth < 0.25 || roiHeight < 0.25) return null

  const usesCalibratedRoi = roi.left > 0 || roi.top > 0 || roi.right < 1 || roi.bottom < 1
  const horizontalInset = usesCalibratedRoi ? roiWidth * CALIBRATED_ROI_INSET_RATIO : 0
  const verticalInset = usesCalibratedRoi ? roiHeight * CALIBRATED_ROI_INSET_RATIO : 0
  const activeLeft = roi.left + horizontalInset
  const activeTop = roi.top + verticalInset
  const activeWidth = roiWidth - horizontalInset * 2
  const activeHeight = roiHeight - verticalInset * 2
  const normalizedX = (point.x - activeLeft) / activeWidth
  const normalizedY = (point.y - activeTop) / activeHeight
  const mirroredX = Math.min(1, Math.max(0, 1 - normalizedX))
  const clampedY = Math.min(1, Math.max(0, normalizedY))
  return { x: mirroredX * width, y: clampedY * height }
}

export function stabilizeGesturePoint(
  previousFiltered: CanvasPoint | null,
  previousRaw: CanvasPoint | null,
  current: CanvasPoint,
): CanvasPoint {
  if (!previousFiltered || !previousRaw) return current

  const distanceFromFiltered = Math.hypot(
    current.x - previousFiltered.x,
    current.y - previousFiltered.y,
  )
  if (distanceFromFiltered <= GESTURE_DEAD_ZONE_PX) return previousFiltered

  const rawStep = Math.hypot(current.x - previousRaw.x, current.y - previousRaw.y)
  const alpha = rawStep <= 8
    ? GESTURE_SLOW_ALPHA
    : rawStep <= 28
      ? GESTURE_MEDIUM_ALPHA
      : GESTURE_FAST_ALPHA
  const deltaX = Math.abs(current.x - previousRaw.x)
  const deltaY = Math.abs(current.y - previousRaw.y)
  const isHorizontal = deltaX >= deltaY * HORIZONTAL_DOMINANCE_RATIO

  return {
    x: alpha * current.x + (1 - alpha) * previousFiltered.x,
    y: (isHorizontal ? Math.min(alpha, HORIZONTAL_ORTHOGONAL_ALPHA) : alpha) * current.y
      + (1 - (isHorizontal ? Math.min(alpha, HORIZONTAL_ORTHOGONAL_ALPHA) : alpha)) * previousFiltered.y,
  }
}

export function applyEma(
  previous: CanvasPoint | null,
  current: CanvasPoint,
  alpha = DEFAULT_EMA_ALPHA,
): CanvasPoint {
  if (!previous) {
    return current
  }

  return {
    x: alpha * current.x + (1 - alpha) * previous.x,
    y: alpha * current.y + (1 - alpha) * previous.y,
  }
}

export function applyAxisAwareEma(
  previousFiltered: CanvasPoint | null,
  previousRaw: CanvasPoint | null,
  current: CanvasPoint,
): CanvasPoint {
  if (!previousFiltered || !previousRaw) {
    return current
  }

  const deltaX = Math.abs(current.x - previousRaw.x)
  const deltaY = Math.abs(current.y - previousRaw.y)
  const isHorizontal = deltaX >= deltaY * HORIZONTAL_DOMINANCE_RATIO
  const alphaX = isHorizontal ? HORIZONTAL_FORWARD_ALPHA : DEFAULT_EMA_ALPHA
  const alphaY = isHorizontal ? HORIZONTAL_ORTHOGONAL_ALPHA : DEFAULT_EMA_ALPHA

  return {
    x: alphaX * current.x + (1 - alphaX) * previousFiltered.x,
    y: alphaY * current.y + (1 - alphaY) * previousFiltered.y,
  }
}

export function isPointFarEnough(
  previous: CanvasPoint | null,
  current: CanvasPoint,
  minimumDistance = MIN_POINT_DISTANCE,
) {
  return !previous || Math.hypot(current.x - previous.x, current.y - previous.y) >= minimumDistance
}
