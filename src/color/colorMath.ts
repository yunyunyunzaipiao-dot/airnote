export interface HsvColor {
  h: number
  s: number
  v: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  const expanded = /^#[0-9a-f]{3}$/i.test(trimmed)
    ? `#${trimmed.slice(1).split('').map((character) => character.repeat(2)).join('')}`
    : trimmed
  return /^#[0-9a-f]{6}$/i.test(expanded) ? expanded.toUpperCase() : null
}

export function hexToHsv(value: string): HsvColor | null {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  let hue = 0

  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }
  if (hue < 0) hue += 360

  return {
    h: hue,
    s: maximum === 0 ? 0 : (delta / maximum) * 100,
    v: maximum * 100,
  }
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp(s, 0, 100) / 100
  const value = clamp(v, 0, 100) / 100
  const chroma = value * saturation
  const section = hue / 60
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1))
  const offset = value - chroma
  const [red, green, blue] = section < 1 ? [chroma, intermediate, 0]
    : section < 2 ? [intermediate, chroma, 0]
      : section < 3 ? [0, chroma, intermediate]
        : section < 4 ? [0, intermediate, chroma]
          : section < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate]
  const channel = (component: number) => Math.round((component + offset) * 255).toString(16).padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase()
}
