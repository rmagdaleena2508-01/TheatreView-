import { useEffect } from 'react'
import { getSupabase as getClient } from './supabase'
import { BOOKING_ENABLED } from '../config'

// No database calls at all while booking is switched off.
const getSupabase = () => (BOOKING_ENABLED ? getClient() : null)
import { useTheater } from '../store'
import { CATALOG, catalogUrl } from '../movies'
import { movieKey, parseMovieUrl } from '../movie'

export type Show = { id: string; venue_id: string; title: string; starts_at: string; movie_id: string | null }
export type SeatState = { state: 'booked' | 'held'; mine: boolean; expiresAt: string | null }

const set = useTheater.setState
const get = useTheater.getState

// Retries a database call when the network or server hiccups (timeouts, 5xx, 429),
// waiting a bit longer each time with some randomness, so a busy moment with many
// visitors doesn't turn into everyone retrying at the same instant.
async function withRetry<T extends { error: unknown; status: number }>(call: () => PromiseLike<T>, tries = 3): Promise<T> {
  let result = await call()
  for (let i = 1; i < tries && result.error && isTransient(result.status); i++) {
    await new Promise((r) => setTimeout(r, 300 * 2 ** i + Math.random() * 300))
    result = await call()
  }
  return result
}

// 0 = the request never got an answer (network), 429 = too many requests, 5xx = server trouble.
const isTransient = (status: number) => status === 0 || status === 429 || status >= 500

// Friendly text for errors raised by the database functions.
function errorText(error: { message?: string } | null) {
  return error?.message?.replace(/^.*?: /, '') || 'Something went wrong. Please try again.'
}

// Everyone gets a quiet anonymous account the first time they hold a seat, so a
// hold belongs to someone without asking for an email up front.
async function ensureSignedIn() {
  const supabase = await getSupabase()
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
  const supabase = await getSupabase()
  if (!supabase) return
  const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  const { data, error } = await withRetry(() =>
    supabase
      .from('shows')
      .select('id, venue_id, title, starts_at, movie_id')
      .eq('venue_id', venueId)
      .gte('starts_at', since)
      .order('starts_at'),
  )
  if (error) {
    set({ bookingMessage: errorText(error), shows: [], showId: null })
    return
  }
  set({ shows: data ?? [], showId: data?.[0]?.id ?? null, seatStates: {} })
}

export async function refreshSeats() {
  const showId = get().showId
  const supabase = await getSupabase()
  if (!supabase || !showId) return
  const { data, error } = await withRetry(() => supabase.rpc('get_seat_states', { p_show: showId }))
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
  const supabase = await getSupabase()
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
  const supabase = await getSupabase()
  if (!supabase || !showId) return
  set({ bookingBusy: true, bookingMessage: null })
  const { error } = await supabase.rpc('book_seat', { p_show: showId, p_seat: seatId })
  set({ bookingMessage: error ? errorText(error) : `Seat ${seatId} is yours. Enjoy the movie!` })
  await refreshSeats()
  set({ bookingBusy: false })
}

export async function releaseHold() {
  const showId = get().showId
  const supabase = await getSupabase()
  if (!supabase || !showId) return
  set({ bookingBusy: true, bookingMessage: null })
  const { error } = await supabase.rpc('release_hold', { p_show: showId })
  if (error) set({ bookingMessage: errorText(error) })
  await refreshSeats()
  set({ bookingBusy: false })
}

// When a seat changes, every open browser hears about it at once. If all of them
// asked the database straight away, 100 visitors would send 100 requests in the
// same instant. Instead each one waits a short, random moment and several changes
// close together are folded into a single request.
let refreshTimer = 0
function scheduleRefresh() {
  if (refreshTimer) return
  refreshTimer = window.setTimeout(() => {
    refreshTimer = 0
    refreshSeats()
  }, 200 + Math.random() * 600)
}

// Keeps the seat map in sync with the database. Mounted once in App.
export function useBookingSync() {
  const venueId = useTheater((s) => s.theater.venue.id)
  const showId = useTheater((s) => s.showId)
  const seatStates = useTheater((s) => s.seatStates)

  useEffect(() => {
    if (BOOKING_ENABLED) loadShows(venueId)
  }, [venueId])

  // Live updates for the chosen show. The database sends "seat_changed" whenever a
  // hold or booking changes; we then re-read the seat states. We also re-read right
  // after subscribing, because a change can slip through while the channel connects.
  // Picking a showtime puts that show's movie on the screen.
  useEffect(() => {
    const show = get().shows.find((s) => s.id === showId)
    const movie = CATALOG.find((m) => m.id === show?.movie_id)
    const next = movie ? parseMovieUrl(catalogUrl(movie)) : null
    if (next && movieKey(next) !== movieKey(get().movie)) get().setMovie(next)
  }, [showId])

  useEffect(() => {
    const pending = getSupabase()
    if (!pending || !showId) return
    let stop = () => {}
    let cancelled = false
    pending.then((supabase) => {
      if (cancelled) return
      const channel = supabase
        .channel(`show:${showId}`)
        .on('broadcast', { event: 'seat_changed' }, () => scheduleRefresh())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') refreshSeats()
        })
      stop = () => supabase.removeChannel(channel)
    })
    refreshSeats()
    return () => {
      cancelled = true
      stop()
    }
  }, [showId])

  // Holds run out silently in the database, so refresh when the next one expires.
  useEffect(() => {
    const times = Object.values(seatStates)
      .map((s) => (s.expiresAt ? Date.parse(s.expiresAt) : Infinity))
      .filter(Number.isFinite)
    if (!times.length) return
    const wait = Math.max(500, Math.min(...times) - Date.now() + 500)
    const timer = window.setTimeout(scheduleRefresh, wait)
    return () => window.clearTimeout(timer)
  }, [seatStates])
}
