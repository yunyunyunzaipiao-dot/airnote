import { describe, expect, it } from 'vitest'
import {
  applyAxisAwareEma,
  applyEma,
  isPointFarEnough,
  mapMirroredPoint,
  stabilizeGesturePoint,
} from '../drawing/trajectory'

describe('M0 trajectory processing', () => {
  it('mirrors normalized x coordinates into CSS pixels', () => {
    expect(mapMirroredPoint({ x: 0.2, y: 0.25 }, 1000, 600)).toEqual({ x: 800, y: 150 })
  })

  it('uses EMA alpha 0.5 by default', () => {
    expect(applyEma({ x: 10, y: 20 }, { x: 30, y: 40 })).toEqual({ x: 20, y: 30 })
  })

  it('maps a calibrated ROI across the full canvas', () => {
    const roi = { left: 0.2, top: 0.2, right: 0.8, bottom: 0.8 }
    expect(mapMirroredPoint({ x: 0.2, y: 0.2 }, 100, 100, roi)).toEqual({ x: 100, y: 0 })
    expect(mapMirroredPoint({ x: 0.8, y: 0.8 }, 100, 100, roi)).toEqual({ x: 0, y: 100 })
  })

  it('uses the calibrated safety margin as edge tolerance instead of requiring extra reach', () => {
    const roi = { left: 0.152, top: 0.152, right: 0.848, bottom: 0.848 }
    const mapped = mapMirroredPoint({ x: 0.2, y: 0.5 }, 100, 100, roi)!
    expect(mapped.x).toBeGreaterThan(98)
    expect(mapped.y).toBeCloseTo(50)
  })

  it('holds stationary gesture jitter and follows deliberate movement adaptively', () => {
    expect(stabilizeGesturePoint({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 52, y: 51 })).toEqual({ x: 50, y: 50 })
    expect(stabilizeGesturePoint({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 56, y: 50 })).toEqual({ x: 51.08, y: 50 })
    expect(stabilizeGesturePoint({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 })).toEqual({ x: 74.8, y: 50 })
  })

  it('suppresses vertical jitter during horizontal movement', () => {
    expect(applyAxisAwareEma({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 2 })).toEqual({
      x: 6.2,
      y: 0.36,
    })
  })

  it('keeps balanced response for vertical movement', () => {
    expect(applyAxisAwareEma({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 10 })).toEqual({
      x: 1,
      y: 5,
    })
  })

  it('keeps balanced response for diagonal movement', () => {
    expect(applyAxisAwareEma({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 5 })).toEqual({
      x: 5,
      y: 2.5,
    })
  })

  it('rejects points closer than two CSS pixels', () => {
    expect(isPointFarEnough({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false)
    expect(isPointFarEnough({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true)
  })

  it('ignores non-finite and unreasonable coordinates', () => {
    expect(mapMirroredPoint({ x: Number.NaN, y: 0.5 }, 100, 100)).toBeNull()
    expect(mapMirroredPoint({ x: 3, y: 0.5 }, 100, 100)).toBeNull()
  })

})
