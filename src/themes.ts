/**
 * Color themes. Each theme's tokens live in src/index.css under
 * `:root[data-palette="<id>"]` (light) and `:root.dark[data-palette="<id>"]`
 * (dark). Light/dark is a separate choice that works with every theme.
 *
 * To add a theme: add an entry here and its two token blocks in index.css.
 * A theme can also swap the header logo, the suit art and the winner
 * celebration (see `logo`, `suitArt`, `celebration`).
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
  /** Header logo, a file in public/. Defaults to the app logo. */
  logo?: string
  /** Suit art on mini cards and the trump picker. Defaults to plain symbols. */
  suitArt?: 'bagel'
  /** What bursts from the trophy when a game ends. Defaults to confetti. */
  celebration?: CelebrationKind
}

export type CelebrationKind = 'confetti' | 'seeds' | 'footballs'

/** Header logo file (in public/) for every theme without its own. */
export const DEFAULT_LOGO = 'app-logo.png'

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
  {
    id: 'ocean',
    name: 'Ocean',
    swatch: '#0c5f73',
    themeColor: { light: '#0c5f73', dark: '#0a3d4f' },
  },
  {
    id: 'ember',
    name: 'Ember',
    swatch: '#9c3f1a',
    themeColor: { light: '#9c3f1a', dark: '#7a2f14' },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    swatch: '#34373d',
    themeColor: { light: '#34373d', dark: '#26282d' },
  },
  {
    id: 'bagel',
    name: 'Bagel',
    swatch: '#8c5220',
    themeColor: { light: '#8c5220', dark: '#5e3714' },
    logo: 'logo-bagel.svg',
    suitArt: 'bagel',
    celebration: 'seeds',
  },
  {
    id: 'skol',
    name: 'Skol',
    swatch: '#4f2683',
    themeColor: { light: '#4f2683', dark: '#3b1c63' },
    logo: 'logo-skol.svg',
    celebration: 'footballs',
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
