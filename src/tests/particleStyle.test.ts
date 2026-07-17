import { describe, expect, it } from 'vitest'
import { particleSamplesForStroke } from '../drawing/particleStyle'

describe('STYLE-01 deterministic Particle samples', () => {
  const stroke = {
    id: 'particle-stroke',
    points: [{ x: 0, y: 20, t: 0 }, { x: 60, y: 20, t: 16 }, { x: 120, y: 35, t: 32 }],
    width: 4 as const,
  }

  it('derives a stable soft particle field without modifying Stroke points', () => {
    const pointsBefore = structuredClone(stroke.points)
    const first = particleSamplesForStroke(stroke)
    const second = particleSamplesForStroke(stroke)

    expect(first).toEqual(second)
    expect(first.length).toBeGreaterThan(8)
    expect(first.some((particle) => particle.blur > 1)).toBe(true)
    expect(first.every((particle) => particle.radius < 3)).toBe(true)
    expect(first.some((particle) => Math.abs(particle.y - 20) > 1)).toBe(true)
    expect(stroke.points).toEqual(pointsBefore)
  })

  it('reduces static particle density for performance mode', () => {
    expect(particleSamplesForStroke(stroke, 'reduced').length).toBeLessThan(particleSamplesForStroke(stroke, 'full').length)
  })
})
