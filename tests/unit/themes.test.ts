import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, THEMES, getTheme, themeColorMap } from '../../src/themes'

// Comments are dropped so a comment above a rule isn't read as part of its selector.
const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of the CSS rule whose selector list includes `selector`. */
function ruleBody(selector: string): string | null {
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(',').map((s) => s.trim())
    if (selectors.includes(selector)) return match[2]
  }
  return null
}

function token(body: string, name: string): string | undefined {
  return body.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim().toLowerCase()
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast of `fg` (at `alpha` over `bg`) against `bg`. */
function contrast(fg: string, bg: string, alpha = 1): number {
  const b = channels(bg)
  const f = channels(fg).map((c, i) => c * alpha + b[i] * (1 - alpha))
  const [hi, lo] = [luminance(f), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Text token on background token, as the components pair them. `alpha` is a /NN opacity. */
const TEXT_PAIRS: [fg: string, bg: string, alpha?: number][] = [
  ['ink', 'page'], ['ink', 'surface'], ['ink', 'lead-bg'], ['ink', 'accent-soft'],
  ['ink', 'avatar-1'], ['ink', 'avatar-2'], ['ink', 'avatar-3'],
  ['muted', 'page'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'accent-soft'],
  ['accent-ink', 'page'], ['accent-ink', 'surface'], ['accent-ink', 'accent-soft'],
  ['on-felt', 'felt'], ['on-felt', 'felt', 0.85], ['on-felt', 'felt', 0.8], ['felt', 'on-felt'],
  ['on-accent', 'accent'], ['on-danger', 'danger-solid'],
  ['lead-label', 'lead-bg'], ['win-fg', 'win-bg'], ['warn', 'page'],
  ['danger', 'page'], ['danger', 'surface'],
  ['yes-fg', 'yes-bg'], ['no-fg', 'no-bg'],
  ['red-suit', 'surface'], ['red-suit', 'surface-2'],
  ['card-red', 'card-face'], ['card-black', 'card-face'],
]

describe('theme registry', () => {
  it('has unique ids and includes the default', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_THEME_ID)
  })

  it('returns the theme for a known id', () => {
    expect(getTheme('felt').name).toBe('Felt')
  })

  it.each([null, undefined, '', 'removed-theme', 'FELT'])('falls back to the default for %j', (id) => {
    expect(getTheme(id).id).toBe(DEFAULT_THEME_ID)
  })

  it('maps every theme to its light and dark theme colors', () => {
    const map = themeColorMap()
    expect(Object.keys(map)).toEqual(THEMES.map((t) => t.id))
    for (const t of THEMES) expect(map[t.id]).toEqual(t.themeColor)
  })

  describe.each(THEMES.map((t) => [t.id, t] as const))('%s', (id, theme) => {
    it('defines light and dark tokens in index.css', () => {
      expect(ruleBody(`:root[data-palette="${id}"]`), 'light block').not.toBeNull()
      expect(ruleBody(`:root.dark[data-palette="${id}"]`), 'dark block').not.toBeNull()
    })

    it.each([
      ['light', `:root[data-palette="${id}"]`],
      ['dark', `:root.dark[data-palette="${id}"]`],
    ])('%s text passes 4.5:1', (_mode, selector) => {
      const body = ruleBody(selector)!
      const failures = TEXT_PAIRS.flatMap(([fg, bg, alpha]) => {
        const f = token(body, fg)
        const b = token(body, bg)
        if (!f || !b) return [`${fg} on ${bg}: token missing`]
        const ratio = contrast(f, b, alpha)
        return ratio < 4.5 ? [`${fg}${alpha ? `/${alpha * 100}` : ''} on ${bg}: ${ratio.toFixed(2)}`] : []
      })
      expect(failures).toEqual([])
    })

    it('uses its felt color for the browser theme color', () => {
      const light = ruleBody(`:root[data-palette="${id}"]`)!
      const dark = ruleBody(`:root.dark[data-palette="${id}"]`)!
      expect(theme.themeColor.light.toLowerCase()).toBe(token(light, 'felt'))
      expect(theme.themeColor.dark.toLowerCase()).toBe(token(dark, 'felt'))
    })
  })
})
