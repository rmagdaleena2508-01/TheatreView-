import { useEffect, useMemo } from 'react'
import { seatView } from '../layout'
import { useTheater } from '../store'
import { VENUES } from '../venues'

const ft = (m: number) => Math.round(m * 3.281)

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
    </section>
  )
}

export function Hud() {
  const theater = useTheater((s) => s.theater)
  const hovered = useTheater((s) => s.hovered)
  const focused = useTheater((s) => s.focused)
  const selected = useTheater((s) => s.selected)
  const mode = useTheater((s) => s.mode)
  const { enterPov, exitPov, select, focus } = useTheater.getState()
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
        <span><i className="dot selected" /> Selected</span>
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
              <button className="primary" onClick={select} disabled={selected === focused}>
                {selected === focused ? 'Selected' : 'Select'}
              </button>
              <button className="close" aria-label="Clear seat" onClick={() => (mode === 'pov' ? exitPov() : focus(null))}>
                ×
              </button>
            </>
          )}
          {!focused && <span className="cell-hint">Click to sit here</span>}
        </div>
      )}
    </>
  )
}
