import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHandTracker } from '../handTracking/handTracker'
import { startVideoFrameLoop } from '../handTracking/videoFrameLoop'
import { App } from '../App'

vi.mock('../handTracking/handTracker', () => ({
  createHandTracker: vi.fn(async () => ({
    detect: vi.fn(),
    close: vi.fn(),
  })),
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

describe('AirNote M0 shell', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.restoreAllMocks()
    mockedCreateHandTracker.mockResolvedValue({
      detect: vi.fn(),
      close: vi.fn(),
    })
    mockedStartVideoFrameLoop.mockReturnValue({ stop: vi.fn() })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('renders the spike regions without requesting camera permission', () => {
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })

    render(<App />)

    expect(screen.getByRole('heading', { name: '捏合落笔，松开断笔' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '摄像头预览' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '手势状态' })).toBeInTheDocument()
    expect(screen.getByText(/临时诊断轨迹，不会保存/)).toBeInTheDocument()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('requests 640x480 video without audio only after click', async () => {
    const { stream } = createStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1))
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    })
    expect(await screen.findByText('实际输入 640×480 · 30 FPS')).toBeInTheDocument()
  })

  it('stops every camera track when the user closes the camera', async () => {
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
  })

  it('stops every camera track when the page unmounts', async () => {
    const { stream, stop } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })

    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))
    await screen.findByRole('button', { name: '关闭摄像头' })
    unmount()

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['NotAllowedError', '无法访问摄像头'],
    ['NotFoundError', '未检测到可用摄像头'],
    ['NotReadableError', '摄像头可能正被其他应用占用'],
  ])('shows a useful message for %s', async (name, message) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('failed', name)) },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('reports a local model initialization failure and releases the camera', async () => {
    const { stream, stop } = createStream()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    mockedCreateHandTracker.mockRejectedValueOnce(new Error('model failed'))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('手势识别组件加载失败')
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('keeps the camera stream alive when runtime tracking fails', async () => {
    const { stream, stop } = createStream()
    let processFrame: ((timestamp: number) => void) | undefined
    const closeTracker = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    })
    mockedCreateHandTracker.mockResolvedValueOnce({
      detect: vi.fn(() => { throw new Error('runtime failed') }),
      close: closeTracker,
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

    expect(await screen.findByRole('alert')).toHaveTextContent('手势追踪运行失败，摄像头仍保持开启')
    expect(screen.getByRole('button', { name: '关闭摄像头' })).toBeInTheDocument()
    expect(stop).not.toHaveBeenCalled()
    expect(closeTracker).toHaveBeenCalledTimes(1)
  })

  it('rejects camera startup outside a secure context', async () => {
    const getUserMedia = vi.fn()
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '启用摄像头' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('摄像头仅能在 HTTPS 或本地环境中使用')
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
