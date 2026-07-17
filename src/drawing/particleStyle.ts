import type { Stroke } from '../types/workspace'

export interface ParticleSample {
  x: number
  y: number
  radius: number
  opacity: number
  blur: number
}

export type ParticleDensity = 'full' | 'reduced'

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

export function particleSamplesForStroke(
  stroke: Pick<Stroke, 'id' | 'points' | 'width'>,
  density: ParticleDensity = 'full',
): ParticleSample[] {
  if (stroke.points.length < 2) return []

  const samples: ParticleSample[] = []
  const spacing = Math.max(10, stroke.width * 2.8)
  const dotsPerAnchor = density === 'full' ? 2 : 1
  const spread = Math.max(5, stroke.width * 2)
  const nextRandom = random(hashText(stroke.id))
  let distanceToNext = 0

  for (let index = 1; index < stroke.points.length; index += 1) {
    const start = stroke.points[index - 1]
    const end = stroke.points[index]
    const deltaX = end.x - start.x
    const deltaY = end.y - start.y
    const segmentLength = Math.hypot(deltaX, deltaY)
    if (segmentLength === 0) continue

    while (distanceToNext <= segmentLength) {
      const ratio = distanceToNext / segmentLength
      const anchorX = start.x + deltaX * ratio
      const anchorY = start.y + deltaY * ratio
      const normalX = -deltaY / segmentLength
      const normalY = deltaX / segmentLength
      const tangentX = deltaX / segmentLength
      const tangentY = deltaY / segmentLength

      for (let dotIndex = 0; dotIndex < dotsPerAnchor; dotIndex += 1) {
        const normalOffset = (nextRandom() - 0.5) * spread
        const tangentOffset = (nextRandom() - 0.5) * spacing * 0.55
        samples.push({
          x: anchorX + normalX * normalOffset + tangentX * tangentOffset,
          y: anchorY + normalY * normalOffset + tangentY * tangentOffset,
          radius: 0.45 + nextRandom() * Math.max(1.1, stroke.width * 0.55),
          opacity: 0.26 + nextRandom() * 0.42,
          blur: 0.45 + nextRandom() * 1.4,
        })
      }
      distanceToNext += spacing
    }
    distanceToNext -= segmentLength
  }

  return samples
}
