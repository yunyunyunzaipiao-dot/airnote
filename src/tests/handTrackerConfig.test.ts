import { describe, expect, it } from 'vitest'
import { HAND_TRACKING_CONFIDENCE } from '../handTracking/handTracker'

describe('M0 hand tracking confidence', () => {
  it('uses motion-tolerant presence and tracking thresholds', () => {
    expect(HAND_TRACKING_CONFIDENCE).toEqual({
      detection: 0.6,
      presence: 0.5,
      tracking: 0.35,
    })
  })
})
