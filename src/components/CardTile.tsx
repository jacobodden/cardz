import type { CardFace } from '../games/types'
import BagelSuit from './BagelSuit'
import { useTheme } from './themeContext'

const RED_SUITS = new Set(['♥', '♦'])

/** A mini playing card (e.g. K♠) that stands for a game in lists. */
export default function CardTile({ face }: { face: CardFace }) {
  const { suitArt } = useTheme()
  const color = RED_SUITS.has(face.suit) ? 'text-card-red' : 'text-card-black'
  return (
    <div
      aria-hidden="true"
      className={`w-10 h-[54px] shrink-0 rounded-md bg-card-face border border-card-edge flex flex-col justify-between px-[5px] py-[3px] font-extrabold ${color}`}
    >
      <span className="text-xs leading-none">{face.rank}</span>
      {suitArt === 'bagel' ? (
        <BagelSuit suit={face.suit} size={30} className="self-center" />
      ) : (
        <span className="text-lg leading-none self-center">{face.suit}</span>
      )}
      <span className="text-xs leading-none self-end rotate-180">{face.rank}</span>
    </div>
  )
}
