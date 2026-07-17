import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createHandTracker } from '../handTracking/handTracker'
import { startVideoFrameLoop } from '../handTracking/videoFrameLoop'
import { projectFromDocument } from '../store/workspaceDocument'
import { DEFAULT_SETTINGS } from '../types/workspace'
import type { HandFrame, NormalizedPoint } from '../types/m0'

vi.mock('../handTracking/handTracker', () => ({
  createHandTracker: vi.fn(async () => ({ detect: vi.fn(), close: vi.fn() })),
}))

vi.mock('../handTracking/videoFrameLoop', () => ({
  startVideoFrameLoop: vi.fn(() => ({ stop: vi.fn() })),
}))

const mockedCreateHandTracker = vi.mocked(createHandTracker)
const mockedStartVideoFrameLoop = vi.mocked(startVideoFrameLoop)

function createStream() {
  const stop = vi.fn()
  const settings = { width: 640, height: 480, frameRate: 30, deviceId: 'camera-1' }
  const track = { stop, getSettings: () => settings }
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
  return { stream, stop }
}

function drawMouseStroke() {
  const canvas = screen.getByLabelText('鼠标绘图画布')
  fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
}

function handFrame(timestamp: number, ratio: number, indexX = 0.5): HandFrame {
  const landmarks: NormalizedPoint[] = Array.from(
    { length: 21 },
    () => ({ x: 0.5, y: 0.5, z: 0 }),
  )
  landmarks[5] = { x: 0, y: 0 }
  landmarks[17] = { x: 1, y: 0 }
  landmarks[8] = { x: indexX, y: 0.5 }
  landmarks[4] = { x: indexX + ratio, y: 0.5 }
  return { landmarks, timestamp, inferenceMs: 5 }
}

