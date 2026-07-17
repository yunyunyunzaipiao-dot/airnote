import type { CanvasPoint, GestureCommand } from '../types/m0'
import {
  DEFAULT_BRUSH,
  DEFAULT_WRITING_ROI,
  type BrushSettings,
  type Stroke,
  type StrokePoint,
  type VisualStyle,
  type WritingROI,
} from '../types/workspace'
import {
  isPointFarEnough,
  mapMirroredPoint,
  stabilizeGesturePoint,
} from './trajectory'
import { particleSamplesForStroke } from './particleStyle'

type InputSource = 'gesture' | 'mouse'
export type StylePerformanceStage = 'full' | 'reduced-particles' | 'no-trail'

export function nextStylePerformanceStage(stage: StylePerformanceStage, fps: number): StylePerformanceStage {
  if (fps >= 24 || stage === 'no-trail') return stage
  return stage === 'full' ? 'reduced-particles' : 'no-trail'
}

interface RuntimeParticle {
  x: number
  y: number
  color: string
  size: number
  createdAt: number
  lifetime: number
  blur: number
}

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
  private gestureFilteredPoint: CanvasPoint | null = null
  private gestureRawPoint: CanvasPoint | null = null
  private previousDrawnPoint: CanvasPoint | null = null
  private renderPoint: CanvasPoint | null = null
  private hasRenderedSegment = false
  private cursor: HTMLElement | null = null
  private effectsEnabled = false
  private reducedMotion = false
  private particles: RuntimeParticle[] = []
  private animationFrame: number | null = null
  private performanceStage: StylePerformanceStage = 'full'
  private performanceWindowStartedAt = 0
  private performanceFrameCount = 0
  private performanceListener: ((stage: StylePerformanceStage) => void) | null = null

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
    this.resetGestureFilter()
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

  setEffectsEnabled(enabled: boolean) {
    this.effectsEnabled = enabled
    if (!enabled) {
      this.clearParticles()
      this.performanceStage = 'full'
      this.performanceListener?.('full')
    }
    this.redraw()
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced
    if (reduced) this.clearParticles()
    this.redraw()
  }

  setPerformanceListener(listener: ((stage: StylePerformanceStage) => void) | null) {
    this.performanceListener = listener
  }

  setWritingROI(writingROI: WritingROI) {
    this.writingROI = writingROI
    this.resetGestureFilter()
  }

  handleGesture(command: GestureCommand): Stroke | null {
    if (command.type === 'END_STROKE') {
      const stroke = this.finishStroke()
      if (command.reason !== 'pinch-up') {
        this.hideCursor()
        this.resetGestureFilter()
      }
      return stroke
    }

    const mappedPoint = mapMirroredPoint(command.point, this.width, this.height, this.writingROI)
    if (!mappedPoint) return null
    const stabilizedPoint = stabilizeGesturePoint(
      this.gestureFilteredPoint,
      this.gestureRawPoint,
      mappedPoint,
    )
    this.gestureFilteredPoint = stabilizedPoint
    this.gestureRawPoint = mappedPoint

    this.updateCursor(stabilizedPoint, command.type === 'START_STROKE' || this.activeSource === 'gesture')
    if (command.type === 'START_STROKE') {
      this.startStroke(stabilizedPoint, command.timestamp, 'gesture')
      return null
    }

    if (this.activeSource === 'gesture') {
      this.appendPoint(stabilizedPoint, command.timestamp)
    }
    return null
  }

  startMouseStroke(point: CanvasPoint, timestamp: number) {
    if (!isFiniteCanvasPoint(point)) return
    this.startStroke(point, timestamp, 'mouse')
  }

  appendMousePoint(point: CanvasPoint, timestamp: number) {
    if (!isFiniteCanvasPoint(point) || this.activeSource !== 'mouse') return
    this.appendPoint(point, timestamp)
  }

  finishStroke(): Stroke | null {
    if (
      this.activeStroke
      && this.context
      && this.hasRenderedSegment
      && this.renderPoint
      && this.previousDrawnPoint
      && this.effectiveStyle(this.activeStroke.style) !== 'particle'
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
      style: this.effectsEnabled ? this.brush.style : 'ink',
      createdAt: Date.now(),
    }
    this.previousDrawnPoint = point
    this.renderPoint = point
  }

  private appendPoint(point: CanvasPoint, timestamp: number) {
    if (!this.activeStroke || !this.context || !this.previousDrawnPoint) return

    const acceptedPoint = point

    if (!isPointFarEnough(this.previousDrawnPoint, acceptedPoint)) return

    const midpoint = {
      x: (this.previousDrawnPoint.x + acceptedPoint.x) / 2,
      y: (this.previousDrawnPoint.y + acceptedPoint.y) / 2,
    }

    if (this.effectiveStyle(this.activeStroke.style) !== 'particle') {
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
    }

    const strokePoint: StrokePoint = { ...acceptedPoint, t: timestamp }
    this.activeStroke.points.push(strokePoint)
    this.renderPoint = midpoint
    this.previousDrawnPoint = acceptedPoint
    this.hasRenderedSegment = true
    if (this.activeStroke.style === 'particle' && this.effectsEnabled && !this.reducedMotion) {
      this.emitParticles(midpoint, this.activeStroke.color, timestamp)
    }
  }

  private redraw() {
    if (!this.context) return
    this.context.clearRect(0, 0, this.width, this.height)
    this.completedStrokes.forEach((stroke) => this.drawCompletedStroke(stroke))
    if (this.activeStroke && this.activeStroke.points.length >= 2) this.drawCompletedStroke(this.activeStroke)
    this.drawParticles(performance.now())
  }

  private drawCompletedStroke(stroke: Stroke) {
    if (!this.context || stroke.points.length < 2) return
    if (this.effectiveStyle(stroke.style) === 'particle') {
      this.drawParticleStroke(stroke)
      return
    }
    this.configureContext(stroke)
    this.drawStrokePath(stroke)
  }

  private drawStrokePath(stroke: Stroke) {
    if (!this.context || stroke.points.length < 2) return
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

  private drawParticleStroke(stroke: Stroke) {
    if (!this.context) return
    const density = this.performanceStage === 'full' ? 'full' : 'reduced'
    for (const particle of particleSamplesForStroke(stroke, density)) {
      this.context.beginPath()
      this.context.globalAlpha = particle.opacity
      this.context.fillStyle = stroke.color
      this.context.shadowColor = stroke.color
      this.context.shadowBlur = particle.blur
      this.context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
      this.context.fill()
    }
    this.context.globalAlpha = 1
    this.context.shadowColor = 'transparent'
    this.context.shadowBlur = 0
  }

  private configureContext(stroke: Pick<Stroke, 'color' | 'width' | 'style'>) {
    if (!this.context) return
    const style = this.effectiveStyle(stroke.style)
    this.context.strokeStyle = stroke.color
    this.context.lineWidth = stroke.width
    this.context.lineCap = 'round'
    this.context.lineJoin = 'round'
    this.context.globalAlpha = 1
    this.context.shadowColor = style === 'glow' && this.performanceStage !== 'no-trail' ? stroke.color : 'transparent'
    this.context.shadowBlur = style === 'glow' && this.performanceStage !== 'no-trail' ? Math.max(8, stroke.width * 3) : 0
  }

  private effectiveStyle(style: VisualStyle): VisualStyle {
    return this.effectsEnabled ? style : 'ink'
  }

  private emitParticles(point: CanvasPoint, color: string, createdAt: number) {
    const count = this.performanceStage === 'full' ? 5 : 2
    for (let index = 0; index < count; index += 1) {
      const angle = ((this.particles.length + index * 3) % 11) * (Math.PI * 2 / 11)
      const distance = 2 + (index % 3) * 2.2
      this.particles.push({
        x: point.x + Math.cos(angle) * distance,
        y: point.y + Math.sin(angle) * distance,
        color,
        size: Math.max(0.8, this.brush.width * (0.2 + (index % 3) * 0.1)),
        createdAt,
        lifetime: 900,
        blur: 0.8 + (index % 3) * 0.6,
      })
    }
    this.scheduleParticleFrame()
  }

  private drawParticles(now: number) {
    if (!this.context || !this.effectsEnabled || this.reducedMotion) return
    this.particles = this.particles.filter((particle) => now - particle.createdAt < particle.lifetime)
    for (const particle of this.particles) {
      const progress = Math.max(0, Math.min(1, (now - particle.createdAt) / particle.lifetime))
      this.context.globalAlpha = 1 - progress
      this.context.fillStyle = particle.color
      this.context.shadowColor = particle.color
      this.context.shadowBlur = particle.blur
      this.context.beginPath()
      this.context.arc(
        particle.x,
        particle.y - progress * 6,
        particle.size / 2,
        0,
        Math.PI * 2,
      )
      this.context.fill()
    }
    this.context.globalAlpha = 1
    this.context.shadowColor = 'transparent'
    this.context.shadowBlur = 0
  }

  private scheduleParticleFrame() {
    if (this.animationFrame !== null || this.particles.length === 0 || this.reducedMotion) return
    const requestFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)
    this.animationFrame = requestFrame(this.animateParticles)
  }

  private animateParticles = (now: number) => {
    this.animationFrame = null
    this.measureStylePerformance(now)
    this.redraw()
    if (this.particles.length > 0) this.scheduleParticleFrame()
  }

  private measureStylePerformance(now: number) {
    if (this.performanceWindowStartedAt === 0) this.performanceWindowStartedAt = now
    this.performanceFrameCount += 1
    const elapsed = now - this.performanceWindowStartedAt
    if (elapsed < 3000) return
    const fps = (this.performanceFrameCount * 1000) / elapsed
    if (fps < 24) {
      this.performanceStage = nextStylePerformanceStage(this.performanceStage, fps)
      this.performanceListener?.(this.performanceStage)
    }
    this.performanceWindowStartedAt = now
    this.performanceFrameCount = 0
  }

  private clearParticles() {
    this.particles = []
    if (this.animationFrame !== null) {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(this.animationFrame)
      else window.clearTimeout(this.animationFrame)
    }
    this.animationFrame = null
    this.performanceWindowStartedAt = 0
    this.performanceFrameCount = 0
  }

  private resetActiveStroke() {
    this.activeStroke = null
    this.activeSource = null
    this.previousDrawnPoint = null
    this.renderPoint = null
    this.hasRenderedSegment = false
  }

  private resetGestureFilter() {
    this.gestureFilteredPoint = null
    this.gestureRawPoint = null
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
