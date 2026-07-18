import { describe, expect, it } from 'vitest'
import {
  selectionRect,
  strokeIdsInFreeform,
  strokeIdsInRectangle,
} from '../selection/strokeSelection'
import type { Stroke } from '../types/workspace'

function stroke(id: string, points: Array<{ x: number; y: number }>, cardId?: string): Stroke {
  return {
    id,
    points: points.map((point, index) => ({ ...point, t: index })),
    color: '#172B3A',
    width: 4,
    style: 'ink',
    createdAt: 0,
    cardId,
  }
}

describe('stroke selection geometry', () => {
  const strokes = [
    stroke('inside', [{ x: 10, y: 10 }, { x: 20, y: 20 }]),
    stroke('crossing', [{ x: -10, y: 15 }, { x: 50, y: 15 }]),
    stroke('outside', [{ x: 80, y: 80 }, { x: 90, y: 90 }]),
    stroke('carded', [{ x: 12, y: 12 }, { x: 18, y: 18 }], 'card-1'),
  ]

  it('normalizes rectangle direction and selects intersecting uncarded strokes', () => {
    const rect = selectionRect({ x: 40, y: 40 }, { x: 0, y: 0 })
    expect(rect).toEqual({ x: 0, y: 0, width: 40, height: 40 })
    expect(strokeIdsInRectangle(strokes, rect)).toEqual(['inside', 'crossing'])
  })

  it('selects strokes inside or crossing a freeform polygon', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ]
    expect(strokeIdsInFreeform(strokes, polygon)).toEqual(['inside', 'crossing'])
  })

  it('ignores tiny or incomplete selections', () => {
    expect(strokeIdsInRectangle(strokes, { x: 0, y: 0, width: 2, height: 2 })).toEqual([])
    expect(strokeIdsInFreeform(strokes, [{ x: 0, y: 0 }, { x: 20, y: 20 }])).toEqual([])
  })
})
