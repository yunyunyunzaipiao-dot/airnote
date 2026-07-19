import { describe, expect, it } from 'vitest'
import { loadSettings, normalizeBrushColor, saveSettings } from '../persistence/settingsStorage'
import { DEFAULT_SETTINGS } from '../types/workspace'

describe('settings persistence', () => {
  it('falls back from an invalid brush color', () => {
    expect(normalizeBrushColor('red')).toBe('#172B3A')
  })

  it('round-trips calibration and brush settings', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const settings = {
      ...DEFAULT_SETTINGS,
      brush: { color: '#AABBCC', width: 8 as const, style: 'ink' as const },
      gesture: { ...DEFAULT_SETTINGS.gesture, calibrated: true },
    }
    saveSettings(settings, storage)
    expect(loadSettings(storage)).toEqual(settings)
  })

  it('does not accept an invalid persisted ROI', () => {
    const storage = {
      getItem: () => JSON.stringify({
        ...DEFAULT_SETTINGS,
        gesture: {
          ...DEFAULT_SETTINGS.gesture,
          calibrated: true,
          writingROI: { left: 0.4, top: 0.4, right: 0.5, bottom: 0.5 },
        },
      }),
    }
    expect(loadSettings(storage).gesture.calibrated).toBe(false)
  })

  it('keeps experimental styles off by default and persists an explicit style choice', () => {
    const disabled = loadSettings({
      getItem: () => JSON.stringify({
        ...DEFAULT_SETTINGS,
        brush: { ...DEFAULT_SETTINGS.brush, style: 'particle' },
      }),
    })
    expect(disabled.experimentalStylesEnabled).toBe(false)
    expect(disabled.brush.style).toBe('ink')

    const enabled = loadSettings({
      getItem: () => JSON.stringify({
        ...DEFAULT_SETTINGS,
        experimentalStylesEnabled: true,
        brush: { ...DEFAULT_SETTINGS.brush, style: 'glow' },
      }),
    })
    expect(enabled.experimentalStylesEnabled).toBe(true)
    expect(enabled.brush.style).toBe('glow')
  })

  it('ignores the removed drawMode preference from a temporary build', () => {
    const temporarySettings = {
      ...DEFAULT_SETTINGS,
      gesture: { ...DEFAULT_SETTINGS.gesture, drawMode: 'mode2' },
    }
    expect(loadSettings({ getItem: () => JSON.stringify(temporarySettings) }).gesture)
      .not.toHaveProperty('drawMode')
  })
})
