import { describe, expect, it, vi } from 'vitest'
import { nextStylePerformanceStage, StrokeCanvasRenderer } from '../drawing/canvasRenderer'

function createRenderer() {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { value: 100 })
  Object.defineProperty(canvas, 'clientHeight', { value: 100 })
  vi.spyOn(canvas, 'getContext').mockReturnValue(context)
  const renderer = new StrokeCanvasRenderer()
  renderer.attach(canvas)
  return { renderer, context }
}

describe('stroke canvas renderer', () => {
  it('returns a formal gesture Stroke only after pen-up', () => {
    const { renderer, context } = createRenderer()
    renderer.handleGesture({ type: 'START_STROKE', point: { x: 0.8, y: 0.2 }, timestamp: 10 })
    renderer.handleGesture({ type: 'APPEND_POINT', point: { x: 0.7, y: 0.3 }, timestamp: 20 })
    const stroke = renderer.handleGesture({ type: 'END_STROKE', reason: 'pinch-up' })

    expect(stroke).toMatchObject({ color: '#172B3A', width: 4, style: 'ink' })
    expect(stroke?.points).toHaveLength(2)
    expect(stroke?.points[0].x).toBeCloseTo(20)
    expect(stroke?.points[0].y).toBeCloseTo(20)
    expect(stroke?.points[0].t).toBe(10)
    expect(context.stroke).toHaveBeenCalled()
  })

  it('stabilizes the hover cursor before drawing starts', () => {
    const { renderer } = createRenderer()
    const cursor = document.createElement('div')
    renderer.attachCursor(cursor)
    renderer.handleGesture({ type: 'APPEND_POINT', point: { x: 0.5, y: 0.5 }, timestamp: 10 })
    expect(cursor.style.transform).toBe('translate3d(50px, 50px, 0)')

    renderer.handleGesture({ type: 'APPEND_POINT', point: { x: 0.48, y: 0.49 }, timestamp: 20 })
    expect(cursor.style.transform).toBe('translate3d(50px, 50px, 0)')

    renderer.handleGesture({ type: 'APPEND_POINT', point: { x: 0.3, y: 0.5 }, timestamp: 30 })
    expect(cursor.style.transform).not.toBe('translate3d(50px, 50px, 0)')
  })

  it('discards a Stroke with fewer than two accepted points', () => {
    const { renderer } = createRenderer()
    renderer.handleGesture({ type: 'START_STROKE', point: { x: 0.5, y: 0.5 }, timestamp: 10 })
    renderer.handleGesture({ type: 'APPEND_POINT', point: { x: 0.49, y: 0.5 }, timestamp: 20 })
    expect(renderer.finishStroke()).toBeNull()
  })

  it('keeps the brush snapshot when settings change during a Stroke', () => {
    const { renderer } = createRenderer()
    renderer.setBrush({ color: '#AA0000', width: 8, style: 'ink' })
    renderer.startMouseStroke({ x: 10, y: 10 }, 10)
    renderer.setBrush({ color: '#0000AA', width: 2, style: 'ink' })
    renderer.appendMousePoint({ x: 20, y: 20 }, 20)

    expect(renderer.finishStroke()).toMatchObject({ color: '#AA0000', width: 8 })
  })

  it('redraws completed strokes without changing their points', () => {
    const { renderer, context } = createRenderer()
    const points = [{ x: 5, y: 5, t: 1 }, { x: 15, y: 15, t: 2 }]
    renderer.setCompletedStrokes([{
      id: 'stroke-1',
      points,
      color: '#172B3A',
      width: 4,
      style: 'ink',
      createdAt: 1,
    }])

    expect(context.lineTo).toHaveBeenCalledWith(15, 15)
    expect(points).toEqual([{ x: 5, y: 5, t: 1 }, { x: 15, y: 15, t: 2 }])
  })

  it('keeps Ink as the safe default and snapshots an enabled Glow style', () => {
    const { renderer, context } = createRenderer()
    renderer.setBrush({ color: '#33AAFF', width: 4, style: 'glow' })
    renderer.startMouseStroke({ x: 10, y: 10 }, 10)
    renderer.appendMousePoint({ x: 20, y: 20 }, 20)
    expect(renderer.finishStroke()?.style).toBe('ink')

    renderer.setEffectsEnabled(true)
    renderer.startMouseStroke({ x: 20, y: 20 }, 30)
    renderer.appendMousePoint({ x: 30, y: 30 }, 40)
    const glow = renderer.finishStroke()
    expect(glow?.style).toBe('glow')
    expect(context.shadowBlur).toBeGreaterThan(0)
    expect(glow?.points).toEqual([{ x: 20, y: 20, t: 30 }, { x: 30, y: 30, t: 40 }])
  })

  it('degrades experimental effects in the documented order below 24 FPS', () => {
    expect(nextStylePerformanceStage('full', 23)).toBe('reduced-particles')
    expect(nextStylePerformanceStage('reduced-particles', 23)).toBe('no-trail')
    expect(nextStylePerformanceStage('no-trail', 10)).toBe('no-trail')
    expect(nextStylePerformanceStage('full', 24)).toBe('full')
  })

  it('renders persistent Particle dots without changing completed Stroke points', () => {
    const { renderer, context } = createRenderer()
    const points = [{ x: 5, y: 20, t: 1 }, { x: 45, y: 20, t: 2 }, { x: 85, y: 20, t: 3 }]
    renderer.setEffectsEnabled(true)
    renderer.setCompletedStrokes([{
      id: 'particle-stroke',
      points,
      color: '#55AAEE',
      width: 4,
      style: 'particle',
      createdAt: 1,
    }])

    expect(context.arc).toHaveBeenCalled()
    expect(context.fill).toHaveBeenCalled()
    expect(context.stroke).not.toHaveBeenCalled()
    expect(points).toEqual([{ x: 5, y: 20, t: 1 }, { x: 45, y: 20, t: 2 }, { x: 85, y: 20, t: 3 }])
  })

  it('never strokes a center path while an enabled Particle Stroke is being drawn', () => {
    const { renderer, context } = createRenderer()
    renderer.setEffectsEnabled(true)
    renderer.setBrush({ color: '#55AAEE', width: 4, style: 'particle' })

    renderer.startMouseStroke({ x: 10, y: 10 }, 10)
    renderer.appendMousePoint({ x: 30, y: 30 }, 20)
    const stroke = renderer.finishStroke()

    expect(stroke?.style).toBe('particle')
    expect(context.stroke).not.toHaveBeenCalled()
  })
})
