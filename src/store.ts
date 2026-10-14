import { create } from 'zustand'
import { buildTheater, type Seat, type TheaterLayout } from './layout'
import { DEFAULT_VENUE, VENUES } from './venues'

type Mode = 'overview' | 'pov'

// House-light presets, like a real cinema: each pull of the cord steps to the next one.
export const LIGHT_PRESETS = [
  { name: 'Movie', level: 0.1 },
  { name: 'Dim', level: 0.4 },
  { name: 'Bright', level: 0.7 },
  { name: 'Full', level: 1 },
] as const

export function lightPresetName(level: number) {
  let best: (typeof LIGHT_PRESETS)[number] = LIGHT_PRESETS[0]
  for (const p of LIGHT_PRESETS) if (Math.abs(p.level - level) < Math.abs(best.level - level)) best = p
  return best.name
}

type TheaterState = {
  theater: TheaterLayout
  hovered: Seat | null
  focused: Seat | null // the seat the camera is on (or about to fly to)
  selected: Seat | null // the seat the user confirmed with "Select"
  mode: Mode
  lightLevel: number // 0 = pitch dark, 1 = house lights fully up
  setVenue: (id: string) => void
  setHovered: (seat: Seat | null) => void
  focus: (seat: Seat | null) => void
  sit: (seat: Seat) => void // focus a seat and fly into its point of view
  moveSeat: (dRow: number, dNumber: number) => void
  select: () => void
  enterPov: () => void
  exitPov: () => void
  setLightLevel: (level: number) => void
  cycleLight: () => void
}

export const useTheater = create<TheaterState>((set, get) => ({
  theater: buildTheater(DEFAULT_VENUE),
  hovered: null,
  focused: null,
  selected: null,
  mode: 'overview',
  lightLevel: 0.7,
  setVenue: (id) => {
    const venue = VENUES.find((v) => v.id === id) ?? DEFAULT_VENUE
    set({ theater: buildTheater(venue), hovered: null, focused: null, selected: null, mode: 'overview' })
  },
  setHovered: (hovered) => set({ hovered }),
  focus: (focused) => set({ focused }),
  sit: (seat) => set({ focused: seat, mode: 'pov' }),
  moveSeat: (dRow, dNumber) => {
    const { focused, theater } = get()
    if (!focused) return
    const next = theater.seats.find(
      (s) => s.rowIndex === focused.rowIndex + dRow && s.number === focused.number + dNumber,
    )
    if (next) set({ focused: next })
  },
  select: () => set({ selected: get().focused }),
  enterPov: () => get().focused && set({ mode: 'pov' }),
  exitPov: () => set({ mode: 'overview' }),
  setLightLevel: (level) => set({ lightLevel: Math.min(1, Math.max(0, level)) }),
  cycleLight: () => {
    const current = get().lightLevel
    const next = LIGHT_PRESETS.find((p) => p.level > current + 0.01) ?? LIGHT_PRESETS[0]
    set({ lightLevel: next.level })
  },
}))

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) (window as unknown as { __theater: typeof useTheater }).__theater = useTheater
