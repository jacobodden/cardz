import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeroSlotContext } from './heroSlot'

/**
 * Page content in a bar stuck to the bottom of the screen. The page scrolls
 * behind it, and its end still scrolls clear of the bar.
 */
export default function PageFooter({ children }: { children: ReactNode }) {
  const { footer } = useContext(HeroSlotContext)
  return footer ? createPortal(children, footer) : null
}
