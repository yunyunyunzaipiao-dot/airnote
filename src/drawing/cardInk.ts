import type { Stroke } from '../types/workspace'

export interface CardInkMetrics {
  origin: { x: number; y: number }
  size: { width: number; height: number }
}

export function cardInkMetrics(strokes: Stroke[]): CardInkMetrics | null {
  const points = strokes.flatMap((stroke) => stroke.points)
  if (points.length === 0) return null
  const minX = Math.min(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxX = Math.max(...points.map((point) => point.x))
  const maxY = Math.max(...points.map((point) => point.y))
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  const padding = Math.max(24, Math.min(width, height) * 0.1)
  return {
    origin: { x: minX - padding, y: minY - padding - 38 },
    size: { width: width + padding * 2, height: height + padding * 2 + 38 },
  }
}
