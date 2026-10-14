import { create } from 'zustand'
import { buildTheater, type Seat, type TheaterLayout } from './layout'
import { DEFAULT_VENUE, VENUES } from './venues'
import { parseMovieUrl, type Movie } from './movie'
import { DEFAULT_CATALOG_MOVIE, catalogUrl } from './movies'
import type { SeatState, Show } from './backend/booking'

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
  movie: Movie | null
  moviePlaying: boolean
  movieMuted: boolean
  movieError: string | null
  // Booking (Phase 4). Empty when the app runs without Supabase keys.
  shows: Show[]
  showId: string | null
  seatStates: Record<string, SeatState> // keyed by seat id; free seats are missing
  bookingBusy: boolean
  bookingMessage: string | null
  setShow: (id: string) => void
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
  setMovie: (movie: Movie | null) => void
  setMoviePlaying: (playing: boolean) => void
  setMovieMuted: (muted: boolean) => void
  setMovieError: (error: string | null) => void
}

export const useTheater = create<TheaterState>((set, get) => ({
  theater: buildTheater(DEFAULT_VENUE),
  hovered: null,
  focused: null,
  selected: null,
  mode: 'overview',
  lightLevel: 0.7,
  movie: parseMovieUrl(catalogUrl(DEFAULT_CATALOG_MOVIE)),
  moviePlaying: true,
  movieMuted: true,
  movieError: null,
  shows: [],
  showId: null,
  seatStates: {},
  bookingBusy: false,
  bookingMessage: null,
  setShow: (showId) => set({ showId, seatStates: {}, bookingMessage: null }),
  setVenue: (id) => {
    const venue = VENUES.find((v) => v.id === id) ?? DEFAULT_VENUE
    set({
      theater: buildTheater(venue),
      hovered: null,
      focused: null,
      selected: null,
      mode: 'overview',
      shows: [],
      showId: null,
      seatStates: {},
      bookingMessage: null,
    })
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
  setMovie: (movie) => set({ movie, moviePlaying: true, movieMuted: true, movieError: null }),
  setMoviePlaying: (moviePlaying) => set({ moviePlaying }),
  setMovieMuted: (movieMuted) => set({ movieMuted }),
  setMovieError: (movieError) => set({ movieError }),
}))

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) (window as unknown as { __theater: typeof useTheater }).__theater = useTheater
