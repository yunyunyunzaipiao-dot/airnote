import { describe, expect, it } from 'vitest'
import {
  addStrokeToCurrentGroup,
  automaticEdgeAnchors,
  cardAnchorPoint,
  createCardFromCurrentGroup,
  createEdge,
  createWorkspaceDocument,
  deleteCard,
  moveCard,
  renameCard,
  resizeCard,
  suggestCurrentGroup,
  updateEdgeType,
} from '../store/workspaceDocument'
import type { Stroke } from '../types/workspace'

function stroke(id: string, x = 10): Stroke {
  return { id, points: [{ x, y: 10, t: 0 }, { x: x + 20, y: 30, t: 1 }], color: '#172B3A', width: 4, style: 'ink', createdAt: 0 }
}

describe('M2 workspace document', () => {
  it('groups strokes, suggests once, and creates a card without rewriting points', () => {
    const original = stroke('s1')
    const grouped = addStrokeToCurrentGroup(createWorkspaceDocument(0), original)
    const suggested = suggestCurrentGroup(grouped)
    const carded = createCardFromCurrentGroup(suggested)!
    expect(suggested.groups).toHaveLength(1)
    expect(suggested.groups[0].status).toBe('suggested')
    expect(carded.cards).toHaveLength(1)
    expect(carded.cards[0].title).toBe('未命名想法')
    expect(carded.strokes[0].points).toEqual(original.points)
    expect(carded.strokes[0].cardId).toBe(carded.cards[0].id)
  })

  it('moves cards within the 24px visible boundary and caps titles', () => {
    const carded = createCardFromCurrentGroup(addStrokeToCurrentGroup(createWorkspaceDocument(0), stroke('s1')))!
    const card = carded.cards[0]
    const moved = moveCard(carded, card.id, 5000, 5000, { width: 800, height: 600 })
    expect(moved.cards[0].position).toEqual({ x: 776, y: 576 })
    expect(renameCard(moved, card.id, 'x'.repeat(120)).cards[0].title).toHaveLength(100)
  })

  it('resizes cards with minimum bounds and keeps them reachable', () => {
    const carded = createCardFromCurrentGroup(addStrokeToCurrentGroup(createWorkspaceDocument(0), stroke('s1')))!
    const card = carded.cards[0]
    const resized = resizeCard(carded, card.id, 20, 30, { width: 800, height: 600 })
    expect(resized.cards[0].size).toEqual({ width: 120, height: 96 })
    expect(resized.strokes[0].points).toEqual(carded.strokes[0].points)
  })

  it('calculates all four anchor points and automatic nearest sides', () => {
    const carded = createCardFromCurrentGroup(addStrokeToCurrentGroup(createWorkspaceDocument(0), stroke('s1')))!
    const first = { ...carded.cards[0], position: { x: 100, y: 100 }, size: { width: 200, height: 120 } }
    const second = { ...first, id: 'second', position: { x: 500, y: 120 } }
    expect(cardAnchorPoint(first, 'top')).toEqual({ x: 200, y: 100 })
    expect(cardAnchorPoint(first, 'right')).toEqual({ x: 300, y: 160 })
    expect(cardAnchorPoint(first, 'bottom')).toEqual({ x: 200, y: 220 })
    expect(cardAnchorPoint(first, 'left')).toEqual({ x: 100, y: 160 })
    expect(automaticEdgeAnchors(first, second)).toEqual({ source: 'right', target: 'left' })
  })

  it('rejects self and duplicate edges, and deletes related edges atomically', () => {
    let document = createCardFromCurrentGroup(addStrokeToCurrentGroup(createWorkspaceDocument(0), stroke('s1')))!
    document = addStrokeToCurrentGroup(document, stroke('s2', 100))
    document = createCardFromCurrentGroup(document)!
    const [first, second] = document.cards
    expect(createEdge(document, first.id, first.id, 'undirected')).toBeNull()
    const linked = createEdge(document, first.id, second.id, 'undirected', 'bottom', 'top')!
    expect(linked.edges[0]).toMatchObject({ sourceAnchor: 'bottom', targetAnchor: 'top' })
    expect(updateEdgeType(linked, linked.edges[0].id, 'directed').edges[0].type).toBe('directed')
    expect(createEdge(linked, first.id, second.id, 'undirected')).toBeNull()
    const deleted = deleteCard(linked, first.id)
    expect(deleted.cards).toHaveLength(1)
    expect(deleted.edges).toEqual([])
    expect(deleted.strokes.find((item) => item.id === 's1')?.points).toHaveLength(2)
  })
})
