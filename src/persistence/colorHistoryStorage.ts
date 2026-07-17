import { normalizeHexColor } from '../color/colorMath'

const COLOR_HISTORY_KEY = 'airnote.colorHistory'
export const MAX_COLOR_HISTORY = 6

export function addColorToHistory(history: string[], color: string): string[] {
  const normalized = normalizeHexColor(color)
  if (!normalized) return history
  return [normalized, ...history.filter((item) => normalizeHexColor(item) !== normalized)]
    .slice(0, MAX_COLOR_HISTORY)
}

export function loadColorHistory(fallbackColor: string): string[] {
  const fallback = normalizeHexColor(fallbackColor)
  try {
    const stored = JSON.parse(localStorage.getItem(COLOR_HISTORY_KEY) ?? '[]')
    if (!Array.isArray(stored)) return fallback ? [fallback] : []
    const history = stored.reduce<string[]>((colors, color) => {
      const normalized = typeof color === 'string' ? normalizeHexColor(color) : null
      return normalized && !colors.includes(normalized) ? [...colors, normalized] : colors
    }, []).slice(0, MAX_COLOR_HISTORY)
    return history.length > 0 ? history : fallback ? [fallback] : []
  } catch {
    return fallback ? [fallback] : []
  }
}

export function saveColorHistory(history: string[]) {
  try {
    localStorage.setItem(COLOR_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_COLOR_HISTORY)))
  } catch {
    // 颜色历史是可选界面增强；存储不可用时不应阻塞画笔。
  }
}
