import { describe, expect, it } from 'vitest'
import {
  HAND_TRACKING_CONFIDENCE,
  MEDIAPIPE_ASSET_VERSION,
  versionAssetUrl,
} from '../handTracking/handTracker'

describe('M0 hand tracking confidence', () => {
  it('uses motion-tolerant presence and tracking thresholds', () => {
    expect(HAND_TRACKING_CONFIDENCE).toEqual({
      detection: 0.6,
      presence: 0.5,
      tracking: 0.35,
    })
  })

  it('versions local model and WASM URLs to avoid stale mixed assets', () => {
    expect(versionAssetUrl('/mediapipe/wasm/vision_wasm_internal.js'))
      .toBe(`/mediapipe/wasm/vision_wasm_internal.js?v=${MEDIAPIPE_ASSET_VERSION}`)
    expect(versionAssetUrl('/asset.wasm?variant=simd'))
      .toBe(`/asset.wasm?variant=simd&v=${MEDIAPIPE_ASSET_VERSION}`)
  })
})
