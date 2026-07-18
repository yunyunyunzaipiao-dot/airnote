import { describe, expect, it } from 'vitest'
import {
  adaptiveResizeHandlePosition,
  resizeCardFromHandle,
  type CardResizeHandle,
} from '../layout/cardResize'

const start = {
  position: { x: 100, y: 80 },
  size: { width: 300, height: 200 },
}
const stage = { width: 800, height: 600 }
const minimum = { width: 120, height: 96 }

describe('card resize geometry', () => {
  it.each([
    ['nw', { x: 40, y: 30 }, { x: 140, y: 110 }, { width: 260, height: 170 }],
    ['ne', { x: 40, y: 30 }, { x: 100, y: 110 }, { width: 340, height: 170 }],
    ['se', { x: 40, y: 30 }, { x: 100, y: 80 }, { width: 340, height: 230 }],
    ['sw', { x: 40, y: 30 }, { x: 140, y: 80 }, { width: 260, height: 230 }],
  ] as const)('resizes from the %s corner while keeping the opposite corner stable', (
    handle,
    delta,
    position,
    size,
  ) => {
    expect(resizeCardFromHandle(start, handle, delta, stage, minimum)).toEqual({ position, size })
  })

  it.each([
    ['nw', { x: 2000, y: 2000 }],
    ['ne', { x: -2000, y: 2000 }],
    ['se', { x: -2000, y: -2000 }],
    ['sw', { x: 2000, y: -2000 }],
  ] as const)('limits the %s corner to the minimum card size', (handle, delta) => {
    const result = resizeCardFromHandle(
      start,
      handle as CardResizeHandle,
      delta,
      stage,
      minimum,
    )
    expect(result.size).toEqual(minimum)
  })

  it('keeps adaptive corner controls inside the visible stage for an oversized card', () => {
    const oversized = {
      position: { x: -100, y: -50 },
      size: { width: 1200, height: 800 },
    }
    expect(adaptiveResizeHandlePosition(oversized, 'nw', stage)).toEqual({ left: 114, top: 64 })
    expect(adaptiveResizeHandlePosition(oversized, 'se', stage)).toEqual({ left: 886, top: 636 })
  })

  it('brings an oversized card back within the stage size on the first resize movement', () => {
    const oversized = {
      position: { x: 30, y: 30 },
      size: { width: 1400, height: 900 },
    }
    const result = resizeCardFromHandle(oversized, 'se', { x: -1, y: -1 }, stage, minimum)
    expect(result.size).toEqual(stage)
    expect(result.position).toEqual({ x: 30, y: 30 })
  })
})
