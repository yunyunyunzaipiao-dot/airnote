import { describe, expect, it, vi } from 'vitest'
import { DiagnosticCanvasRenderer } from '../drawing/canvasRenderer'

describe('diagnostic canvas renderer', () => {
  it('draws accepted points directly through Canvas 2D', () => {
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

    const renderer = new DiagnosticCanvasRenderer()
    renderer.attach(canvas)
    renderer.handle({ type: 'START_STROKE', point: { x: 0.8, y: 0.2 } })
    renderer.handle({ type: 'APPEND_POINT', point: { x: 0.7, y: 0.3 } })

    expect(context.beginPath).toHaveBeenCalledTimes(1)
    const [moveX, moveY] = vi.mocked(context.moveTo).mock.calls[0]
    const [lineX, lineY] = vi.mocked(context.lineTo).mock.calls[0]
    expect(moveX).toBeCloseTo(20)
    expect(moveY).toBeCloseTo(20)
    expect(lineX).toBeCloseTo(22.5)
    expect(lineY).toBeCloseTo(22.5)
    expect(context.stroke).toHaveBeenCalledTimes(1)
  })

  it('does not draw sub-two-pixel movement', () => {
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

    const renderer = new DiagnosticCanvasRenderer()
    renderer.attach(canvas)
    renderer.handle({ type: 'START_STROKE', point: { x: 0.5, y: 0.5 } })
    renderer.handle({ type: 'APPEND_POINT', point: { x: 0.49, y: 0.5 } })

    expect(context.stroke).not.toHaveBeenCalled()
  })

  it('keeps drawing when a valid tracked point moves quickly', () => {
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

    const renderer = new DiagnosticCanvasRenderer()
    renderer.attach(canvas)
    renderer.handle({ type: 'START_STROKE', point: { x: 0.8, y: 0.2 } })
    renderer.handle({ type: 'APPEND_POINT', point: { x: 0.1, y: 0.9 } })

    const [moveX, moveY] = vi.mocked(context.moveTo).mock.calls[0]
    expect(moveX).toBeCloseTo(20)
    expect(moveY).toBeCloseTo(20)
    expect(context.stroke).toHaveBeenCalledTimes(1)
  })

  it('uses midpoint quadratic curves after the first accepted segment', () => {
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

    const renderer = new DiagnosticCanvasRenderer()
    renderer.attach(canvas)
    renderer.handle({ type: 'START_STROKE', point: { x: 0.8, y: 0.2 } })
    renderer.handle({ type: 'APPEND_POINT', point: { x: 0.7, y: 0.3 } })
    renderer.handle({ type: 'APPEND_POINT', point: { x: 0.6, y: 0.4 } })

    expect(context.quadraticCurveTo).toHaveBeenCalledTimes(1)
    expect(context.quadraticCurveTo).toHaveBeenCalledWith(25, 25, 28.75, 28.75)
  })
})
