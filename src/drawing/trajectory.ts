import type { CanvasPoint, NormalizedPoint } from '../types/m0'
import type { WritingROI } from '../types/workspace'

export const DEFAULT_EMA_ALPHA = 0.5
export const HORIZONTAL_FORWARD_ALPHA = 0.62
export const HORIZONTAL_ORTHOGONAL_ALPHA = 0.18
export const HORIZONTAL_DOMINANCE_RATIO = 4
export const MIN_POINT_DISTANCE = 2

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

  const normalizedX = (point.x - roi.left) / roiWidth
  const normalizedY = (point.y - roi.top) / roiHeight
  const mirroredX = Math.min(1, Math.max(0, 1 - normalizedX))
  const clampedY = Math.min(1, Math.max(0, normalizedY))
  return { x: mirroredX * width, y: clampedY * height }
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
