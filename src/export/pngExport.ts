import { cardInkMetrics } from '../drawing/cardInk'
import { automaticEdgeAnchors, cardAnchorPoint } from '../store/workspaceDocument'
import type { AirNoteProject, IdeaCard, Stroke } from '../types/workspace'
import { downloadBlob } from './download'

export interface ExportBounds {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_VIEWPORT: ExportBounds = { x: 0, y: 0, width: 1280, height: 720 }
const EXPORT_PADDING = 48
const MAX_EXPORT_DIMENSION = 8192

export function calculateExportBounds(project: AirNoteProject, padding = EXPORT_PADDING): ExportBounds {
  const rectangles: ExportBounds[] = project.cards.map((card) => ({
    x: card.position.x,
    y: card.position.y,
    width: card.size.width,
    height: card.size.height,
  }))
  for (const stroke of project.strokes.filter((item) => !item.cardId)) {
    if (stroke.points.length === 0) continue
    const xs = stroke.points.map((point) => point.x)
    const ys = stroke.points.map((point) => point.y)
    const halfWidth = stroke.width / 2
    rectangles.push({
      x: Math.min(...xs) - halfWidth,
      y: Math.min(...ys) - halfWidth,
      width: Math.max(...xs) - Math.min(...xs) + stroke.width,
      height: Math.max(...ys) - Math.min(...ys) + stroke.width,
    })
  }
  if (rectangles.length === 0) return DEFAULT_VIEWPORT
  const left = Math.min(...rectangles.map((item) => item.x)) - padding
  const top = Math.min(...rectangles.map((item) => item.y)) - padding
  const right = Math.max(...rectangles.map((item) => item.x + item.width)) + padding
  const bottom = Math.max(...rectangles.map((item) => item.y + item.height)) + padding
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, transform = (x: number, y: number) => ({ x, y }), widthScale = 1) {
  if (stroke.points.length < 2) return
  const first = transform(stroke.points[0].x, stroke.points[0].y)
  context.beginPath()
  context.moveTo(first.x, first.y)
  for (const point of stroke.points.slice(1)) {
    const next = transform(point.x, point.y)
    context.lineTo(next.x, next.y)
  }
  context.strokeStyle = stroke.color
  context.lineWidth = stroke.width * widthScale
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke()
}

function drawArrow(context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const size = 10
  context.beginPath()
  context.moveTo(end.x, end.y)
  context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6))
  context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6))
  context.closePath()
  context.fillStyle = '#173f5f'
  context.fill()
}

function drawCardInk(context: CanvasRenderingContext2D, card: IdeaCard, strokes: Stroke[]) {
  const ink = cardInkMetrics(strokes)
  if (!ink) return
  const scale = Math.min(card.size.width / ink.size.width, card.size.height / ink.size.height)
  const offsetX = card.position.x + (card.size.width - ink.size.width * scale) / 2
  const offsetY = card.position.y + (card.size.height - ink.size.height * scale) / 2
  const transform = (x: number, y: number) => ({
    x: offsetX + (x - ink.origin.x) * scale,
    y: offsetY + (y - ink.origin.y) * scale,
  })
  context.save()
  context.beginPath()
  context.rect(card.position.x, card.position.y, card.size.width, card.size.height)
  context.clip()
  strokes.forEach((stroke) => drawStroke(context, stroke, transform, scale))
  context.restore()
}

export function renderProjectPng(project: AirNoteProject, canvas: HTMLCanvasElement) {
  const bounds = calculateExportBounds(project)
  const exportScale = Math.min(1, MAX_EXPORT_DIMENSION / Math.max(bounds.width, bounds.height))
  canvas.width = Math.max(1, Math.ceil(bounds.width * exportScale))
  canvas.height = Math.max(1, Math.ceil(bounds.height * exportScale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法创建图片画布。')

  context.fillStyle = '#f6f1e4'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.setTransform(exportScale, 0, 0, exportScale, -bounds.x * exportScale, -bounds.y * exportScale)

  context.strokeStyle = 'rgba(19, 33, 38, 0.12)'
  context.lineWidth = 1
  for (let x = Math.floor(bounds.x / 32) * 32; x <= bounds.x + bounds.width; x += 32) {
    context.beginPath()
    context.moveTo(x, bounds.y)
    context.lineTo(x, bounds.y + bounds.height)
    context.stroke()
  }
  for (let y = Math.floor(bounds.y / 32) * 32; y <= bounds.y + bounds.height; y += 32) {
    context.beginPath()
    context.moveTo(bounds.x, y)
    context.lineTo(bounds.x + bounds.width, y)
    context.stroke()
  }

  project.strokes.filter((stroke) => !stroke.cardId).forEach((stroke) => drawStroke(context, stroke))

  for (const edge of project.edges) {
    const source = project.cards.find((card) => card.id === edge.sourceCardId)
    const target = project.cards.find((card) => card.id === edge.targetCardId)
    if (!source || !target) continue
    const automatic = automaticEdgeAnchors(source, target)
    const start = cardAnchorPoint(source, edge.sourceAnchor ?? automatic.source)
    const end = cardAnchorPoint(target, edge.targetAnchor ?? automatic.target)
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
    context.strokeStyle = '#173f5f'
    context.lineWidth = 2
    context.stroke()
    if (edge.type === 'directed') drawArrow(context, start, end)
    if (edge.label) {
      context.fillStyle = '#173f5f'
      context.font = '12px sans-serif'
      context.textAlign = 'center'
      context.fillText(edge.label, (start.x + end.x) / 2, (start.y + end.y) / 2 - 6)
    }
  }

  for (const card of project.cards) {
    context.fillStyle = '#fffdf5'
    context.fillRect(card.position.x, card.position.y, card.size.width, card.size.height)
    drawCardInk(context, card, project.strokes.filter((stroke) => card.strokeIds.includes(stroke.id)))
    context.strokeStyle = 'rgba(19, 33, 38, 0.36)'
    context.lineWidth = 1
    context.strokeRect(card.position.x, card.position.y, card.size.width, card.size.height)
    context.fillStyle = 'rgba(246, 241, 228, 0.92)'
    context.fillRect(card.position.x, card.position.y, card.size.width, 38)
    context.beginPath()
    context.moveTo(card.position.x, card.position.y + 38)
    context.lineTo(card.position.x + card.size.width, card.position.y + 38)
    context.strokeStyle = 'rgba(19, 33, 38, 0.18)'
    context.stroke()
    context.fillStyle = '#132126'
    context.font = '600 12px sans-serif'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.save()
    context.beginPath()
    context.rect(card.position.x + 10, card.position.y, Math.max(1, card.size.width - 20), 38)
    context.clip()
    context.fillText(card.title, card.position.x + 10, card.position.y + 19)
    context.restore()
  }

  return bounds
}

export function createProjectPngBlob(project: AirNoteProject) {
  const canvas = document.createElement('canvas')
  renderProjectPng(project, canvas)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片编码失败。'))
    }, 'image/png')
  })
}

export async function exportProjectPng(project: AirNoteProject, filename = 'airnote-canvas.png') {
  downloadBlob(await createProjectPngBlob(project), filename)
}
