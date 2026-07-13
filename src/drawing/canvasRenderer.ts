import type { CanvasPoint, GestureCommand } from '../types/m0'
import {
  applyAxisAwareEma,
  isPointFarEnough,
  mapMirroredPoint,
} from './trajectory'

const INK_COLOR = '#172B3A'
const INK_WIDTH = 4

export class DiagnosticCanvasRenderer {
  private context: CanvasRenderingContext2D | null = null
  private width = 0
  private height = 0
  private previousFilteredPoint: CanvasPoint | null = null
  private previousRawPoint: CanvasPoint | null = null
  private previousDrawnPoint: CanvasPoint | null = null
  private renderPoint: CanvasPoint | null = null
  private hasRenderedSegment = false
  private drawing = false
  private cursor: HTMLElement | null = null

  attach(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const pixelRatio = window.devicePixelRatio || 1

    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas 2D context is unavailable')
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.strokeStyle = INK_COLOR
    context.lineWidth = INK_WIDTH
    context.lineCap = 'round'
    context.lineJoin = 'round'

    this.context = context
    this.width = width
    this.height = height
    this.resetStroke()
    context.clearRect(0, 0, width, height)
  }

  attachCursor(cursor: HTMLElement) {
    this.cursor = cursor
    this.hideCursor()
  }

  handle(command: GestureCommand) {
    if (command.type === 'END_STROKE') {
      this.finishStroke()
      if (command.reason !== 'pinch-up') this.hideCursor()
      return
    }

    const mappedPoint = mapMirroredPoint(command.point, this.width, this.height)
    if (!mappedPoint) {
      return
    }

    this.updateCursor(mappedPoint, command.type === 'START_STROKE' || this.drawing)

    if (command.type === 'START_STROKE') {
      this.previousFilteredPoint = mappedPoint
      this.previousRawPoint = mappedPoint
      this.previousDrawnPoint = mappedPoint
      this.renderPoint = mappedPoint
      this.hasRenderedSegment = false
      this.drawing = true
      return
    }

    if (!this.drawing || !this.context || !this.previousDrawnPoint) {
      return
    }

    const filteredPoint = applyAxisAwareEma(
      this.previousFilteredPoint,
      this.previousRawPoint,
      mappedPoint,
    )
    this.previousFilteredPoint = filteredPoint
    this.previousRawPoint = mappedPoint

    if (!isPointFarEnough(this.previousDrawnPoint, filteredPoint)) {
      return
    }

    const midpoint = {
      x: (this.previousDrawnPoint.x + filteredPoint.x) / 2,
      y: (this.previousDrawnPoint.y + filteredPoint.y) / 2,
    }

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
    this.renderPoint = midpoint
    this.previousDrawnPoint = filteredPoint
    this.hasRenderedSegment = true
  }

  private finishStroke() {
    if (
      this.drawing &&
      this.context &&
      this.hasRenderedSegment &&
      this.renderPoint &&
      this.previousDrawnPoint
    ) {
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

    this.resetStroke()
  }

  private resetStroke() {
    this.drawing = false
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
