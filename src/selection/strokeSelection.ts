import type { BoundingBox, IdeaCard, Stroke } from '../types/workspace'

export interface SelectionPoint {
  x: number
  y: number
}

export function selectionRect(start: SelectionPoint, end: SelectionPoint): BoundingBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function pointInRect(point: SelectionPoint, rect: BoundingBox) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height
}

function orientation(a: SelectionPoint, b: SelectionPoint, c: SelectionPoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function pointOnSegment(a: SelectionPoint, b: SelectionPoint, point: SelectionPoint) {
  return point.x >= Math.min(a.x, b.x)
    && point.x <= Math.max(a.x, b.x)
    && point.y >= Math.min(a.y, b.y)
    && point.y <= Math.max(a.y, b.y)
}

function segmentsIntersect(
  a: SelectionPoint,
  b: SelectionPoint,
  c: SelectionPoint,
  d: SelectionPoint,
) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  if (Math.sign(abC) !== Math.sign(abD) && Math.sign(cdA) !== Math.sign(cdB)) return true
  if (abC === 0 && pointOnSegment(a, b, c)) return true
  if (abD === 0 && pointOnSegment(a, b, d)) return true
  if (cdA === 0 && pointOnSegment(c, d, a)) return true
  return cdB === 0 && pointOnSegment(c, d, b)
}

function segmentIntersectsRect(a: SelectionPoint, b: SelectionPoint, rect: BoundingBox) {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true
  const topLeft = { x: rect.x, y: rect.y }
  const topRight = { x: rect.x + rect.width, y: rect.y }
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height }
  const bottomLeft = { x: rect.x, y: rect.y + rect.height }
  return segmentsIntersect(a, b, topLeft, topRight)
    || segmentsIntersect(a, b, topRight, bottomRight)
    || segmentsIntersect(a, b, bottomRight, bottomLeft)
    || segmentsIntersect(a, b, bottomLeft, topLeft)
}

export function pointInPolygon(point: SelectionPoint, polygon: SelectionPoint[]) {
  if (polygon.length < 3) return false
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (
        (previousPoint.x - currentPoint.x)
        * (point.y - currentPoint.y)
        / (previousPoint.y - currentPoint.y)
        + currentPoint.x
      )
    if (crosses) inside = !inside
  }
  return inside
}

function strokeIntersectsPolygon(stroke: Stroke, polygon: SelectionPoint[]) {
  if (stroke.points.some((point) => pointInPolygon(point, polygon))) return true
  const polygonEdges = polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]] as const)
  return stroke.points.some((point, index) => {
    const next = stroke.points[index + 1]
    return Boolean(next && polygonEdges.some(([start, end]) => segmentsIntersect(point, next, start, end)))
  })
}

export function strokeIdsInRectangle(strokes: Stroke[], rect: BoundingBox) {
  if (rect.width < 4 || rect.height < 4) return []
  return strokes
    .filter((stroke) => !stroke.cardId)
    .filter((stroke) => stroke.points.some((point, index) => {
      if (pointInRect(point, rect)) return true
      const next = stroke.points[index + 1]
      return Boolean(next && segmentIntersectsRect(point, next, rect))
    }))
    .map((stroke) => stroke.id)
}

export function strokeIdsInFreeform(strokes: Stroke[], polygon: SelectionPoint[]) {
  if (polygon.length < 3) return []
  return strokes
    .filter((stroke) => !stroke.cardId && strokeIntersectsPolygon(stroke, polygon))
    .map((stroke) => stroke.id)
}

function cardCenter(card: IdeaCard): SelectionPoint {
  return {
    x: card.position.x + card.size.width / 2,
    y: card.position.y + card.size.height / 2,
  }
}

export function cardIdsInRectangle(cards: IdeaCard[], rect: BoundingBox) {
  if (rect.width < 4 || rect.height < 4) return []
  return cards
    .filter((card) => pointInRect(cardCenter(card), rect))
    .map((card) => card.id)
}

export function cardIdsInFreeform(cards: IdeaCard[], polygon: SelectionPoint[]) {
  if (polygon.length < 3) return []
  return cards
    .filter((card) => pointInPolygon(cardCenter(card), polygon))
    .map((card) => card.id)
}
