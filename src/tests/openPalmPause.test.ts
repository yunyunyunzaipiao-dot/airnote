import { describe, expect, it } from 'vitest'
import {
  createOpenPalmHold,
  hasFingertipPinch,
  isOpenPalm,
  stepOpenPalmHold,
} from '../gesture/openPalmPause'
import type { NormalizedPoint } from '../types/m0'

function openPalm(): NormalizedPoint[] {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }))
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
  return landmarks
}

describe('GEST-02 open-palm pause', () => {
  it('recognizes an open palm and rejects a curled hand', () => {
    const open = openPalm()
    const curled = openPalm()
    curled[8] = { x: 0.42, y: 0.62 }
    curled[12] = { x: 0.48, y: 0.62 }
    curled[16] = { x: 0.56, y: 0.62 }
    curled[20] = { x: 0.62, y: 0.64 }

    expect(isOpenPalm(open)).toBe(true)
    expect(isOpenPalm(curled)).toBe(false)
    expect(isOpenPalm(null)).toBe(false)
  })

  it('requires all five fingers to be extended and visibly spread', () => {
    const foldedThumb = openPalm()
    foldedThumb[4] = { x: 0.38, y: 0.72 }
    const fingersTogether = openPalm()
    fingersTogether[8] = { x: 0.48, y: 0.2 }
    fingersTogether[12] = { x: 0.5, y: 0.18 }
    fingersTogether[16] = { x: 0.52, y: 0.2 }
    fingersTogether[20] = { x: 0.54, y: 0.22 }

    expect(isOpenPalm(foldedThumb)).toBe(false)
    expect(isOpenPalm(fingersTogether)).toBe(false)
  })

  it('treats OK and multi-finger pinches as pinch poses, never as an open palm', () => {
    const okGesture = openPalm()
    okGesture[4] = { ...okGesture[8] }
    const multiFingerPinch = openPalm()
    multiFingerPinch[4] = { x: 0.45, y: 0.2 }
    multiFingerPinch[8] = { x: 0.44, y: 0.2 }
    multiFingerPinch[12] = { x: 0.46, y: 0.2 }

    expect(hasFingertipPinch(okGesture)).toBe(true)
    expect(hasFingertipPinch(multiFingerPinch)).toBe(true)
    expect(isOpenPalm(okGesture)).toBe(false)
    expect(isOpenPalm(multiFingerPinch)).toBe(false)
  })

  it('completes only after a continuous 0.8 second hold', () => {
    let hold = createOpenPalmHold()
    ;({ hold } = stepOpenPalmHold(hold, 0, true, true))
    expect(hold.progress).toBe(0)
    ;({ hold } = stepOpenPalmHold(hold, 200, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 400, true, true))
    expect(hold.progress).toBe(0.5)
    ;({ hold } = stepOpenPalmHold(hold, 600, true, true))
    const result = stepOpenPalmHold(hold, 800, true, true)

    expect(result.completed).toBe(true)
    expect(result.hold.latched).toBe(true)
  })

  it('cancels on interruption and requires a release before another completion', () => {
    let hold = createOpenPalmHold()
    ;({ hold } = stepOpenPalmHold(hold, 0, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 300, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 320, false, true))
    expect(hold).toEqual(createOpenPalmHold())

    ;({ hold } = stepOpenPalmHold(hold, 400, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 600, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 800, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 1000, true, true))
    const completed = stepOpenPalmHold(hold, 1200, true, true)
    expect(completed.completed).toBe(true)

    const stillOpen = stepOpenPalmHold(completed.hold, 1220, true, true)
    expect(stillOpen.completed).toBe(false)
    expect(stillOpen.hold.progress).toBe(0)
    const released = stepOpenPalmHold(stillOpen.hold, 1240, false, true)
    expect(released.hold.latched).toBe(false)
  })

  it('restarts the hold after a long frame gap and stays inactive when disabled', () => {
    let hold = createOpenPalmHold()
    ;({ hold } = stepOpenPalmHold(hold, 0, true, true))
    ;({ hold } = stepOpenPalmHold(hold, 300, true, true))
    expect(hold.progress).toBe(0)

    const disabled = stepOpenPalmHold(hold, 1100, true, false)
    expect(disabled.completed).toBe(false)
    expect(disabled.hold.progress).toBe(0)
  })
})
