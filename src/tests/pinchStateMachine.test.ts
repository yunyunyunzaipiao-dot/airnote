import { describe, expect, it } from 'vitest'
import {
  createGestureMachine,
  stepGestureMachine,
} from '../gesture/pinchStateMachine'
import type { GestureMachineState, HandFrame, NormalizedPoint } from '../types/m0'

function landmarksForRatio(ratio: number, indexX = 0.5): NormalizedPoint[] {
  const landmarks: NormalizedPoint[] = Array.from(
    { length: 21 },
    () => ({ x: 0.5, y: 0.5, z: 0 }),
  )
  landmarks[5] = { x: 0, y: 0 }
  landmarks[17] = { x: 1, y: 0 }
  landmarks[8] = { x: indexX, y: 0.5 }
  landmarks[4] = { x: indexX + ratio, y: 0.5 }
  return landmarks
}

function frame(timestamp: number, ratio: number | null, indexX = 0.5): HandFrame {
  return {
    timestamp,
    inferenceMs: 5,
    landmarks: ratio === null ? null : landmarksForRatio(ratio, indexX),
  }
}

function enterDrawing(): GestureMachineState {
  let machine = stepGestureMachine(createGestureMachine(), frame(0, 0.7)).machine
  machine = stepGestureMachine(machine, frame(16, 0.3)).machine
  return stepGestureMachine(machine, frame(32, 0.3)).machine
}

describe('pinch state machine', () => {
  it('requires two consecutive down frames to start', () => {
    let result = stepGestureMachine(createGestureMachine(), frame(0, 0.7))
    result = stepGestureMachine(result.machine, frame(16, 0.3))
    expect(result.machine.state).toBe('HOVER')

    result = stepGestureMachine(result.machine, frame(32, 0.3))
    expect(result.machine.state).toBe('DRAWING')
    expect(result.commands).toContainEqual(expect.objectContaining({ type: 'START_STROKE' }))
  })

  it('keeps an older over-strict calibration at least as permissive as the default', () => {
    let result = stepGestureMachine(createGestureMachine(), frame(0, 0.7), 0.18, 0.42)
    result = stepGestureMachine(result.machine, frame(16, 0.34), 0.18, 0.42)
    result = stepGestureMachine(result.machine, frame(32, 0.34), 0.18, 0.42)

    expect(result.machine.state).toBe('DRAWING')
    expect(result.commands).toContainEqual(expect.objectContaining({ type: 'START_STROKE' }))
  })

  it('requires two consecutive release frames before ending a slow stroke', () => {
    let result = stepGestureMachine(enterDrawing(), frame(48, 0.43))
    expect(result.machine.state).toBe('DRAWING')
    expect(result.commands).toEqual([])

    result = stepGestureMachine(result.machine, frame(64, 0.43))
    expect(result.machine.state).toBe('HOVER')
    expect(result.commands).toEqual([{ type: 'END_STROKE', reason: 'pinch-up' }])
  })

  it('continues drawing below the release threshold', () => {
    const result = stepGestureMachine(enterDrawing(), frame(48, 0.41))
    expect(result.machine.state).toBe('DRAWING')
    expect(result.commands).toContainEqual(expect.objectContaining({ type: 'APPEND_POINT' }))
  })

  it('does not end on one release-like frame during fast movement', () => {
    const result = stepGestureMachine(enterDrawing(), frame(48, 0.43, 0.45))

    expect(result.machine.state).toBe('DRAWING')
    expect(result.machine.upFrames).toBe(1)
    expect(result.commands).toEqual([])
  })

  it('ends after three release frames during fast movement', () => {
    let result = stepGestureMachine(enterDrawing(), frame(48, 0.43, 0.45))
    result = stepGestureMachine(result.machine, frame(64, 0.43, 0.4))
    expect(result.machine.state).toBe('DRAWING')
    expect(result.commands).toEqual([])
    result = stepGestureMachine(result.machine, frame(80, 0.43, 0.35))

    expect(result.machine.state).toBe('HOVER')
    expect(result.commands).toEqual([{ type: 'END_STROKE', reason: 'pinch-up' }])
  })

  it('continues the same stroke after a transient fast-motion release candidate', () => {
    let result = stepGestureMachine(enterDrawing(), frame(48, 0.43, 0.45))
    result = stepGestureMachine(result.machine, frame(64, 0.3, 0.4))

    expect(result.machine.state).toBe('DRAWING')
    expect(result.machine.upFrames).toBe(0)
    expect(result.commands).toContainEqual(expect.objectContaining({ type: 'APPEND_POINT' }))
  })

  it('ends the stroke after three lost frames', () => {
    let result = stepGestureMachine(enterDrawing(), frame(48, null))
    result = stepGestureMachine(result.machine, frame(64, null))
    expect(result.machine.state).toBe('DRAWING')

    result = stepGestureMachine(result.machine, frame(80, null))
    expect(result.machine.state).toBe('TRACKING_LOST')
    expect(result.commands).toEqual([{ type: 'END_STROKE', reason: 'tracking-lost' }])
  })

  it('forces pen-up when the frame gap exceeds 250ms', () => {
    const result = stepGestureMachine(enterDrawing(), frame(400, 0.3))
    expect(result.machine.state).toBe('HOVER')
    expect(result.commands).toEqual([{ type: 'END_STROKE', reason: 'frame-gap' }])
  })

  it('returns from tracking loss through hover without reconnecting', () => {
    let result = stepGestureMachine(enterDrawing(), frame(48, null))
    result = stepGestureMachine(result.machine, frame(64, null))
    result = stepGestureMachine(result.machine, frame(80, null))
    result = stepGestureMachine(result.machine, frame(96, 0.3))

    expect(result.machine.state).toBe('HOVER')
    expect(result.commands.some((command) => command.type === 'START_STROKE')).toBe(false)
  })

  it('ignores invalid palm-width data without changing gesture state', () => {
    const invalid = landmarksForRatio(0.3)
    invalid[17] = invalid[5]
    const previous = enterDrawing()
    const result = stepGestureMachine(previous, { landmarks: invalid, timestamp: 48, inferenceMs: 1 })

    expect(result.machine.state).toBe('DRAWING')
    expect(result.commands).toEqual([])
  })
})
