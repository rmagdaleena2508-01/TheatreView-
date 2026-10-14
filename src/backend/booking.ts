import { useEffect } from 'react'
import { supabase } from './supabase'
import { useTheater } from '../store'
import { CATALOG, catalogUrl } from '../movies'
import { parseMovieUrl } from '../movie'

export type Show = { id: string; venue_id: string; title: string; starts_at: string; movie_id: string | null }
export type SeatState = { state: 'booked' | 'held'; mine: boolean; expiresAt: string | null }

const set = useTheater.setState
const get = useTheater.getState

// Friendly text for errors raised by the database functions.
function errorText(error: { message?: string } | null) {
  return error?.message?.replace(/^.*?: /, '') || 'Something went wrong. Please try again.'
}

// Everyone gets a quiet anonymous account the first time they hold a seat, so a
// hold belongs to someone without asking for an email up front.
async function ensureSignedIn() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  if (data.session) return true
  const { error } = await supabase.auth.signInAnonymously()
  if (error) {
    set({ bookingMessage: `Couldn't sign you in: ${error.message}` })
    return false
  }
  return true
}

export async function loadShows(venueId: string) {
  if (!supabase) return
  const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('shows')
    .select('id, venue_id, title, starts_at, movie_id')
    .eq('venue_id', venueId)
    .gte('starts_at', since)
    .order('starts_at')
  if (error) {
    set({ bookingMessage: errorText(error), shows: [], showId: null })
    return
  }
  set({ shows: data ?? [], showId: data?.[0]?.id ?? null, seatStates: {} })
}

export async function refreshSeats() {
  const showId = get().showId
  if (!supabase || !showId) return
  const { data, error } = await supabase.rpc('get_seat_states', { p_show: showId })
  if (error) {
    set({ bookingMessage: errorText(error) })
    return
  }
  if (get().showId !== showId) return // user switched shows while we waited
  const seatStates: Record<string, SeatState> = {}
  for (const row of (data ?? []) as { seat_id: string; state: 'booked' | 'held'; mine: boolean; expires_at: string | null }[]) {
    seatStates[row.seat_id] = { state: row.state, mine: row.mine, expiresAt: row.expires_at }
  }
  set({ seatStates })
}

export async function holdSeat(seatId: string) {
  const showId = get().showId
  if (!supabase || !showId) return
  set({ bookingBusy: true, bookingMessage: null })
  if (await ensureSignedIn()) {
    const { error } = await supabase.rpc('hold_seat', { p_show: showId, p_seat: seatId })
    if (error) set({ bookingMessage: errorText(error) })
    await refreshSeats()
  }
  set({ bookingBusy: false })
}

export async function bookSeat(seatId: string) {
  const showId = get().showId
  if (!supabase || !showId) return
  set({ bookingBusy: true, bookingMessage: null })
  const { error } = await supabase.rpc('book_seat', { p_show: showId, p_seat: seatId })
  set({ bookingMessage: error ? errorText(error) : `Seat ${seatId} is yours. Enjoy the movie!` })
  await refreshSeats()
  set({ bookingBusy: false })
}

export async function releaseHold() {
  const showId = get().showId
  if (!supabase || !showId) return
  set({ bookingBusy: true, bookingMessage: null })
  const { error } = await supabase.rpc('release_hold', { p_show: showId })
  if (error) set({ bookingMessage: errorText(error) })
  await refreshSeats()
  set({ bookingBusy: false })
}

// Keeps the seat map in sync with the database. Mounted once in App.
export function useBookingSync() {
  const venueId = useTheater((s) => s.theater.venue.id)
  const showId = useTheater((s) => s.showId)
  const seatStates = useTheater((s) => s.seatStates)

  useEffect(() => {
    loadShows(venueId)
  }, [venueId])

  // Live updates for the chosen show. The database sends "seat_changed" whenever a
  // hold or booking changes; we then re-read the seat states. We also re-read right
  // after subscribing, because a change can slip through while the channel connects.
  // Picking a showtime puts that show's movie on the screen.
  useEffect(() => {
    const show = get().shows.find((s) => s.id === showId)
    const movie = CATALOG.find((m) => m.id === show?.movie_id)
    const current = get().movie
    if (movie && !(current?.kind === 'youtube' && current.id === movie.youtubeId)) {
      get().setMovie(parseMovieUrl(catalogUrl(movie)))
    }
  }, [showId])

  useEffect(() => {
    if (!supabase || !showId) return
    const channel = supabase
      .channel(`show:${showId}`)
      .on('broadcast', { event: 'seat_changed' }, () => refreshSeats())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshSeats()
      })
    refreshSeats()
    return () => {
      supabase?.removeChannel(channel)
    }
  }, [showId])

  // Holds run out silently in the database, so refresh when the next one expires.
  useEffect(() => {
    const times = Object.values(seatStates)
      .map((s) => (s.expiresAt ? Date.parse(s.expiresAt) : Infinity))
      .filter(Number.isFinite)
    if (!times.length) return
    const wait = Math.max(500, Math.min(...times) - Date.now() + 500)
    const timer = window.setTimeout(refreshSeats, wait)
    return () => window.clearTimeout(timer)
  }, [seatStates])
}
