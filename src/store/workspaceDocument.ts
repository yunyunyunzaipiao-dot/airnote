import type { CardGeometry } from '../layout/cardResize'
import type {
  AirNoteSettings,
  BoundingBox,
  Edge,
  EdgeAnchor,
  IdeaCard,
  TextCardStyle,
  Stroke,
  StrokeGroup,
  WorkspaceDocument,
} from '../types/workspace'

function createId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createWorkspaceDocument(now = Date.now()): WorkspaceDocument {
  return {
    workspace: {
      id: createId('workspace'),
      name: '未命名项目',
      createdAt: now,
      updatedAt: now,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    strokes: [],
    groups: [],
    cards: [],
    edges: [],
  }
}

export function strokeBounds(strokes: Stroke[]): BoundingBox | null {
  const points = strokes.flatMap((stroke) => stroke.points)
  if (points.length === 0) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)
  if (![x, y, right, bottom].every(Number.isFinite)) return null
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}

export function addStrokeToCurrentGroup(document: WorkspaceDocument, stroke: Stroke): WorkspaceDocument {
  const existing = document.groups.find((group) => group.status !== 'committed')
  const strokeIds = [...(existing?.strokeIds ?? []), stroke.id]
  const bounds = strokeBounds([...document.strokes, stroke].filter((item) => strokeIds.includes(item.id)))
  if (!bounds) return document
  const group: StrokeGroup = {
    id: existing?.id ?? createId('group'),
    strokeIds,
    boundingBox: bounds,
    status: 'collecting',
  }
  return touch({
    ...document,
    strokes: [...document.strokes, stroke],
    groups: [...document.groups.filter((item) => item.id !== group.id), group],
  })
}

export function suggestCurrentGroup(document: WorkspaceDocument): WorkspaceDocument {
  const current = document.groups.find((group) => group.status === 'collecting')
  if (!current) return document
  return touch({
    ...document,
    groups: document.groups.map((group) => group.id === current.id ? { ...group, status: 'suggested' } : group),
  })
}

export function suggestGroupFromSelection(
  document: WorkspaceDocument,
  requestedStrokeIds: string[],
): WorkspaceDocument {
  const eligibleStrokeIds = [...new Set(requestedStrokeIds)].filter((strokeId) => {
    const stroke = document.strokes.find((item) => item.id === strokeId)
    return Boolean(stroke && !stroke.cardId)
  })
  const bounds = strokeBounds(document.strokes.filter((stroke) => eligibleStrokeIds.includes(stroke.id)))
  if (!bounds || eligibleStrokeIds.length === 0) return document
  const group: StrokeGroup = {
    id: createId('group'),
    strokeIds: eligibleStrokeIds,
    boundingBox: bounds,
    status: 'suggested',
  }
  return touch({
    ...document,
    groups: [...document.groups.filter((item) => item.status === 'committed'), group],
  })
}

export function continueCurrentGroup(document: WorkspaceDocument): WorkspaceDocument {
  return {
    ...document,
    groups: document.groups.map((group) => group.status === 'suggested' ? { ...group, status: 'collecting' } : group),
  }
}

export function cancelCurrentGroup(document: WorkspaceDocument): WorkspaceDocument {
  return touch({ ...document, groups: document.groups.filter((group) => group.status === 'committed') })
}

export function createCardFromCurrentGroup(document: WorkspaceDocument): WorkspaceDocument | null {
  const group = document.groups.find((item) => item.status !== 'committed')
  if (!group || group.strokeIds.length === 0) return null
  const strokes = document.strokes.filter((stroke) => group.strokeIds.includes(stroke.id) && !stroke.cardId)
  const bounds = strokeBounds(strokes)
  if (!bounds || strokes.length === 0) return null
  const padding = Math.max(24, Math.min(bounds.width, bounds.height) * 0.1)
  const cardId = createId('card')
  const card: IdeaCard = {
    id: cardId,
    kind: 'ink',
    strokeIds: strokes.map((stroke) => stroke.id),
    title: '未命名想法',
    position: { x: bounds.x - padding, y: bounds.y - padding - 38 },
    size: {
      width: Math.max(MIN_CARD_SIZE.width, bounds.width + padding * 2),
      height: Math.max(MIN_CARD_SIZE.height, bounds.height + padding * 2 + 38),
    },
  }
  return touch({
    ...document,
    strokes: document.strokes.map((stroke) => card.strokeIds.includes(stroke.id) ? { ...stroke, cardId } : stroke),
    groups: document.groups.map((item) => item.id === group.id ? { ...item, status: 'committed' } : item),
    cards: [...document.cards, card],
  })
}

export const DEFAULT_TEXT_CARD_STYLE: TextCardStyle = {
  bold: false,
  italic: false,
  underline: false,
  color: '#172B3A',
}

