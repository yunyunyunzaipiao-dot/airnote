import { describe, expect, it, vi } from 'vitest'
import { StrokeCanvasRenderer } from '../drawing/canvasRenderer'

function createRenderer() {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
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
})
