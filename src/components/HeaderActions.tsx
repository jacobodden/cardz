import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeroSlotContext } from './heroSlot'

/** Page-specific icon buttons shown in the app header, left of the theme toggle. */
export default function HeaderActions({ children }: { children: ReactNode }) {
  const { actions } = useContext(HeroSlotContext)
  return actions ? createPortal(children, actions) : null
}
