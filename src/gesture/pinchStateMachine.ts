import type {
  GestureMachineResult,
  GestureMachineState,
  HandFrame,
  NormalizedPoint,
} from '../types/m0'

export const DEFAULT_DOWN_THRESHOLD = 0.35
export const DEFAULT_UP_THRESHOLD = 0.42
export const MAX_FRAME_GAP_MS = 250
export const LOST_FRAME_LIMIT = 3
export const UP_FRAME_LIMIT = 2
export const FAST_RELEASE_FRAME_LIMIT = 3
export const FAST_TIP_MOVEMENT_THRESHOLD = 0.035
export const MAX_RUNTIME_DOWN_THRESHOLD = 0.45
export const MIN_THRESHOLD_GAP = 0.06

const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_TIP = 8
const PINKY_MCP = 17
const MIN_PALM_WIDTH = 0.0001

export function createGestureMachine(): GestureMachineState {
  return {
    state: 'IDLE',
    downFrames: 0,
    upFrames: 0,
    lostFrames: 0,
    lastFrameAt: null,
    lastIndexTip: null,
    pinchRatio: null,
  }
}

function distance(first: NormalizedPoint, second: NormalizedPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function isFinitePoint(point: NormalizedPoint | undefined): point is NormalizedPoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))
}

export function calculatePinchRatio(landmarks: NormalizedPoint[]): number | null {
  const thumbTip = landmarks[THUMB_TIP]
  const indexMcp = landmarks[INDEX_MCP]
  const indexTip = landmarks[INDEX_TIP]
  const pinkyMcp = landmarks[PINKY_MCP]

  if (![thumbTip, indexMcp, indexTip, pinkyMcp].every(isFinitePoint)) {
    return null
  }

  const palmWidth = distance(indexMcp, pinkyMcp)
  if (!Number.isFinite(palmWidth) || palmWidth < MIN_PALM_WIDTH) {
    return null
  }

  const ratio = distance(thumbTip, indexTip) / palmWidth
  return Number.isFinite(ratio) ? ratio : null
}

export function stepGestureMachine(
  previous: GestureMachineState,
  frame: HandFrame,
  downThreshold = DEFAULT_DOWN_THRESHOLD,
  upThreshold = DEFAULT_UP_THRESHOLD,
): GestureMachineResult {
  if (downThreshold >= upThreshold) {
    throw new Error('downThreshold must be lower than upThreshold')
  }
  const effectiveDownThreshold = Math.min(
    MAX_RUNTIME_DOWN_THRESHOLD,
    Math.max(DEFAULT_DOWN_THRESHOLD, downThreshold),
  )
  const effectiveUpThreshold = Math.max(
    effectiveDownThreshold + MIN_THRESHOLD_GAP,
    upThreshold,
  )

  const commands: GestureMachineResult['commands'] = []
  if (previous.state === 'PAUSED') {
    return {
      machine: {
        ...previous,
        lastFrameAt: frame.timestamp,
      },
      commands,
    }
  }

  const hasFrameGap =
    previous.lastFrameAt !== null && frame.timestamp - previous.lastFrameAt > MAX_FRAME_GAP_MS

  if (hasFrameGap) {
    if (previous.state === 'DRAWING') {
      commands.push({ type: 'END_STROKE', reason: 'frame-gap' })
    }

    return {
      machine: {
        ...createGestureMachine(),
        state: frame.landmarks ? 'HOVER' : 'TRACKING_LOST',
        lastFrameAt: frame.timestamp,
      },
      commands,
    }
  }

  if (!frame.landmarks) {
    const lostFrames = previous.lostFrames + 1
    const reachedLimit = lostFrames >= LOST_FRAME_LIMIT

    if (reachedLimit) {
      commands.push({ type: 'END_STROKE', reason: 'tracking-lost' })
    }

    return {
      machine: {
        ...previous,
        state: reachedLimit ? 'TRACKING_LOST' : previous.state,
        downFrames: 0,
        upFrames: 0,
        lostFrames,
        lastFrameAt: frame.timestamp,
        lastIndexTip: null,
        pinchRatio: null,
      },
      commands,
    }
  }

  const pinchRatio = calculatePinchRatio(frame.landmarks)
  if (pinchRatio === null) {
    return {
      machine: { ...previous, lastFrameAt: frame.timestamp },
      commands,
    }
  }

  const indexTip = frame.landmarks[INDEX_TIP]
  if (!isFinitePoint(indexTip)) {
    return {
      machine: { ...previous, lastFrameAt: frame.timestamp },
      commands,
    }
  }

  if (previous.state === 'TRACKING_LOST' || previous.state === 'IDLE') {
    commands.push({ type: 'APPEND_POINT', point: indexTip, timestamp: frame.timestamp })
    return {
      machine: {
        ...previous,
        state: 'HOVER',
        downFrames: 0,
        upFrames: 0,
        lostFrames: 0,
        lastFrameAt: frame.timestamp,
        lastIndexTip: indexTip,
        pinchRatio,
      },
      commands,
    }
  }

  if (previous.state === 'HOVER') {
    const downFrames = pinchRatio <= effectiveDownThreshold ? previous.downFrames + 1 : 0
    const shouldStart = downFrames >= 2
    if (shouldStart) {
      commands.push({ type: 'START_STROKE', point: indexTip, timestamp: frame.timestamp })
    } else {
      commands.push({ type: 'APPEND_POINT', point: indexTip, timestamp: frame.timestamp })
    }

    return {
      machine: {
        ...previous,
        state: shouldStart ? 'DRAWING' : 'HOVER',
        downFrames: shouldStart ? 0 : downFrames,
        upFrames: 0,
        lostFrames: 0,
        lastFrameAt: frame.timestamp,
        lastIndexTip: indexTip,
        pinchRatio,
      },
      commands,
    }
  }

  const tipMovement = previous.lastIndexTip ? distance(previous.lastIndexTip, indexTip) : 0
  const releaseFrameLimit = tipMovement >= FAST_TIP_MOVEMENT_THRESHOLD
    ? FAST_RELEASE_FRAME_LIMIT
    : UP_FRAME_LIMIT
  const isReleaseCandidate = pinchRatio >= effectiveUpThreshold
  const upFrames = isReleaseCandidate ? previous.upFrames + 1 : 0
  const shouldEnd = upFrames >= releaseFrameLimit
  if (shouldEnd) {
    commands.push({ type: 'END_STROKE', reason: 'pinch-up' })
  } else if (!isReleaseCandidate) {
    commands.push({ type: 'APPEND_POINT', point: indexTip, timestamp: frame.timestamp })
  }

  return {
    machine: {
      ...previous,
      state: shouldEnd ? 'HOVER' : 'DRAWING',
      downFrames: 0,
      upFrames: shouldEnd ? 0 : upFrames,
      lostFrames: 0,
      lastFrameAt: frame.timestamp,
      lastIndexTip: indexTip,
      pinchRatio,
    },
    commands,
  }
}

export function stopGestureMachine(previous: GestureMachineState): GestureMachineResult {
  return {
    machine: createGestureMachine(),
    commands:
      previous.state === 'DRAWING'
        ? [{ type: 'END_STROKE', reason: 'stopped' }]
        : [],
  }
}
