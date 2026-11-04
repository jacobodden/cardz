/**
 * Color themes. Each theme's tokens live in src/index.css under
 * `:root[data-palette="<id>"]` (light) and `:root.dark[data-palette="<id>"]`
 * (dark). Light/dark is a separate choice that works with every theme.
 *
 * To add a theme: add an entry here and its two token blocks in index.css.
 * This file is also read by vite.config.ts, which injects the theme colors
 * into index.html's startup script, so keep it free of browser APIs.
 */

export type Mode = 'light' | 'dark'

export interface Theme {
  id: string
  /** Shown in the theme picker. */
  name: string
  /** Swatch color in the picker, usually the theme's felt/primary color. */
  swatch: string
  /** `<meta name="theme-color">` per mode: the header band's color. */
  themeColor: Record<Mode, string>
}

export const DEFAULT_THEME_ID = 'felt'

/** localStorage key for the chosen theme id (light/dark uses 'theme'). */
export const THEME_STORAGE_KEY = 'palette'

export const THEMES: readonly Theme[] = [
  {
    id: 'felt',
    name: 'Felt',
    swatch: '#1e6b4e',
    themeColor: { light: '#1e6b4e', dark: '#174a36' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    swatch: '#6b3fe0',
    themeColor: { light: '#6b3fe0', dark: '#3a2a7a' },
  },
]

/** The theme with `id`, or the default for an unknown, removed or missing id. */
export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
}

/** Theme colors keyed by id, for index.html's startup script. */
export function themeColorMap(): Record<string, Record<Mode, string>> {
  return Object.fromEntries(THEMES.map((t) => [t.id, t.themeColor]))
}
