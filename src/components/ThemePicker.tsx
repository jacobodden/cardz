import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { THEMES } from '../themes'

/**
 * Header button that opens a menu of color themes (see src/themes.ts).
 * Closes on Escape, Tab, a pick, or a tap outside.
 */
export default function ThemePicker({
  value,
  onChange,
  buttonClass,
}: {
  value: string
  onChange: (id: string) => void
  buttonClass: string
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    // Start on the current theme, like a radio group.
    const current = rootRef.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')
    ;(current ?? itemRefs.current[0])?.focus()

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null)
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus()

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusAt(index - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAt(0)
        break
      case 'End':
        e.preventDefault()
        focusAt(items.length - 1)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Color theme"
        title="Color theme"
        data-testid="theme-picker"
        className={buttonClass}
      >
        <PaletteIcon />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Color theme"
          onKeyDown={onMenuKeyDown}
          className="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-xl border border-line bg-surface p-1 text-ink shadow-lg"
        >
          {THEMES.map((theme, i) => {
            const checked = theme.id === value
            return (
              <button
                key={theme.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                data-theme-id={theme.id}
                onClick={() => {
                  onChange(theme.id)
                  close()
                }}
                className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 rounded-full border border-line-strong"
                  style={{ backgroundColor: theme.swatch }}
                />
                <span className="flex-1">{theme.name}</span>
                {checked && <CheckIcon />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PaletteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
      <circle cx="7.5" cy="11" r="1.1" />
      <circle cx="10" cy="7" r="1.1" />
      <circle cx="14.5" cy="7" r="1.1" />
      <circle cx="17.3" cy="10.5" r="1.1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-accent-ink">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