export function createTextCard(
  document: WorkspaceDocument,
  position: { x: number; y: number } = { x: 180, y: 140 },
) {
  const card: IdeaCard = {
    id: createId('card'),
    kind: 'text',
    title: '未命名文字',
    content: '',
    textStyle: { ...DEFAULT_TEXT_CARD_STYLE },
    position,
    size: { width: 280, height: 180 },
  }
  return touch({ ...document, cards: [...document.cards, card] })
}

export function updateTextCard(
  document: WorkspaceDocument,
  cardId: string,
  patch: { content?: string; textStyle?: Partial<TextCardStyle> },
) {
  const color = patch.textStyle?.color
  const safeColor = color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined
  return touch({
    ...document,
    cards: document.cards.map((card) => card.id === cardId && card.kind === 'text'
      ? {
          ...card,
          content: patch.content === undefined ? card.content : patch.content.slice(0, 5000),
          textStyle: {
            ...card.textStyle,
            ...patch.textStyle,
            ...(safeColor ? { color: safeColor } : color ? { color: DEFAULT_TEXT_CARD_STYLE.color } : {}),
          },
        }
      : card),
  })
}

export function moveCard(document: WorkspaceDocument, cardId: string, x: number, y: number, stage: { width: number; height: number }) {
  const card = document.cards.find((item) => item.id === cardId)
  if (!card || ![x, y, stage.width, stage.height].every(Number.isFinite)) return document
  return touch({
    ...document,
    cards: document.cards.map((item) => item.id === cardId
      ? { ...item, position: { x, y } }
      : item),
  })
}

export function moveCards(
  document: WorkspaceDocument,
  moves: Array<{ cardId: string; x: number; y: number }>,
  stage: { width: number; height: number },
) {
  const moveById = new Map(moves.map((move) => [move.cardId, move]))
  let changed = false
  const cards = document.cards.map((card) => {
    const move = moveById.get(card.id)
    if (!move || ![move.x, move.y, stage.width, stage.height].every(Number.isFinite)) return card
    const { x, y } = move
    if (x === card.position.x && y === card.position.y) return card
    changed = true
    return { ...card, position: { x, y } }
  })
  return changed ? touch({ ...document, cards }) : document
}

export const MIN_CARD_SIZE = { width: 120, height: 96 }

export function resizeCard(
  document: WorkspaceDocument,
  cardId: string,
  geometry: CardGeometry,
  stage: { width: number; height: number },
) {
  const card = document.cards.find((item) => item.id === cardId)
  const values = [
    geometry.position.x,
    geometry.position.y,
    geometry.size.width,
    geometry.size.height,
    stage.width,
    stage.height,
  ]
  if (!card || !values.every(Number.isFinite)) return document
  const size = {
    width: Math.min(Math.max(MIN_CARD_SIZE.width, geometry.size.width), Math.max(MIN_CARD_SIZE.width, stage.width)),
    height: Math.min(Math.max(MIN_CARD_SIZE.height, geometry.size.height), Math.max(MIN_CARD_SIZE.height, stage.height)),
  }
  const position = {
    x: geometry.position.x,
    y: geometry.position.y,
  }
  return touch({
    ...document,
    cards: document.cards.map((item) => item.id === cardId ? { ...item, size, position } : item),
  })
}

export function renameCard(document: WorkspaceDocument, cardId: string, title: string) {
  const card = document.cards.find((item) => item.id === cardId)
  if (!card) return document
  const normalized = title.trim().slice(0, 100) || (card.kind === 'text' ? '未命名文字' : '未命名想法')
  if (normalized === card.title) return document
  return touch({ ...document, cards: document.cards.map((item) => item.id === cardId ? { ...item, title: normalized } : item) })
}

export function deleteCard(document: WorkspaceDocument, cardId: string) {
  const deletedStrokeIds = new Set(
    document.strokes.filter((stroke) => stroke.cardId === cardId).map((stroke) => stroke.id),
  )
  return touch({
    ...document,
    cards: document.cards.filter((card) => card.id !== cardId),
    edges: document.edges.filter((edge) => edge.sourceCardId !== cardId && edge.targetCardId !== cardId),
    strokes: document.strokes.filter((stroke) => !deletedStrokeIds.has(stroke.id)),
    groups: document.groups
      .map((group) => ({ ...group, strokeIds: group.strokeIds.filter((strokeId) => !deletedStrokeIds.has(strokeId)) }))
      .filter((group) => group.strokeIds.length > 0),
  })
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy))
}

