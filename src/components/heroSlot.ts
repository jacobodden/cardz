import { createContext } from 'react'

export interface HeroSlot {
  /** Element inside the header band that a page's hero content renders into. */
  target: HTMLElement | null
  /** Turns the header band felt while a page shows a hero. */
  setFelt: (felt: boolean) => void
}

export const HeroSlotContext = createContext<HeroSlot>({ target: null, setFelt: () => {} })
