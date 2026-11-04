import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, THEMES, getTheme, themeColorMap } from '../../src/themes'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

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

    it('uses its felt color for the browser theme color', () => {
      const light = ruleBody(`:root[data-palette="${id}"]`)!
      const dark = ruleBody(`:root.dark[data-palette="${id}"]`)!
      expect(theme.themeColor.light.toLowerCase()).toBe(token(light, 'felt'))
      expect(theme.themeColor.dark.toLowerCase()).toBe(token(dark, 'felt'))
    })
  })
})
