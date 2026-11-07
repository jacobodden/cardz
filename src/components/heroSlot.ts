import { createContext } from 'react'

export interface HeroSlot {
  /** Element inside the header band that a page's hero content renders into. */
  target: HTMLElement | null
  /** Element in the header, left of the theme toggle, for page actions (see HeaderActions). */
  actions: HTMLElement | null
  /** Element under the page content, at the bottom of the screen on short pages (see PageFooter). */
  footer: HTMLElement | null
  /** Classes for an icon button in the header, matching the band's colors. */
  iconButton: string
  /** Turns the header band felt while a page shows a hero. */
  setFelt: (felt: boolean) => void
}

export const HeroSlotContext = createContext<HeroSlot>({ target: null, actions: null, footer: null, iconButton: '', setFelt: () => {} })
