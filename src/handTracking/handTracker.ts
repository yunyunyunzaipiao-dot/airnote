import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandFrame, NormalizedPoint } from '../types/m0'

const baseUrl = import.meta.env.BASE_URL
const localMediapipeBaseUrl = `${baseUrl}mediapipe`

const mediapipeBaseUrl = (
  import.meta.env.VITE_MEDIAPIPE_ASSET_BASE_URL || localMediapipeBaseUrl
).replace(/\/+$/, '')

const wasmPath = `${mediapipeBaseUrl}/wasm`
const modelPath = `${mediapipeBaseUrl}/models/hand_landmarker.task`
export const MEDIAPIPE_ASSET_VERSION = '0.10.35-airnote-1'

export const HAND_TRACKING_CONFIDENCE = {
  detection: 0.6,
  presence: 0.5,
  tracking: 0.35,
} as const

export interface HandTracker {
  detect(video: HTMLVideoElement, timestamp: number): HandFrame
  close(): void
}

async function createLandmarker() {
  const [resolvedVision, modelAssetBuffer] = await Promise.all([
    FilesetResolver.forVisionTasks(wasmPath),
    loadModelAsset(),
  ])
  const vision = {
    ...resolvedVision,
    wasmLoaderPath: versionAssetUrl(resolvedVision.wasmLoaderPath),
    wasmBinaryPath: versionAssetUrl(resolvedVision.wasmBinaryPath),
    assetLoaderPath: resolvedVision.assetLoaderPath
      ? versionAssetUrl(resolvedVision.assetLoaderPath)
      : undefined,
    assetBinaryPath: resolvedVision.assetBinaryPath
      ? versionAssetUrl(resolvedVision.assetBinaryPath)
      : undefined,
  }
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: HAND_TRACKING_CONFIDENCE.detection,
    minHandPresenceConfidence: HAND_TRACKING_CONFIDENCE.presence,
    minTrackingConfidence: HAND_TRACKING_CONFIDENCE.tracking,
  })
}

export function versionAssetUrl(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${encodeURIComponent(MEDIAPIPE_ASSET_VERSION)}`
}

async function loadModelAsset() {
  const url = versionAssetUrl(modelPath)
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: attempt === 0 ? 'no-store' : 'reload',
      })

      if (!response.ok) {
        throw new Error(`hand-landmarker-model-http-${response.status}`)
      }

      const model = new Uint8Array(await response.arrayBuffer())

      if (model.byteLength === 0) {
        throw new Error('hand-landmarker-model-empty')
      }

      return model
    } catch (error) {
      lastError = error

      if (attempt < 2) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 800 * (attempt + 1))
        })
      }
    }
  }

  throw lastError ?? new Error('hand-landmarker-model-load-failed')
}

export async function createHandTracker(): Promise<HandTracker> {
  const landmarker = await createLandmarker()

  return {
    detect(video, timestamp) {
      const startedAt = performance.now()
      const result = landmarker.detectForVideo(video, timestamp)
      const inferenceMs = performance.now() - startedAt
      const landmarks = result.landmarks[0]

      return {
        landmarks: landmarks ? landmarks.map(toNormalizedPoint) : null,
        timestamp,
        inferenceMs,
      }
    },
    close() {
      landmarker.close()
    },
  }
}

function toNormalizedPoint(point: { x: number; y: number; z: number }): NormalizedPoint {
  return { x: point.x, y: point.y, z: point.z }
}