describe('AirNote M1 workspace', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    mockedCreateHandTracker.mockResolvedValue({ detect: vi.fn(), close: vi.fn() })
    mockedStartVideoFrameLoop.mockReturnValue({ stop: vi.fn() })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent })
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('renders mouse fallback without requesting camera permission', () => {
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })

    render(<App />)

    expect(screen.getByRole('heading', { name: '鼠标画笔已启用' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '摄像头预览' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '手势状态' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '摄像头预览' }).closest('aside')).toHaveClass('context-rail--input')
    expect(screen.getByRole('heading', { name: '手势状态' }).closest('aside')).toHaveClass('context-rail--input')
    expect(screen.getByRole('heading', { name: '画笔属性' }).closest('aside')).toHaveClass('context-rail--settings')
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('opens Chinese themes from the 空 button and restores the local choice', () => {
    localStorage.setItem('airnote.uiTheme', 'night')
    const { unmount } = render(<App />)

    expect(document.documentElement).toHaveAttribute('data-ui-theme', 'night')
    const themeTrigger = screen.getByRole('button', { name: '打开界面主题' })
    expect(themeTrigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(themeTrigger)
    expect(themeTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { name: '选择主题' })).toBeInTheDocument()
    expect(screen.getByText('明亮色')).toBeInTheDocument()
    expect(screen.getByText('低饱和色')).toBeInTheDocument()
    expect(screen.getByText('纯色')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /全黑界面/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /晴空蓝/ }))
    expect(document.documentElement).toHaveAttribute('data-ui-theme', 'sky')
    expect(localStorage.getItem('airnote.uiTheme')).toBe('sky')
    expect(screen.getByRole('button', { name: /晴空蓝/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('heading', { name: '选择主题' })).not.toBeInTheDocument()
    expect(themeTrigger).toHaveFocus()

    unmount()
    render(<App />)
    expect(document.documentElement).toHaveAttribute('data-ui-theme', 'sky')
  })

  it('creates a mouse Stroke and supports undo and redo', () => {
    render(<App />)
    expect(screen.getByText('Ctrl/Cmd+Z')).toBeInTheDocument()
    expect(screen.getByText('Ctrl/Cmd+Shift+Z')).toBeInTheDocument()
    drawMouseStroke()
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(screen.getByText('0 STROKES')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重做' }))
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('suggests one group after 1.2 seconds and only creates a card after confirmation', () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      drawMouseStroke()
      act(() => vi.advanceTimersByTime(1199))
      expect(screen.queryByRole('button', { name: '生成想法卡片' })).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      fireEvent.click(screen.getByRole('button', { name: '生成想法卡片' }))
      expect(screen.getByText('未命名想法')).toBeInTheDocument()
      expect(screen.getByText('1 CARDS / 0 EDGES')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /连接点创建连接/ })).toHaveLength(4)
      expect(screen.getByRole('button', { name: '调整卡片 未命名想法 大小' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '撤销' }))
      expect(screen.queryByText('未命名想法')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '生成想法卡片' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('makes the 03 card entry actionable without bypassing card confirmation', () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      const cardEntry = screen.getByRole('button', { name: '03 卡片' })
      expect(cardEntry).toBeEnabled()

      fireEvent.click(cardEntry)
      const workspaceStatus = screen.getByRole('status')
      expect(workspaceStatus).toHaveTextContent('请先用画笔完成一组笔画')
      expect(workspaceStatus.closest('aside')).toHaveClass('context-rail--input')
      expect(screen.queryByText('未命名想法')).not.toBeInTheDocument()

      drawMouseStroke()
      act(() => vi.advanceTimersByTime(1200))
      fireEvent.click(cardEntry)
      expect(screen.getByText('未命名想法')).toBeInTheDocument()
      expect(screen.getByText('1 CARDS / 0 EDGES')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('forces mouse fallback on refresh even if gesture mode was previously stored', () => {
    localStorage.setItem('airnote.settings.current', JSON.stringify({
      ...DEFAULT_SETTINGS,
      inputMode: 'gesture',
      gesture: { ...DEFAULT_SETTINGS.gesture, calibrated: true },
    }))
    render(<App />)
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ends an active mouse Stroke when the window loses focus', () => {
    render(<App />)
    const canvas = screen.getByLabelText('鼠标绘图画布')
    fireEvent.pointerDown(canvas, { pointerId: 2, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 30, clientY: 30 })
    fireEvent.blur(window)
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('explains the supported-browser requirement when Pointer Events are missing', () => {
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: undefined })
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('当前浏览器不受支持，请使用最新版 Chrome 或 Edge。')
  })

  it('requires confirmation before clearing and allows one undo', () => {
    render(<App />)
    drawMouseStroke()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    fireEvent.click(screen.getByRole('button', { name: '清空' }))
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清空' }))
    expect(screen.getByText('0 STROKES')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('画布已清空，可撤销。')
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledWith('将清空当前画布中的笔迹、卡片和连接线。此操作可撤销一次。')
  })

  it('keeps the current canvas for invalid or cancelled imports and replaces only after confirmation', async () => {
    render(<App />)
    drawMouseStroke()
    const fileInput = screen.getByLabelText('选择项目JSON')
    const invalidFile = new File(['{broken'], 'broken.json', { type: 'application/json' })
    Object.defineProperty(invalidFile, 'text', { value: vi.fn().mockResolvedValue('{broken') })
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    expect(await screen.findByRole('status')).toHaveTextContent('项目文件格式不正确，当前画布未被修改。')
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()

    const importedDocument = {
      workspace: { id: 'import-workspace', name: '导入项目', createdAt: 0, updatedAt: 0, viewport: { x: 0, y: 0, zoom: 1 } },
      strokes: [
        { id: 'import-1', points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 10, t: 16 }], color: '#172B3A', width: 4 as const, style: 'ink' as const, createdAt: 0 },
        { id: 'import-2', points: [{ x: 20, y: 20, t: 0 }, { x: 30, y: 30, t: 16 }], color: '#172B3A', width: 4 as const, style: 'ink' as const, createdAt: 1 },
      ],
      groups: [],
      cards: [],
      edges: [],
    }
    const json = JSON.stringify(projectFromDocument(importedDocument, { ...DEFAULT_SETTINGS, inputMode: 'gesture' }))
    const projectFile = new File([json], 'airnote.json', { type: 'application/json' })
    Object.defineProperty(projectFile, 'text', { value: vi.fn().mockResolvedValue(json) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    fireEvent.change(fileInput, { target: { files: [projectFile] } })
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()

    fireEvent.change(fileInput, { target: { files: [projectFile] } })
    await waitFor(() => expect(screen.getByText('2 STROKES')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('项目已导入并保存到本地。')
    expect(JSON.parse(localStorage.getItem('airnote.workspace.current')!).strokes).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem('airnote.workspace.current')!).settings.inputMode).toBe('mouse')
    expect(confirm).toHaveBeenCalledWith('导入项目将替换当前画布。是否继续？')
  })

  it('updates and persists the three-level brush width', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '8px' }))
    expect(screen.getByRole('button', { name: '8px' })).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.width).toBe(8)
  })

  it('updates and persists color through the custom HSV picker', () => {
    render(<App />)
    expect(screen.getByRole('slider', { name: '色相环' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: '色相 H' }), { target: { value: '180' } })
    fireEvent.change(screen.getByRole('slider', { name: '饱和度 S' }), { target: { value: '100' } })
    fireEvent.change(screen.getByRole('slider', { name: '明度 V' }), { target: { value: '100' } })
    expect(screen.getByRole('textbox', { name: '十六进制颜色' })).toHaveValue('#00FFFF')
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.color).toBe('#00FFFF')

    fireEvent.change(screen.getByRole('textbox', { name: '十六进制颜色' }), { target: { value: '#123456' } })
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.color).toBe('#123456')
  })

  it('keeps at most six committed colors and restores one from history', () => {
    render(<App />)
    const input = screen.getByRole('textbox', { name: '十六进制颜色' })
    const colors = ['#110000', '#220000', '#330000', '#440000', '#550000', '#660000', '#770000']

    for (const color of colors) {
      fireEvent.change(input, { target: { value: color } })
      fireEvent.blur(input)
    }

    const history = screen.getByRole('list', { name: '颜色历史' })
    expect(history.querySelectorAll('button')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: '使用历史颜色 #110000' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('airnote.colorHistory')!)).toEqual(colors.slice(1).reverse())

    fireEvent.click(screen.getByRole('button', { name: '使用历史颜色 #220000' }))
    expect(input).toHaveValue('#220000')
  })

  it('keeps experimental visual styles behind an explicit switch', () => {
    render(<App />)
    const styleSelect = screen.getByRole('combobox', { name: '视觉风格' })
    expect(styleSelect).toBeDisabled()
    expect(styleSelect).toHaveValue('ink')

    fireEvent.click(screen.getByRole('button', { name: '启用' }))
    fireEvent.change(styleSelect, { target: { value: 'glow' } })
    expect(styleSelect).toHaveValue('glow')
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).experimentalStylesEnabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.style).toBe('glow')

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(styleSelect).toBeDisabled()
    expect(styleSelect).toHaveValue('ink')
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.style).toBe('ink')
  })

  it('keeps a visible Particle field after a Stroke becomes a card', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<App />)
      fireEvent.click(screen.getByRole('button', { name: '启用' }))
      fireEvent.change(screen.getByRole('combobox', { name: '视觉风格' }), { target: { value: 'particle' } })
      drawMouseStroke()
      act(() => vi.advanceTimersByTime(1200))
      fireEvent.click(screen.getByRole('button', { name: '生成想法卡片' }))

      expect(container.querySelectorAll('.card-stroke--particle circle').length).toBeGreaterThan(2)
      expect(container.querySelector('.card-stroke--particle polyline')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('requests 640x480 video without audio only after click', async () => {
    const { stream } = createStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1))
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false,
    })
    expect(await screen.findByText('实际输入 640×480 · 30 FPS')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '书写校准' })).toBeInTheDocument()
  })

  it('allows explicit default calibration and enables gesture mode', async () => {
    const { stream } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    expect(screen.getByRole('button', { name: '设置手势模式' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '直接使用默认参数' }))

    expect(screen.getByRole('button', { name: '手势模式' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('手势边缘提示')).toBeInTheDocument()
    expect(screen.getByText('已明确使用默认书写区域和捏合灵敏度。')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).gesture.calibrated).toBe(true)
  })

  it('draws with pinch after switching from mouse to explicit default gesture mode', async () => {
    const { stream } = createStream()
    let processFrame: ((timestamp: number) => void) | undefined
    const frames = [
      handFrame(0, 0.7, 0.5),
      handFrame(16, 0.3, 0.5),
      handFrame(32, 0.3, 0.5),
      handFrame(48, 0.3, 0.4),
      handFrame(64, 0.43, 0.4),
      handFrame(80, 0.43, 0.4),
    ]
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    mockedCreateHandTracker.mockResolvedValueOnce({
      detect: vi.fn(() => frames.shift()!),
      close: vi.fn(),
    })
    mockedStartVideoFrameLoop.mockImplementationOnce((_video, onFrame) => {
      processFrame = onFrame
      return { stop: vi.fn() }
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    fireEvent.click(screen.getByRole('button', { name: '直接使用默认参数' }))
    fireEvent.click(screen.getByRole('button', { name: '鼠标模式' }))
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '手势模式' }))

    for (const timestamp of [0, 16, 32, 48, 64, 80]) {
      act(() => processFrame?.(timestamp))
    }

    expect(screen.getByRole('button', { name: '手势模式' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('stops every camera track when closed and remains in mouse mode', async () => {
    const { stream, stop } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    fireEvent.click(await screen.findByRole('button', { name: '关闭摄像头' }))

    expect(stop).toHaveBeenCalledTimes(1)
    expect(screen.getByText('已关闭')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['NotAllowedError', '无法访问摄像头'],
    ['NotFoundError', '未检测到可用摄像头'],
    ['NotReadableError', '摄像头可能正被其他应用占用'],
  ])('shows a useful message for %s while preserving mouse drawing', async (name, message) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('failed', name)) },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    drawMouseStroke()
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('falls back to mouse mode when runtime tracking fails without stopping video', async () => {
    const { stream, stop } = createStream()
    let processFrame: ((timestamp: number) => void) | undefined
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    mockedCreateHandTracker.mockResolvedValueOnce({
      detect: vi.fn(() => { throw new Error('runtime failed') }),
      close: vi.fn(),
    })
    mockedStartVideoFrameLoop.mockImplementationOnce((_video, onFrame) => {
      processFrame = onFrame
      return { stop: vi.fn() }
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    act(() => processFrame?.(100))

    expect(await screen.findByRole('alert')).toHaveTextContent('已切换为鼠标模式')
    expect(stop).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
  })
})
