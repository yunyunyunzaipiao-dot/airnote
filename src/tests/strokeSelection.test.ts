import { describe, expect, it } from 'vitest'
import {
  cardIdsInFreeform,
  cardIdsInRectangle,
  selectionRect,
  strokeIdsInFreeform,
  strokeIdsInRectangle,
} from '../selection/strokeSelection'
import type { IdeaCard, Stroke } from '../types/workspace'

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

  it('selects cards by their center in rectangle and freeform regions', () => {
    const cards: IdeaCard[] = [
      { id: 'inside-card', kind: 'text', title: '内', content: '', position: { x: 10, y: 10 }, size: { width: 100, height: 80 }, textStyle: { bold: false, italic: false, underline: false, color: '#172B3A' } },
      { id: 'outside-card', kind: 'ink', title: '外', strokeIds: [], position: { x: 200, y: 200 }, size: { width: 100, height: 80 } },
    ]
    const polygon = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]
    expect(cardIdsInRectangle(cards, { x: 0, y: 0, width: 120, height: 120 })).toEqual(['inside-card'])
    expect(cardIdsInFreeform(cards, polygon)).toEqual(['inside-card'])
  })
})
