import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useThemePreference, type ThemePreference } from '../lib/theme'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'Match device', icon: Monitor },
]

/** Navbar theme picker for signed-out visitors (signed-in students use the account menu). */
export function ThemeMenu() {
  const { preference, choose } = useThemePreference()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const Current = OPTIONS.find(o => o.value === preference)!.icon

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="theme-menu" ref={ref}>
      <button type="button" className="theme-trigger" aria-label="Theme" title="Theme" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <Current size={18} />
      </button>
      {open && (
        <div className="theme-dropdown" role="menu" aria-label="Theme">
          {OPTIONS.map(o => (
            <button key={o.value} type="button" role="menuitemradio" aria-checked={preference === o.value} className={preference === o.value ? 'on' : undefined} onClick={() => { choose(o.value); setOpen(false) }}>
              <o.icon size={15} /> {o.label} {preference === o.value && <Check size={14} className="tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
