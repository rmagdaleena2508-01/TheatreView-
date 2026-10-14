import { useEffect, useMemo, useState } from 'react'
import { seatView } from '../layout'
import { useTheater } from '../store'
import { VENUES } from '../venues'
import { SAMPLE_MOVIE_URL, parseMovieUrl } from '../movie'
import { supabase } from '../backend/supabase'
import { bookSeat, holdSeat, releaseHold } from '../backend/booking'
import type { Seat } from '../layout'

const ft = (m: number) => Math.round(m * 3.281)

function MoviePanel() {
  const movie = useTheater((s) => s.movie)
  const playing = useTheater((s) => s.moviePlaying)
  const muted = useTheater((s) => s.movieMuted)
  const error = useTheater((s) => s.movieError)
  const { setMovie, setMoviePlaying, setMovieMuted, setMovieError } = useTheater.getState()
  const [link, setLink] = useState('')

  const load = (text: string) => {
    const parsed = parseMovieUrl(text)
    if (!parsed) {
      setMovieError('Paste a YouTube link (youtube.com or youtu.be) or a direct .mp4 / .webm link.')
      return
    }
    setMovie(parsed)
    setLink('')
  }

  return (
    <div className="movie" aria-label="Now showing">
      <form
        className="movie-form"
        onSubmit={(e) => {
          e.preventDefault()
          load(link)
        }}
      >
        <input
          type="url"
          inputMode="url"
          placeholder="Paste a YouTube link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-label="YouTube or video link"
        />
        <button type="submit" className="primary">Play</button>
      </form>
      {error && <p className="movie-error">{error}</p>}
      {movie && (
        <div className="movie-controls">
          <button onClick={() => setMoviePlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
          <button onClick={() => setMovieMuted(!muted)}>{muted ? 'Sound on' : 'Mute'}</button>
          <button onClick={() => setMovie(null)}>Stop</button>
        </div>
      )}
      {!movie && (
        <button className="movie-sample" onClick={() => load(SAMPLE_MOVIE_URL)}>
          Play a sample movie
        </button>
      )}
    </div>
  )
}

const timeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

function ShowPicker() {
  const shows = useTheater((s) => s.shows)
  const showId = useTheater((s) => s.showId)
  const setShow = useTheater((s) => s.setShow)
  if (!supabase) return <p className="venue-city">Booking is off. Add Supabase keys to turn it on (see README).</p>
  if (!shows.length) return <p className="venue-city">No showtimes for this theater yet.</p>
  return (
    <select
      value={showId ?? ''}
      onChange={(e) => {
        setShow(e.target.value)
        e.target.blur()
      }}
      aria-label="Choose a showtime"
    >
      {shows.map((show) => (
        <option key={show.id} value={show.id}>
          {timeFormat.format(new Date(show.starts_at))} · {show.title}
        </option>
      ))}
    </select>
  )
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const left = Math.max(0, Math.floor((Date.parse(until) - now) / 1000))
  return (
    <span className="countdown">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  )
}

// The booking buttons for the seat you are looking at.
function BookingActions({ seat }: { seat: Seat }) {
  const booking = useTheater((s) => s.seatStates[seat.id])
  const busy = useTheater((s) => s.bookingBusy)
  const selected = useTheater((s) => s.selected)
  const select = useTheater((s) => s.select)

  if (!supabase) {
    // No backend: Select just remembers the seat in this browser.
    return (
      <button className="primary" onClick={select} disabled={selected === seat}>
        {selected === seat ? 'Selected' : 'Select'}
      </button>
    )
  }
  if (booking?.state === 'booked') {
    return <span className={booking.mine ? 'status mine' : 'status'}>{booking.mine ? 'Booked ✓' : 'Taken'}</span>
  }
  if (booking?.state === 'held' && !booking.mine) {
    return <span className="status">Someone is choosing this seat</span>
  }
  if (booking?.state === 'held' && booking.mine) {
    return (
      <>
        <span className="status held">
          Held for you <Countdown until={booking.expiresAt!} />
        </span>
        <button className="primary" disabled={busy} onClick={() => bookSeat(seat.id)}>
          Book seat
        </button>
        <button className="ghost" disabled={busy} onClick={() => releaseHold()}>
          Let go
        </button>
      </>
    )
  }
  return (
    <button className="primary" disabled={busy} onClick={() => holdSeat(seat.id)}>
      {busy ? 'Holding…' : 'Select'}
    </button>
  )
}

function VenuePanel() {
  const theater = useTheater((s) => s.theater)
  const setVenue = useTheater((s) => s.setVenue)
  const { venue, screen, room, rows, seats } = theater
  const maxRiser = Math.max(...rows.slice(1).map((r, i) => r.floorY - rows[i].floorY), 0)

  return (
    <section className="venue" aria-label="Venue">
      <select
        value={venue.id}
        onChange={(e) => {
          setVenue(e.target.value)
          e.target.blur() // so arrow keys move seats, not the dropdown
        }}
        aria-label="Choose a cinema"
      >
        {VENUES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <p className="venue-city">
        {venue.city} · {venue.format}
      </p>
      <dl>
        <dt>Screen</dt>
        <dd>
          {screen.width.toFixed(1)} × {screen.height.toFixed(1)} m ({ft(screen.width)} × {ft(screen.height)} ft)
        </dd>
        <dt>Aspect</dt>
        <dd>{venue.screen.aspect}</dd>
        <dt>Shape</dt>
        <dd>{venue.screen.curveNote}</dd>
        <dt>Room</dt>
        <dd>
          {room.width.toFixed(0)} w × {room.depth.toFixed(0)} d × {room.height.toFixed(0)} h m
        </dd>
        <dt>Seating</dt>
        <dd>
          {rows.length} rows · {seats.length} seats
        </dd>
        <dt>Rake</dt>
        <dd>
          rises {rows[rows.length - 1].floorY.toFixed(1)} m, max step {(maxRiser * 100).toFixed(0)} cm
        </dd>
      </dl>
      <h2 className="venue-heading">Showtime</h2>
      <ShowPicker />
      <h2 className="venue-heading">Now showing</h2>
      <MoviePanel />
    </section>
  )
}

export function Hud() {
  const theater = useTheater((s) => s.theater)
  const hovered = useTheater((s) => s.hovered)
  const focused = useTheater((s) => s.focused)
  const mode = useTheater((s) => s.mode)
  const bookingMessage = useTheater((s) => s.bookingMessage)
  const { enterPov, exitPov, focus } = useTheater.getState()
  const seat = focused ?? hovered
  const view = useMemo(() => (seat ? seatView(theater, seat) : null), [theater, seat])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return
      const state = useTheater.getState()
      if (e.key === 'Escape') {
        if (state.mode === 'pov') state.exitPov()
        else state.focus(null)
      }
      if (state.mode !== 'pov') return
      // Arrow keys hop to the neighbouring seat while you are sitting.
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0], // towards the screen
        ArrowDown: [1, 0],
      }
      const m = moves[e.key]
      if (m) {
        e.preventDefault()
        state.moveSeat(m[0], m[1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header className="topbar">
        <span className="brand">TheatreView</span>
        <span className="hint">
          {mode === 'pov'
            ? 'Drag to look around · Arrow keys change seat · Esc to leave'
            : 'Click a seat to sit in it · Drag to orbit · Scroll to zoom'}
        </span>
      </header>

      <VenuePanel />

      <footer className="legend">
        <span><i className="dot base" /> Available</span>
        <span><i className="dot hover" /> Hovered</span>
        <span><i className="dot focus" /> Your view</span>
        <span><i className="dot selected" /> Yours</span>
        {supabase && <span><i className="dot taken" /> Taken</span>}
      </footer>

      {seat && view && (
        <div className="seatbar" role="region" aria-label="Seat details">
          <div className="cell">
            <small>SEAT</small>
            <strong>{seat.id}</strong>
          </div>
          <div className="cell">
            <small>ROW</small>
            <strong>{seat.row}</strong>
          </div>
          <div className="cell">
            <small>SCREEN FILLS</small>
            <strong>{view.horizontalAngle.toFixed(0)}°</strong>
          </div>
          <div className="cell">
            <small>LOOK UP</small>
            <strong>{view.verticalAngle.toFixed(0)}°</strong>
          </div>
          <div className="cell">
            <small>HEAD CLEARANCE</small>
            <strong>{view.cValue === null ? 'Front' : `${Math.round(view.cValue * 1000)} mm`}</strong>
          </div>
          <div className={`cell rating rating-${view.rating.replace(/\s+/g, '-').toLowerCase()}`}>
            <small>VIEW</small>
            <strong>{view.rating}</strong>
          </div>
          {focused && (
            <>
              {mode === 'pov' ? (
                <button className="ghost" onClick={exitPov}>Exit POV</button>
              ) : (
                <button className="ghost" onClick={enterPov}>View Seat POV</button>
              )}
              <BookingActions seat={focused} />
              <button className="close" aria-label="Clear seat" onClick={() => (mode === 'pov' ? exitPov() : focus(null))}>
                ×
              </button>
            </>
          )}
          {!focused && <span className="cell-hint">Click to sit here</span>}
        </div>
      )}
      {bookingMessage && (
        <p className="booking-message" role="status">
          {bookingMessage}
        </p>
      )}
    </>
  )
}
