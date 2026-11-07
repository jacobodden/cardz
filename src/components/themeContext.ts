import { createContext, useContext } from 'react'
import { DEFAULT_THEME_ID, getTheme, type Theme } from '../themes'

/** The active color theme, for components that swap assets by theme. Set by Layout. */
export const ThemeContext = createContext<Theme>(getTheme(DEFAULT_THEME_ID))

export function useTheme(): Theme {
  return useContext(ThemeContext)
}
