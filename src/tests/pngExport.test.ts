import { describe, expect, it, vi } from 'vitest'
import { calculateExportBounds, drawStroke, renderProjectImage, renderProjectPng } from '../export/pngExport'
import { DEFAULT_SETTINGS, type AirNoteProject } from '../types/workspace'

function visualProject(): AirNoteProject {
  return {
    schemaVersion: 2,
    workspace: { id: 'workspace', name: '图片', createdAt: 0, updatedAt: 0, viewport: { x: 0, y: 0, zoom: 1 } },
    strokes: [
      { id: 'free', points: [{ x: 100, y: 100, t: 0 }, { x: 200, y: 200, t: 16 }], color: '#172B3A', width: 4, style: 'ink', createdAt: 0 },
      { id: 'card-ink', points: [{ x: 310, y: 290, t: 0 }, { x: 400, y: 330, t: 16 }], color: '#d94a32', width: 2, style: 'ink', createdAt: 1, cardId: 'card-a' },
    ],
    groups: [],
    cards: [
      { id: 'card-a', kind: 'ink', strokeIds: ['card-ink'], title: '导出卡片', position: { x: 300, y: 250 }, size: { width: 200, height: 120 } },
      { id: 'card-b', kind: 'ink', strokeIds: [], title: '目标', position: { x: 560, y: 250 }, size: { width: 160, height: 120 } },
    ],
    edges: [{ id: 'edge', sourceCardId: 'card-a', targetCardId: 'card-b', type: 'directed' }],
    settings: structuredClone(DEFAULT_SETTINGS),
  }
}

function canvasHarness() {
  const shadowBlurValues: number[] = []
  let shadowBlur = 0
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '', font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, shadowColor: 'transparent',
    clearRect: vi.fn(), fillRect: vi.fn(), setTransform: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), measureText: vi.fn(() => ({ width: 8 })),
    closePath: vi.fn(), fill: vi.fn(), save: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn(),
    strokeRect: vi.fn(), fillText: vi.fn(),
  }
  Object.defineProperty(context, 'shadowBlur', {
    get: () => shadowBlur,
    set: (value: number) => {
      shadowBlur = value
      shadowBlurValues.push(value)
    },
  })
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement
  return { canvas, context, shadowBlurValues }
}

describe('SAVE-02 PNG export renderer', () => {
  it('uses project content bounds with export padding', () => {
    expect(calculateExportBounds(visualProject())).toEqual({ x: 50, y: 50, width: 718, height: 368 })
  })

  it('renders strokes, cards, titles and edges into a standalone canvas', () => {
    const { canvas, context } = canvasHarness()
    const bounds = renderProjectPng(visualProject(), canvas)
    expect(bounds).toEqual({ x: 50, y: 50, width: 718, height: 368 })
    expect(canvas.width).toBe(718)
    expect(canvas.height).toBe(368)
    expect(context.stroke).toHaveBeenCalled()
    expect(context.strokeRect).toHaveBeenCalledTimes(2)
    expect(context.fillText).toHaveBeenCalledWith('导出卡片', 310, 269)
    expect(context.fillText).toHaveBeenCalledWith('目标', 570, 269)
  })

  it('keeps PNG transparent and gives JPG a white background', () => {
    const png = canvasHarness()
    renderProjectImage(visualProject(), png.canvas, 'png')
    expect(png.context.clearRect).toHaveBeenCalled()
    expect(png.context.fillRect).toHaveBeenCalledTimes(4)
    const jpg = canvasHarness()
    renderProjectImage(visualProject(), jpg.canvas, 'jpg')
    expect(jpg.context.fillRect).toHaveBeenCalledTimes(5)
  })

  it('reflects enabled Glow and Particle styles without changing Stroke points', () => {
    const project = visualProject()
    project.settings.experimentalStylesEnabled = true
    project.strokes[0].style = 'glow'
    project.strokes[1].style = 'particle'
    const pointsBefore = structuredClone(project.strokes.map((stroke) => stroke.points))
    const { canvas, context, shadowBlurValues } = canvasHarness()
    renderProjectPng(project, canvas)
    expect(shadowBlurValues.some((value) => value > 0)).toBe(true)
    expect(context.arc).toHaveBeenCalled()
    expect(project.strokes.map((stroke) => stroke.points)).toEqual(pointsBefore)
  })

  it('exports a Particle-only Stroke without a center path', () => {
    const project = visualProject()
    project.settings.experimentalStylesEnabled = true
    const stroke = { ...project.strokes[0], style: 'particle' as const }
    const { context } = canvasHarness()

    drawStroke(context as unknown as CanvasRenderingContext2D, stroke, undefined, 1, true)
    expect(context.arc).toHaveBeenCalled()
    expect(context.stroke).not.toHaveBeenCalled()
  })
})
