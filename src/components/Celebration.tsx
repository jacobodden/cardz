import { useEffect, useRef, useState, type RefObject } from 'react'
import { createBurst, stepParticles, type Particle } from '../celebration/particles'
import type { CelebrationKind } from '../themes'

/** Pieces are dropped once they're this far below the viewport. */
const FLOOR_MARGIN = 60
/** Frames longer than this (a background tab) don't teleport the pieces. */
const MAX_STEP = 0.05

function draw(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.fillStyle = p.color
  const s = p.size
  switch (p.shape) {
    case 'confetti':
      ctx.scale(1, Math.cos(p.flip))
      ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6)
      break
    case 'sesame':
      ctx.beginPath()
      ctx.ellipse(0, 0, s / 2, s / 4.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(122, 69, 21, 0.55)'
      ctx.lineWidth = 0.7
      ctx.stroke()
      break
    case 'poppy':
      ctx.beginPath()
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'flake':
      ctx.scale(1, Math.cos(p.flip))
      ctx.beginPath()
      ctx.moveTo(-s / 2, -s * 0.15)
      ctx.lineTo(s * 0.1, -s * 0.35)
      ctx.lineTo(s / 2, s * 0.1)
      ctx.lineTo(-s * 0.15, s * 0.3)
      ctx.closePath()
      ctx.fill()
      break
    case 'football': {
      const rx = s / 2
      const ry = s * 0.31
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#3e1f0a'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.strokeStyle = '#ffffff'
      ctx.lineCap = 'round'
      // End stripes, then the laces.
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (const x of [-rx * 0.62, rx * 0.62]) {
        ctx.moveTo(x, -ry * 0.62)
        ctx.lineTo(x, ry * 0.62)
      }
      ctx.stroke()
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(-rx * 0.38, 0)
      ctx.lineTo(rx * 0.38, 0)
      for (let i = -1.5; i <= 1.5; i++) {
        ctx.moveTo(i * rx * 0.17, -ry * 0.3)
        ctx.lineTo(i * rx * 0.17, ry * 0.3)
      }
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}

/**
 * A full-screen canvas that bursts `kind` from the middle of `originRef`
 * each time `pops` goes up. Hidden and idle between bursts; never takes
 * clicks. A pop during a burst adds to it.
 */
export default function Celebration({
  kind,
  pops,
  originRef,
}: {
  kind: CelebrationKind
  pops: number
  originRef: RefObject<HTMLElement | null>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (pops === 0) return
    const box = originRef.current?.getBoundingClientRect()
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2
    const y = box ? box.top + box.height / 2 : window.innerHeight / 3
    particles.current.push(...createBurst(kind, x, y))
    setActive(true)
    // Only a new pop starts a burst; `kind` and the origin are read then.
  }, [pops])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      particles.current = []
      setActive(false)
      return
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let last = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const dt = Math.min(MAX_STEP, (now - last) / 1000)
      last = now
      particles.current = stepParticles(particles.current, dt, window.innerHeight + FLOOR_MARGIN)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const p of particles.current) draw(ctx, p)
      if (particles.current.length > 0) frame = requestAnimationFrame(tick)
      else setActive(false)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [active])

  // Drop any pieces left in flight when the page goes away.
  useEffect(() => () => void (particles.current = []), [])

  return (
    <canvas
      ref={canvasRef}
      hidden={!active}
      aria-hidden="true"
      data-testid="celebration"
      data-kind={kind}
      className="pointer-events-none fixed inset-0 z-40 h-full w-full"
    />
  )
}
