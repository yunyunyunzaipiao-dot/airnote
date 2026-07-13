import { describe, expect, it } from 'vitest'
import {
  applyAxisAwareEma,
  applyEma,
  isPointFarEnough,
  mapMirroredPoint,
} from '../drawing/trajectory'

describe('M0 trajectory processing', () => {
  it('mirrors normalized x coordinates into CSS pixels', () => {
    expect(mapMirroredPoint({ x: 0.2, y: 0.25 }, 1000, 600)).toEqual({ x: 800, y: 150 })
  })

  it('uses EMA alpha 0.5 by default', () => {
    expect(applyEma({ x: 10, y: 20 }, { x: 30, y: 40 })).toEqual({ x: 20, y: 30 })
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
