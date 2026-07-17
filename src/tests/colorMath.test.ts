import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex, normalizeHexColor } from '../color/colorMath'

describe('DRAW-03 color conversion', () => {
  it('normalizes short and long hexadecimal colors', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC')
    expect(normalizeHexColor('#12aF90')).toBe('#12AF90')
    expect(normalizeHexColor('#xyzxyz')).toBeNull()
  })

  it('round-trips representative HSV colors', () => {
    expect(hexToHsv('#FF00FF')).toEqual({ h: 300, s: 100, v: 100 })
    expect(hsvToHex({ h: 180, s: 100, v: 100 })).toBe('#00FFFF')
    expect(hsvToHex(hexToHsv('#172B3A')!)).toBe('#172B3A')
  })
})
