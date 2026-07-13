import type { CanvasPoint, GestureCommand } from '../types/m0'
import {
  DEFAULT_BRUSH,
  DEFAULT_WRITING_ROI,
  type BrushSettings,
  type Stroke,
  type StrokePoint,
  type WritingROI,
} from '../types/workspace'
import {
  applyAxisAwareEma,
  isPointFarEnough,
  mapMirroredPoint,
} from './trajectory'

type InputSource = 'gesture' | 'mouse'

function createStrokeId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `stroke-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isFiniteCanvasPoint(point: CanvasPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export class StrokeCanvasRenderer {
  private context: CanvasRenderingContext2D | null = null
  private width = 0
  private height = 0
  private completedStrokes: Stroke[] = []
  private brush: BrushSettings = DEFAULT_BRUSH
  private writingROI: WritingROI = DEFAULT_WRITING_ROI
  private activeStroke: Stroke | null = null
  private activeSource: InputSource | null = null
  private previousFilteredPoint: CanvasPoint | null = null
  private previousRawPoint: CanvasPoint | null = null
  private previousDrawnPoint: CanvasPoint | null = null
  private renderPoint: CanvasPoint | null = null
  private hasRenderedSegment = false
  private cursor: HTMLElement | null = null

  attach(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const pixelRatio = window.devicePixelRatio || 1

    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    this.context = context
    this.width = width
    this.height = height
    this.resetActiveStroke()
    this.redraw()
  }

  attachCursor(cursor: HTMLElement) {
    this.cursor = cursor
    this.hideCursor()
  }

  setCompletedStrokes(strokes: Stroke[]) {
    this.completedStrokes = strokes
    this.redraw()
  }

  setBrush(brush: BrushSettings) {
    this.brush = brush
  }

  setWritingROI(writingROI: WritingROI) {
    this.writingROI = writingROI
  }

  handleGesture(command: GestureCommand): Stroke | null {
    if (command.type === 'END_STROKE') {
      const stroke = this.finishStroke()
      if (command.reason !== 'pinch-up') this.hideCursor()
      return stroke
    }

    const mappedPoint = mapMirroredPoint(command.point, this.width, this.height, this.writingROI)
    if (!mappedPoint) return null

    this.updateCursor(mappedPoint, command.type === 'START_STROKE' || this.activeSource === 'gesture')
    if (command.type === 'START_STROKE') {
      this.startStroke(mappedPoint, command.timestamp, 'gesture')
      return null
    }

    if (this.activeSource === 'gesture') {
      this.appendPoint(mappedPoint, command.timestamp, true)
    }
    return null
  }

  startMouseStroke(point: CanvasPoint, timestamp: number) {
    if (!isFiniteCanvasPoint(point)) return
    this.startStroke(point, timestamp, 'mouse')
  }

  appendMousePoint(point: CanvasPoint, timestamp: number) {
    if (!isFiniteCanvasPoint(point) || this.activeSource !== 'mouse') return
    this.appendPoint(point, timestamp, false)
  }

  finishStroke(): Stroke | null {
    if (
      this.activeStroke
      && this.context
      && this.hasRenderedSegment
      && this.renderPoint
      && this.previousDrawnPoint
    ) {
      this.configureContext(this.activeStroke)
      this.context.beginPath()
      this.context.moveTo(this.renderPoint.x, this.renderPoint.y)
      this.context.quadraticCurveTo(
        this.previousDrawnPoint.x,
        this.previousDrawnPoint.y,
        this.previousDrawnPoint.x,
        this.previousDrawnPoint.y,
      )
      this.context.stroke()
    }

    const completed = this.activeStroke && this.activeStroke.points.length >= 2
      ? { ...this.activeStroke, points: [...this.activeStroke.points] }
      : null
    this.resetActiveStroke()
    return completed
  }

  private startStroke(point: CanvasPoint, timestamp: number, source: InputSource) {
    this.resetActiveStroke()
    this.activeSource = source
    this.activeStroke = {
      id: createStrokeId(),
      points: [{ ...point, t: timestamp }],
      color: this.brush.color,
      width: this.brush.width,
      style: 'ink',
      createdAt: Date.now(),
    }
    this.previousFilteredPoint = point
    this.previousRawPoint = point
    this.previousDrawnPoint = point
    this.renderPoint = point
  }

  private appendPoint(point: CanvasPoint, timestamp: number, smooth: boolean) {
    if (!this.activeStroke || !this.context || !this.previousDrawnPoint) return

    const acceptedPoint = smooth
      ? applyAxisAwareEma(this.previousFilteredPoint, this.previousRawPoint, point)
      : point
    this.previousFilteredPoint = acceptedPoint
    this.previousRawPoint = point

    if (!isPointFarEnough(this.previousDrawnPoint, acceptedPoint)) return

    const midpoint = {
      x: (this.previousDrawnPoint.x + acceptedPoint.x) / 2,
      y: (this.previousDrawnPoint.y + acceptedPoint.y) / 2,
    }

    this.configureContext(this.activeStroke)
    this.context.beginPath()
    this.context.moveTo(
      this.renderPoint?.x ?? this.previousDrawnPoint.x,
      this.renderPoint?.y ?? this.previousDrawnPoint.y,
    )
    if (this.hasRenderedSegment) {
      this.context.quadraticCurveTo(
        this.previousDrawnPoint.x,
        this.previousDrawnPoint.y,
        midpoint.x,
        midpoint.y,
      )
    } else {
      this.context.lineTo(midpoint.x, midpoint.y)
    }
    this.context.stroke()

    const strokePoint: StrokePoint = { ...acceptedPoint, t: timestamp }
    this.activeStroke.points.push(strokePoint)
    this.renderPoint = midpoint
    this.previousDrawnPoint = acceptedPoint
    this.hasRenderedSegment = true
  }

  private redraw() {
    if (!this.context) return
    this.context.clearRect(0, 0, this.width, this.height)
    this.completedStrokes.forEach((stroke) => this.drawCompletedStroke(stroke))
  }

  private drawCompletedStroke(stroke: Stroke) {
    if (!this.context || stroke.points.length < 2) return
    this.configureContext(stroke)
    this.context.beginPath()
    this.context.moveTo(stroke.points[0].x, stroke.points[0].y)

    if (stroke.points.length === 2) {
      this.context.lineTo(stroke.points[1].x, stroke.points[1].y)
    } else {
      for (let index = 1; index < stroke.points.length - 1; index += 1) {
        const point = stroke.points[index]
        const next = stroke.points[index + 1]
        this.context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) / 2,
          (point.y + next.y) / 2,
        )
      }
      const last = stroke.points.at(-1)!
      this.context.lineTo(last.x, last.y)
    }
    this.context.stroke()
  }

  private configureContext(stroke: Pick<Stroke, 'color' | 'width'>) {
    if (!this.context) return
    this.context.strokeStyle = stroke.color
    this.context.lineWidth = stroke.width
    this.context.lineCap = 'round'
    this.context.lineJoin = 'round'
  }

  private resetActiveStroke() {
    this.activeStroke = null
    this.activeSource = null
    this.previousFilteredPoint = null
    this.previousRawPoint = null
    this.previousDrawnPoint = null
    this.renderPoint = null
    this.hasRenderedSegment = false
  }

  private updateCursor(point: CanvasPoint, drawing: boolean) {
    if (!this.cursor) return
    this.cursor.hidden = false
    this.cursor.dataset.drawing = String(drawing)
    this.cursor.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`
  }

  private hideCursor() {
    if (this.cursor) this.cursor.hidden = true
  }
}
