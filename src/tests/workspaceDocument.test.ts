import { describe, expect, it } from 'vitest'
import {
  addStrokeToCurrentGroup,
  automaticEdgeAnchors,
  cardAnchorPoint,
  createCardFromCurrentGroup,
  createEdge,
  createTextCard,
  createWorkspaceDocument,
  deleteCard,
  eraseStroke,
  moveCard,
  moveCards,
  renameCard,
  resizeCard,
  suggestGroupFromSelection,
  suggestCurrentGroup,
  strokeIdAtPoint,
  updateTextCard,
  updateViewport,
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

  it('turns selected uncarded strokes into a confirmation suggestion', () => {
    const first = stroke('s1')
    const second = stroke('s2', 100)
    const document = {
      ...createWorkspaceDocument(0),
      strokes: [first, { ...second, cardId: 'card-existing' }],
    }
    const suggested = suggestGroupFromSelection(document, ['s1', 's2', 'missing'])
    expect(suggested.groups).toHaveLength(1)
    expect(suggested.groups[0]).toMatchObject({ strokeIds: ['s1'], status: 'suggested' })
    expect(suggested.strokes[0].points).toEqual(first.points)
  })

  it('moves cards to any finite workspace coordinate and caps titles', () => {
    const carded = createCardFromCurrentGroup(addStrokeToCurrentGroup(createWorkspaceDocument(0), stroke('s1')))!
    const card = carded.cards[0]
    const moved = moveCard(carded, card.id, 5000, 5000, { width: 800, height: 600 })
    expect(moved.cards[0].position).toEqual({ x: 5000, y: 5000 })
    expect(moveCard(moved, card.id, Number.NaN, 10, { width: 800, height: 600 })).toBe(moved)
    expect(renameCard(moved, card.id, 'x'.repeat(120)).cards[0].title).toHaveLength(100)
  })

  it('moves multiple cards as one immutable document operation', () => {
    let document = createTextCard(createWorkspaceDocument(0), { x: 40, y: 50 })
    document = createTextCard(document, { x: 280, y: 90 })
    const pointsBefore = structuredClone(document.strokes.map((item) => item.points))
    const moved = moveCards(document, [
      { cardId: document.cards[0].id, x: 140, y: 150 },
      { cardId: document.cards[1].id, x: 380, y: 190 },
    ], { width: 800, height: 600 })
    expect(moved.cards.map((card) => card.position)).toEqual([{ x: 140, y: 150 }, { x: 380, y: 190 }])
    expect(document.cards.map((card) => card.position)).toEqual([{ x: 40, y: 50 }, { x: 280, y: 90 }])
    expect(moved.strokes.map((item) => item.points)).toEqual(pointsBefore)
  })

  it('resizes cards with minimum size without clamping their workspace position', () => {
    const carded = createCardFromCurrentGroup(addStrokeToCurrentGroup(createWorkspaceDocument(0), stroke('s1')))!
    const card = carded.cards[0]
    const resized = resizeCard(carded, card.id, {
      position: { x: -500, y: -400 },
      size: { width: 20, height: 30 },
    }, { width: 800, height: 600 })
    expect(resized.cards[0].size).toEqual({ width: 120, height: 96 })
    expect(resized.cards[0].position).toEqual({ x: -500, y: -400 })
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
    expect(deleted.strokes.find((item) => item.id === 's1')).toBeUndefined()
    expect(deleted.strokes.find((item) => item.id === 's2')?.points).toHaveLength(2)
  })

  it('erases only a complete free Stroke and preserves carded Stroke geometry', () => {
    const first = stroke('s1')
    const cardedStroke = { ...stroke('s2', 100), cardId: 'card-1' }
    const document = { ...createWorkspaceDocument(0), strokes: [first, cardedStroke] }
    expect(strokeIdAtPoint(document, { x: 20, y: 20 })).toBe('s1')
    expect(strokeIdAtPoint(document, { x: 110, y: 20 })).toBeNull()
    const erased = eraseStroke(document, 's1')
    expect(erased.strokes).toEqual([cardedStroke])
    expect(cardedStroke.points).toEqual(stroke('s2', 100).points)
  })

  it('creates and updates a basic text card with safe limits', () => {
    const created = createTextCard(createWorkspaceDocument(0), { x: 80, y: 90 })
    expect(created.cards[0]).toMatchObject({ kind: 'text', title: '未命名文字', content: '' })
    const updated = updateTextCard(created, created.cards[0].id, {
      content: 'x'.repeat(5100),
      textStyle: { bold: true, color: 'invalid' },
    })
    const card = updated.cards[0]
    expect(card.kind).toBe('text')
    if (card.kind !== 'text') return
    expect(card.content).toHaveLength(5000)
    expect(card.textStyle).toMatchObject({ bold: true, color: '#172B3A' })
  })

  it('clamps and stores viewport zoom without changing Stroke points', () => {
    const document = { ...createWorkspaceDocument(0), strokes: [stroke('s1')] }
    const points = structuredClone(document.strokes[0].points)
    expect(updateViewport(document, { x: 30, y: -20, zoom: 9 }).workspace.viewport).toEqual({ x: 30, y: -20, zoom: 3 })
    expect(updateViewport(document, { zoom: 0 }).workspace.viewport.zoom).toBe(0.25)
    expect(updateViewport(updateViewport(document, { zoom: 2 }), { x: 40 }).workspace.viewport.zoom).toBe(2)
    expect(updateViewport(document, { zoom: Number.NaN }).workspace.viewport.zoom).toBe(1)
    expect(document.strokes[0].points).toEqual(points)
  })
})
