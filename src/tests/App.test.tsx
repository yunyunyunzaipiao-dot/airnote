import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

const TEST_WORKSPACE_ID = 'test-workspace'

function renderApp(path = `/workspace/${TEST_WORKSPACE_ID}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

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

function calibrationFrame(
  timestamp: number,
  ratio: number,
  indexX: number,
  indexY: number,
): HandFrame {
  const frame = handFrame(timestamp, ratio, indexX)
  frame.landmarks![8] = { x: indexX, y: indexY }
  frame.landmarks![4] = { x: indexX + ratio, y: indexY }
  return frame
}

function openPalmFrame(timestamp: number): HandFrame {
  const landmarks: NormalizedPoint[] = Array.from(
    { length: 21 },
    () => ({ x: 0.5, y: 0.7, z: 0 }),
  )
  landmarks[0] = { x: 0.5, y: 0.9 }
  landmarks[3] = { x: 0.35, y: 0.75 }
  landmarks[4] = { x: 0.2, y: 0.65 }
  landmarks[5] = { x: 0.42, y: 0.65 }
  landmarks[6] = { x: 0.4, y: 0.5 }
  landmarks[8] = { x: 0.38, y: 0.2 }
  landmarks[10] = { x: 0.48, y: 0.48 }
  landmarks[12] = { x: 0.48, y: 0.14 }
  landmarks[14] = { x: 0.56, y: 0.5 }
  landmarks[16] = { x: 0.58, y: 0.2 }
  landmarks[17] = { x: 0.62, y: 0.67 }
  landmarks[18] = { x: 0.64, y: 0.55 }
  landmarks[20] = { x: 0.72, y: 0.3 }
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

    renderApp()

    expect(screen.getByRole('heading', { name: '鼠标画笔已启用' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '启用张掌暂停' })).toHaveAttribute('aria-pressed', 'false')
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('keeps GEST-02 behind a local experimental switch', () => {
    const { unmount } = renderApp()
    const enablePause = screen.getByRole('button', { name: '启用张掌暂停' })
    fireEvent.click(enablePause)

    expect(screen.getByText('张掌暂停已启用：张开手掌保持 0.8 秒可暂停或恢复。')).toBeInTheDocument()
    expect(localStorage.getItem('airnote.gesturePauseEnabled')).toBe('true')

    unmount()
    renderApp()
    expect(screen.getByRole('button', { name: '关闭张掌暂停' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens Chinese themes from the 空 button and restores the local choice', () => {
    localStorage.setItem('airnote.uiTheme', 'night')
    const { unmount } = renderApp()

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
    renderApp()
    expect(document.documentElement).toHaveAttribute('data-ui-theme', 'sky')
  })

  it('creates a mouse Stroke and supports undo and redo', () => {
    renderApp()
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
      renderApp()
      drawMouseStroke()
      act(() => vi.advanceTimersByTime(1199))
      expect(screen.queryByRole('button', { name: '生成想法卡片' })).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      fireEvent.click(screen.getByRole('button', { name: '生成想法卡片' }))
      expect(screen.getByRole('textbox', { name: '卡片文字注释' })).toHaveValue('')
      expect(screen.getByText('1 CARDS / 0 EDGES')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /连接点创建连接/ })).toHaveLength(4)
      expect(screen.getAllByRole('button', { name: /调整卡片 未命名想法 大小/ })).toHaveLength(4)
      fireEvent.click(screen.getByRole('button', { name: '撤销' }))
      expect(screen.queryByRole('textbox', { name: '卡片文字注释' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '生成想法卡片' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses icon tools without separate card or edge buttons', () => {
    renderApp()
    expect(screen.getByRole('button', { name: '选择卡片' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择笔画区域' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '画笔' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '03 卡片' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '04 连线' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '选择笔画区域' }))
    expect(screen.getByRole('menuitem', { name: '矩形框选笔画' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '自由套索笔画' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '画笔' }))
    expect(screen.getByRole('button', { name: '墨迹画笔' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '辉光画笔' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '粒子画笔' })).toBeDisabled()
  })

  it('turns a rectangle selection into a card suggestion that still needs confirmation', () => {
    renderApp()
    drawMouseStroke()
    fireEvent.click(screen.getByRole('button', { name: '选择笔画区域' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '矩形框选笔画' }))

    const canvas = screen.getByLabelText('鼠标绘图画布')
    fireEvent.pointerDown(canvas, { pointerId: 2, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 60, clientY: 60 })
    expect(screen.queryByText('未命名想法')).not.toBeInTheDocument()
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 60, clientY: 60 })

    expect(screen.getByRole('button', { name: '生成想法卡片' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('确认后才会生成想法卡片')
    fireEvent.click(screen.getByRole('button', { name: '生成想法卡片' }))
    expect(screen.getByText('1 CARDS / 0 EDGES')).toBeInTheDocument()
  })

  it('supports a freeform lasso without creating a card automatically', () => {
    renderApp()
    drawMouseStroke()
    fireEvent.click(screen.getByRole('button', { name: '选择笔画区域' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '自由套索笔画' }))

    const canvas = screen.getByLabelText('鼠标绘图画布')
    fireEvent.pointerDown(canvas, { pointerId: 3, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 60, clientY: 0 })
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 60, clientY: 60 })
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 0, clientY: 60 })
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 0, clientY: 0 })

    expect(screen.getByRole('button', { name: '生成想法卡片' })).toBeInTheDocument()
    expect(screen.queryByText('未命名想法')).not.toBeInTheDocument()
  })

  it('accepts keyboard text immediately after a card is generated', () => {
    vi.useFakeTimers()
    try {
      renderApp()
      drawMouseStroke()
      act(() => vi.advanceTimersByTime(1200))
      fireEvent.click(screen.getByRole('button', { name: '生成想法卡片' }))
      const annotation = screen.getByRole('textbox', { name: '卡片文字注释' })

      fireEvent.change(annotation, { target: { value: '键盘记录的想法' } })
      fireEvent.keyDown(annotation, { key: 'Enter' })

      expect(screen.getByText('键盘记录的想法')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '键盘输入卡片文字注释：键盘记录的想法' })).toBeInTheDocument()
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
    renderApp()
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ends an active mouse Stroke when the window loses focus', () => {
    renderApp()
    const canvas = screen.getByLabelText('鼠标绘图画布')
    fireEvent.pointerDown(canvas, { pointerId: 2, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 30, clientY: 30 })
    fireEvent.blur(window)
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('explains the supported-browser requirement when Pointer Events are missing', () => {
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: undefined })
    renderApp()
    expect(screen.getByRole('alert')).toHaveTextContent('当前浏览器不受支持，请使用最新版 Chrome 或 Edge。')
  })

  it('requires confirmation before clearing and allows one undo', () => {
    renderApp()
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
    renderApp()
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
    expect(JSON.parse(localStorage.getItem(`airnote.workspace.${TEST_WORKSPACE_ID}`)!).strokes).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(`airnote.workspace.${TEST_WORKSPACE_ID}`)!).settings.inputMode).toBe('mouse')
    expect(confirm).toHaveBeenCalledWith('导入项目将替换当前画布。是否继续？')
  })

  it('updates and persists the three-level brush width', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '画笔' }))
    fireEvent.click(screen.getByRole('button', { name: '笔迹粗细 8px' }))
    expect(screen.getByRole('button', { name: '笔迹粗细 8px' })).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.width).toBe(8)
  })

  it('updates and persists color through the color dots', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '画笔' }))
    fireEvent.click(screen.getByRole('button', { name: '选择颜色 #007AFF' }))
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.color).toBe('#007AFF')

    fireEvent.click(screen.getByRole('button', { name: '选择颜色 #FF3B30' }))
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.color).toBe('#FF3B30')
  })

  it('keeps at most six committed colors and restores one from history', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '画笔' }))
    const colors = ['#000000', '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF']

    for (const color of colors) {
      fireEvent.click(screen.getByRole('button', { name: `选择颜色 ${color}` }))
    }

    const history = screen.getByRole('list', { name: '颜色历史' })
    expect(history.querySelectorAll('button')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: '使用历史颜色 #000000' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('airnote.colorHistory')!)).toEqual(colors.slice(1).reverse())

    fireEvent.click(screen.getByRole('button', { name: '使用历史颜色 #FF3B30' }))
  })

  it('keeps experimental visual styles behind an explicit switch', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '画笔' }))
    expect(screen.getByRole('button', { name: '辉光画笔' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '工具栏启用实验视觉' }))
    fireEvent.click(screen.getByRole('button', { name: '辉光画笔' }))
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).experimentalStylesEnabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.style).toBe('glow')

    fireEvent.click(screen.getByRole('button', { name: '工具栏关闭实验视觉' }))
    expect(JSON.parse(localStorage.getItem('airnote.settings.current')!).brush.style).toBe('ink')
  })

  it('keeps a visible Particle field after a Stroke becomes a card', () => {
    vi.useFakeTimers()
    try {
      const { container } = renderApp()
      fireEvent.click(screen.getByRole('button', { name: '工具栏启用实验视觉' }))
      fireEvent.click(screen.getByRole('button', { name: '画笔' }))
      fireEvent.click(screen.getByRole('button', { name: '粒子画笔' }))
      drawMouseStroke()
      act(() => vi.advanceTimersByTime(1200))
      fireEvent.click(screen.getByRole('button', { name: '生成想法卡片' }))

      expect(container.querySelectorAll('.card-stroke--particle circle').length).toBeGreaterThan(2)
      expect(container.querySelector('.card-stroke--particle polyline')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a Particle test Stroke created during calibration review and falls back to Ink safely', async () => {
    const { stream } = createStream()
    let processFrame: ((timestamp: number) => void) | undefined
    let nextFrame: HandFrame | undefined
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    mockedCreateHandTracker.mockResolvedValueOnce({
      detect: vi.fn(() => nextFrame!),
      close: vi.fn(),
    })
    mockedStartVideoFrameLoop.mockImplementationOnce((_video, onFrame) => {
      processFrame = onFrame
      return { stop: vi.fn() }
    })

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '工具栏启用实验视觉' }))
    fireEvent.click(screen.getByRole('button', { name: '画笔' }))
    fireEvent.click(screen.getByRole('button', { name: '粒子画笔' }))
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    fireEvent.click(screen.getByRole('button', { name: '开始校准' }))

    const capture = (frame: HandFrame, buttonName: string) => {
      nextFrame = frame
      act(() => processFrame?.(frame.timestamp))
      fireEvent.click(screen.getByRole('button', { name: buttonName }))
    }
    capture(calibrationFrame(0, 0.3, 0.2, 0.2), '记录左上位置')
    capture(calibrationFrame(16, 0.3, 0.8, 0.2), '记录右上位置')
    capture(calibrationFrame(32, 0.3, 0.8, 0.8), '记录右下位置')
    capture(calibrationFrame(48, 0.3, 0.2, 0.8), '记录左下位置')
    for (let cycle = 0; cycle < 3; cycle += 1) {
      capture(calibrationFrame(64 + cycle * 32, 0.18, 0.5, 0.5), '记录捏合')
      capture(calibrationFrame(80 + cycle * 32, 0.6, 0.5, 0.5), '记录松开')
    }

    for (const frame of [
      calibrationFrame(200, 0.34, 0.5, 0.5),
      calibrationFrame(216, 0.34, 0.48, 0.5),
      calibrationFrame(232, 0.34, 0.4, 0.5),
      calibrationFrame(248, 0.6, 0.4, 0.5),
      calibrationFrame(264, 0.6, 0.4, 0.5),
    ]) {
      nextFrame = frame
      act(() => processFrame?.(frame.timestamp))
    }

    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '校准完成' }))
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('requests 640x480 video without audio only after click', async () => {
    const { stream } = createStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1))
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false,
    })
    expect(screen.getByRole('heading', { name: '书写校准' })).toBeInTheDocument()
  })

  it('allows explicit default calibration and enables gesture mode', async () => {
    const { stream } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    expect(screen.getByRole('button', { name: '摄像头手势模式' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '直接使用默认参数' }))

    expect(screen.getByRole('button', { name: '摄像头手势模式' })).toHaveAttribute('aria-pressed', 'true')
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

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    fireEvent.click(screen.getByRole('button', { name: '直接使用默认参数' }))
    fireEvent.click(screen.getByRole('button', { name: '鼠标模式' }))
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '摄像头手势模式' }))

    for (const timestamp of [0, 16, 32, 48, 64, 80]) {
      act(() => processFrame?.(timestamp))
    }

    expect(screen.getByRole('button', { name: '摄像头手势模式' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('pauses after a 0.8 second open-palm hold and creates no Stroke during 10 seconds of movement', async () => {
    const { stream } = createStream()
    let processFrame: ((timestamp: number) => void) | undefined
    let browserNow = 0
    const pausedMovementFrames = Array.from(
      { length: 51 },
      (_, index) => handFrame(1000 + index * 200, 0.3, 0.2 + (index % 5) * 0.1),
    )
    const frames = [
      ...[0, 200, 400, 600, 800].map(openPalmFrame),
      ...pausedMovementFrames,
      handFrame(11200, 0.7, 0.5),
      handFrame(11400, 0.3, 0.5),
      handFrame(11600, 0.3, 0.5),
      handFrame(11800, 0.3, 0.4),
      handFrame(12000, 0.43, 0.4),
      handFrame(12200, 0.43, 0.4),
    ]
    vi.spyOn(performance, 'now').mockImplementation(() => browserNow)
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

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用张掌暂停' }))
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    fireEvent.click(screen.getByRole('button', { name: '直接使用默认参数' }))

    for (const timestamp of [0, 200, 400, 600, 800]) {
      browserNow = timestamp
      act(() => processFrame?.(timestamp))
    }
    expect(screen.getByText('已暂停')).toBeInTheDocument()

    for (let timestamp = 1000; timestamp <= 11000; timestamp += 200) {
      browserNow = timestamp
      act(() => processFrame?.(timestamp))
    }
    expect(screen.getByText('0 STROKES')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '恢复手势' }))
    expect(screen.getByText('悬停')).toBeInTheDocument()
    for (const timestamp of [11200, 11400, 11600, 11800, 12000, 12200]) {
      browserNow = timestamp
      act(() => processFrame?.(timestamp))
    }
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('stops every camera track when closed and remains in mouse mode', async () => {
    const { stream, stop } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })

    renderApp()
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

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    drawMouseStroke()
    expect(screen.getByText('1 STROKES')).toBeInTheDocument()
  })

  it('reports model loading failure and keeps mouse drawing available', async () => {
    const { stream, stop } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    mockedCreateHandTracker.mockRejectedValueOnce(new Error('model failed'))

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('手势识别组件加载失败')
    expect(stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
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

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    act(() => processFrame?.(100))

    expect(await screen.findByRole('alert')).toHaveTextContent('已切换为鼠标模式')
    expect(stop).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '鼠标模式' })).toHaveAttribute('aria-pressed', 'true')
  })
})
