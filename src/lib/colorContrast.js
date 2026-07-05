function parseRgb(color) {
  if (!color) return null

  const hex = color.trim()
  const shortHex = /^#([0-9a-f]{3})$/i.exec(hex)
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('').map((c) => parseInt(c + c, 16))
    return { r, g, b }
  }

  const longHex = /^#([0-9a-f]{6})$/i.exec(hex)
  if (longHex) {
    const value = longHex[1]
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    }
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color)
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    }
  }

  return null
}

/**
 * 背景色に対して視認性の高い文字色（#000 or #fff）を返す
 * YIQ輝度で判定（純粋な赤など WCAG 輝度では黒寄りになる色も正しく扱える）
 * @param {string} background
 * @returns {'#000' | '#fff'}
 */
export function getContrastTextColor(background) {
  const rgb = parseRgb(background)
  if (!rgb) return '#000'

  const { r, g, b } = rgb
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#000' : '#fff'
}
