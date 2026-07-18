import type { NormalizedPoint } from '../types/m0'

export const OPEN_PALM_HOLD_MS = 800
export const OPEN_PALM_MAX_FRAME_GAP_MS = 250

const WRIST = 0
const THUMB_IP = 3
const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_PIP = 6
const INDEX_TIP = 8
const MIDDLE_PIP = 10
const MIDDLE_TIP = 12
const RING_PIP = 14
const RING_TIP = 16
const PINKY_MCP = 17
const PINKY_PIP = 18
const PINKY_TIP = 20
const MIN_PALM_WIDTH = 0.0001
const PINCH_GUARD_RATIO = 0.55
const MIN_ADJACENT_FINGER_SPREAD_RATIO = 0.25
const FINGER_TIPS = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP] as const

export interface OpenPalmHoldState {
  startedAt: number | null
  lastFrameAt: number | null
  progress: number
  latched: boolean
}

export interface OpenPalmHoldResult {
  hold: OpenPalmHoldState
  completed: boolean
}

function distance(first: NormalizedPoint, second: NormalizedPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function isFinitePoint(point: NormalizedPoint | undefined): point is NormalizedPoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))
}

export function createOpenPalmHold(): OpenPalmHoldState {
  return {
    startedAt: null,
    lastFrameAt: null,
    progress: 0,
    latched: false,
  }
}

export function hasFingertipPinch(landmarks: NormalizedPoint[] | null): boolean {
  if (!landmarks) return false
  const thumbTip = landmarks[THUMB_TIP]
  const indexMcp = landmarks[INDEX_MCP]
  const pinkyMcp = landmarks[PINKY_MCP]
  if (![thumbTip, indexMcp, pinkyMcp, ...FINGER_TIPS.map((index) => landmarks[index])].every(isFinitePoint)) {
    return false
  }

  const palmWidth = distance(indexMcp, pinkyMcp)
  if (!Number.isFinite(palmWidth) || palmWidth < MIN_PALM_WIDTH) return false
  return FINGER_TIPS.some((tipIndex) => (
    distance(thumbTip, landmarks[tipIndex]) / palmWidth <= PINCH_GUARD_RATIO
  ))
}

export function isOpenPalm(landmarks: NormalizedPoint[] | null): boolean {
  if (!landmarks) return false

  const wrist = landmarks[WRIST]
  const indexMcp = landmarks[INDEX_MCP]
  const pinkyMcp = landmarks[PINKY_MCP]
  const required = [
    wrist,
    landmarks[THUMB_IP],
    landmarks[THUMB_TIP],
    indexMcp,
    landmarks[INDEX_PIP],
    landmarks[INDEX_TIP],
    landmarks[MIDDLE_PIP],
    landmarks[MIDDLE_TIP],
    landmarks[RING_PIP],
    landmarks[RING_TIP],
    pinkyMcp,
    landmarks[PINKY_PIP],
    landmarks[PINKY_TIP],
  ]

  if (!required.every(isFinitePoint)) return false
  const palmWidth = distance(indexMcp, pinkyMcp)
  if (!Number.isFinite(palmWidth) || palmWidth < MIN_PALM_WIDTH) return false

  const fingerPairs = [
    [INDEX_PIP, INDEX_TIP],
    [MIDDLE_PIP, MIDDLE_TIP],
    [RING_PIP, RING_TIP],
    [PINKY_PIP, PINKY_TIP],
  ] as const
  const allFourFingersExtended = fingerPairs.every(([pipIndex, tipIndex]) => (
    distance(landmarks[tipIndex], wrist) - distance(landmarks[pipIndex], wrist)
      >= palmWidth * 0.12
  ))
  const thumbExtended = (
    distance(landmarks[THUMB_TIP], wrist) - distance(landmarks[THUMB_IP], wrist)
      >= palmWidth * 0.08
  )
  const fingersSpread = FINGER_TIPS.slice(1).every((tipIndex, index) => (
    distance(landmarks[FINGER_TIPS[index]], landmarks[tipIndex])
      >= palmWidth * MIN_ADJACENT_FINGER_SPREAD_RATIO
  ))

  return (
    allFourFingersExtended
    && thumbExtended
    && fingersSpread
    && !hasFingertipPinch(landmarks)
  )
}

export function stepOpenPalmHold(
  previous: OpenPalmHoldState,
  timestamp: number,
  openPalm: boolean,
  eligible: boolean,
): OpenPalmHoldResult {
  if (!eligible) {
    return {
      hold: {
        ...createOpenPalmHold(),
        latched: previous.latched,
      },
      completed: false,
    }
  }

  if (!openPalm) {
    return { hold: createOpenPalmHold(), completed: false }
  }

  if (previous.latched) {
    return {
      hold: {
        ...previous,
        startedAt: null,
        lastFrameAt: timestamp,
        progress: 0,
      },
      completed: false,
    }
  }

  const hasFrameGap = (
    previous.lastFrameAt !== null
    && timestamp - previous.lastFrameAt > OPEN_PALM_MAX_FRAME_GAP_MS
  )
  const startedAt = previous.startedAt === null || hasFrameGap
    ? timestamp
    : previous.startedAt
  const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / OPEN_PALM_HOLD_MS))

  if (progress >= 1) {
    return {
      hold: {
        startedAt: null,
        lastFrameAt: timestamp,
        progress: 1,
        latched: true,
      },
      completed: true,
    }
  }

  return {
    hold: {
      startedAt,
      lastFrameAt: timestamp,
      progress,
      latched: false,
    },
    completed: false,
  }
}
