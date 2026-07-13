import { describe, expect, it } from 'vitest'
import {
  calculatePinchThresholds,
  calculateWritingROI,
  createCalibrationDraft,
  finalizeCalibration,
} from '../camera/calibration'

describe('camera calibration', () => {
  it('adds an eight-percent margin to a valid four-point ROI', () => {
    const roi = calculateWritingROI([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ])!
    expect(roi.left).toBeCloseTo(0.152)
    expect(roi.top).toBeCloseTo(0.152)
    expect(roi.right).toBeCloseTo(0.848)
    expect(roi.bottom).toBeCloseTo(0.848)
  })

  it('rejects a writing region smaller than one quarter of the video', () => {
    expect(calculateWritingROI([
      { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 },
      { x: 0.6, y: 0.6 },
      { x: 0.4, y: 0.6 },
    ])).toBeNull()
  })

  it('calculates hysteresis thresholds from three cycles', () => {
    const thresholds = calculatePinchThresholds([
      { pinch: 0.28, release: 0.62 },
      { pinch: 0.3, release: 0.6 },
      { pinch: 0.32, release: 0.58 },
    ])
    expect(thresholds?.down).toBeCloseTo(0.33)
    expect(thresholds?.up).toBeCloseTo(0.54)
  })

  it('falls back to default thresholds when samples are unstable', () => {
    const draft = createCalibrationDraft()
    draft.roiPoints = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ]
    draft.pinchCycles = [
      { pinch: 0.3, release: 0.34 },
      { pinch: 0.31, release: 0.35 },
      { pinch: 0.32, release: 0.36 },
    ]
    expect(finalizeCalibration(draft)).toMatchObject({
      pinchDownThreshold: 0.35,
      pinchUpThreshold: 0.42,
      calibrated: true,
      usesDefaultCalibration: true,
    })
  })
})
