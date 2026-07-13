import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createHandTracker } from '../handTracking/handTracker'
import { startVideoFrameLoop } from '../handTracking/videoFrameLoop'
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
    expect(getUserMedia).not.toHaveBeenCalled()
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

  it('updates and persists the three-level brush width', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '8px' }))
    expect(screen.getByRole('button', { name: '8px' })).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.width).toBe(8)
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

    for (const timestamp of [0, 16, 32, 48, 64]) {
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
