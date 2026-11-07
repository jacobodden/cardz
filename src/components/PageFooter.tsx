import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeroSlotContext } from './heroSlot'

/** Page content pinned to the bottom of the page: below the content, and at the bottom edge of the screen when the page is short. */
export default function PageFooter({ children }: { children: ReactNode }) {
  const { footer } = useContext(HeroSlotContext)
  return footer ? createPortal(children, footer) : null
}