export function strokeIdAtPoint(
  document: WorkspaceDocument,
  point: { x: number; y: number },
  tolerance = 10,
) {
  return [...document.strokes].reverse().find((stroke) => {
    if (stroke.cardId || stroke.points.length === 0) return false
    const hitRadius = Math.max(tolerance, stroke.width / 2 + 4)
    if (stroke.points.length === 1) {
      return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= hitRadius
    }
    return stroke.points.slice(1).some((end, index) => distanceToSegment(point, stroke.points[index], end) <= hitRadius)
  })?.id ?? null
}

export function eraseStroke(document: WorkspaceDocument, strokeId: string) {
  const stroke = document.strokes.find((item) => item.id === strokeId)
  if (!stroke || stroke.cardId) return document
  return touch({
    ...document,
    strokes: document.strokes.filter((item) => item.id !== strokeId),
    groups: document.groups
      .map((group) => ({ ...group, strokeIds: group.strokeIds.filter((id) => id !== strokeId) }))
      .filter((group) => group.strokeIds.length > 0),
  })
}

export function updateViewport(
  document: WorkspaceDocument,
  viewport: Partial<WorkspaceDocument['workspace']['viewport']>,
) {
  const current = document.workspace.viewport
  const zoom = viewport.zoom === undefined
    ? current.zoom
    : Number.isFinite(viewport.zoom)
      ? Math.min(3, Math.max(0.25, viewport.zoom))
      : 1
  const x = Number.isFinite(viewport.x) ? viewport.x! : current.x
  const y = Number.isFinite(viewport.y) ? viewport.y! : current.y
  return touch({ ...document, workspace: { ...document.workspace, viewport: { x, y, zoom } } })
}

export function createEdge(
  document: WorkspaceDocument,
  sourceCardId: string,
  targetCardId: string,
  type: Edge['type'],
  sourceAnchor?: EdgeAnchor,
  targetAnchor?: EdgeAnchor,
) {
  if (sourceCardId === targetCardId) return null
  if (!document.cards.some((card) => card.id === sourceCardId) || !document.cards.some((card) => card.id === targetCardId)) return null
  const duplicate = document.edges.some((edge) => edge.sourceCardId === sourceCardId && edge.targetCardId === targetCardId && edge.type === type)
  if (duplicate) return null
  return touch({ ...document, edges: [...document.edges, { id: createId('edge'), sourceCardId, targetCardId, type, sourceAnchor, targetAnchor }] })
}

export function cardAnchorPoint(card: IdeaCard, anchor: EdgeAnchor) {
  if (anchor === 'top') return { x: card.position.x + card.size.width / 2, y: card.position.y }
  if (anchor === 'right') return { x: card.position.x + card.size.width, y: card.position.y + card.size.height / 2 }
  if (anchor === 'bottom') return { x: card.position.x + card.size.width / 2, y: card.position.y + card.size.height }
  return { x: card.position.x, y: card.position.y + card.size.height / 2 }
}

export function closestCardAnchor(card: IdeaCard, point: { x: number; y: number }): EdgeAnchor {
  const anchors: EdgeAnchor[] = ['top', 'right', 'bottom', 'left']
  return anchors.reduce((closest, anchor) => {
    const current = cardAnchorPoint(card, anchor)
    const best = cardAnchorPoint(card, closest)
    return Math.hypot(point.x - current.x, point.y - current.y) < Math.hypot(point.x - best.x, point.y - best.y)
      ? anchor
      : closest
  }, 'top')
}

export function automaticEdgeAnchors(source: IdeaCard, target: IdeaCard): { source: EdgeAnchor; target: EdgeAnchor } {
  const sourceCenter = { x: source.position.x + source.size.width / 2, y: source.position.y + source.size.height / 2 }
  const targetCenter = { x: target.position.x + target.size.width / 2, y: target.position.y + target.size.height / 2 }
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y)
  if (horizontal) return targetCenter.x >= sourceCenter.x ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' }
  return targetCenter.y >= sourceCenter.y ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' }
}

export function updateEdgeType(document: WorkspaceDocument, edgeId: string, type: Edge['type']) {
  const edge = document.edges.find((item) => item.id === edgeId)
  if (!edge || edge.type === type) return document
  const duplicate = document.edges.some((item) => item.id !== edgeId && item.sourceCardId === edge.sourceCardId && item.targetCardId === edge.targetCardId && item.type === type)
  if (duplicate) return document
  return touch({ ...document, edges: document.edges.map((item) => item.id === edgeId ? { ...item, type } : item) })
}

export function touch(document: WorkspaceDocument): WorkspaceDocument {
  return { ...document, workspace: { ...document.workspace, updatedAt: Date.now() } }
}

export function projectFromDocument(document: WorkspaceDocument, settings: AirNoteSettings) {
  return { schemaVersion: 2 as const, ...document, settings }
}
