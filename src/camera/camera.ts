import type { CameraErrorCode, CameraSettings } from '../types/m0'

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30 },
  },
  audio: false,
}

export async function requestCameraStream() {
  if (!window.isSecureContext) {
    throw createCameraError('insecure-context')
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw createCameraError('unsupported')
  }

  return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
}

export function readCameraSettings(stream: MediaStream): CameraSettings {
  const settings = stream.getVideoTracks()[0]?.getSettings()
  return {
    width: settings?.width ?? null,
    height: settings?.height ?? null,
    frameRate: settings?.frameRate ?? null,
    deviceId: settings?.deviceId ?? null,
  }
}

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function cameraErrorCode(error: unknown): CameraErrorCode {
  if (error instanceof CameraRuntimeError) {
    return error.code
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'not-allowed'
    if (error.name === 'NotFoundError') return 'not-found'
    if (error.name === 'NotReadableError') return 'not-readable'
  }

  return 'unknown'
}

export function cameraErrorMessage(code: CameraErrorCode) {
  const messages: Record<CameraErrorCode, string> = {
    'not-allowed': '无法访问摄像头。请在浏览器地址栏中允许摄像头权限。鼠标模式将在后续 P0 阶段提供。',
    'not-found': '未检测到可用摄像头，请连接设备后重试。',
    'not-readable': '摄像头可能正被其他应用占用，请关闭占用程序后重试。',
    'insecure-context': '摄像头仅能在 HTTPS 或本地环境中使用。',
    unsupported: '当前浏览器不支持摄像头访问，请使用最新版 Chrome 或 Edge。',
    'model-load-failed': '手势识别组件加载失败，请刷新后重试。鼠标模式将在后续 P0 阶段提供。',
    'tracking-runtime-failed': '手势追踪运行失败，摄像头仍保持开启。请关闭摄像头后重新启用。',
    unknown: '摄像头启动失败，请检查设备后重试。',
  }
  return messages[code]
}

class CameraRuntimeError extends Error {
  constructor(readonly code: CameraErrorCode) {
    super(code)
  }
}

function createCameraError(code: CameraErrorCode) {
  return new CameraRuntimeError(code)
}
