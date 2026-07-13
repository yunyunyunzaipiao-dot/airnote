import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandFrame, NormalizedPoint } from '../types/m0'

const baseUrl = import.meta.env.BASE_URL
const wasmPath = `${baseUrl}mediapipe/wasm`
const modelPath = `${baseUrl}mediapipe/models/hand_landmarker.task`

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
  const vision = await FilesetResolver.forVisionTasks(wasmPath)
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: HAND_TRACKING_CONFIDENCE.detection,
    minHandPresenceConfidence: HAND_TRACKING_CONFIDENCE.presence,
    minTrackingConfidence: HAND_TRACKING_CONFIDENCE.tracking,
  })
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
