import { describe, expect, it, vi } from 'vitest'
import {
  applyUiTheme,
  DEFAULT_UI_THEME,
  loadUiTheme,
  saveUiTheme,
} from '../theme/uiThemes'

describe('UI theme preference', () => {
  it('loads a valid theme and falls back for unknown values', () => {
    expect(loadUiTheme({ getItem: () => 'sage' })).toBe('sage')
    expect(loadUiTheme({ getItem: () => 'unknown-theme' })).toBe(DEFAULT_UI_THEME)
    expect(loadUiTheme({ getItem: () => { throw new Error('blocked') } })).toBe(DEFAULT_UI_THEME)
  })

  it('saves the theme without making storage availability a requirement', () => {
    const setItem = vi.fn()
    saveUiTheme('night', { setItem })
    expect(setItem).toHaveBeenCalledWith('airnote.uiTheme', 'night')

    expect(() => saveUiTheme('white', {
      setItem: () => { throw new Error('blocked') },
    })).not.toThrow()
  })

  it('applies the selected theme only as a document UI attribute', () => {
    const root = document.createElement('div')
    applyUiTheme('coral', root)
    expect(root).toHaveAttribute('data-ui-theme', 'coral')
  })
})
