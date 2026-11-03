import { useContext, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeroSlotContext } from './heroSlot'

/**
 * Page content shown in the felt band under the app header (title, summary,
 * primary action). While mounted, the header band turns felt green.
 */
export default function FeltHero({ children }: { children: ReactNode }) {
  const { target, setFelt } = useContext(HeroSlotContext)

  // Layout effect so the band changes color in the same frame as the content.
  useLayoutEffect(() => {
    setFelt(true)
    return () => setFelt(false)
  }, [setFelt])

  return target ? createPortal(children, target) : null
}
