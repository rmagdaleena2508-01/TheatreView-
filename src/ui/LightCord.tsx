import { useCallback, useEffect, useRef } from 'react'
import { lightPresetName, useTheater } from '../store'

const LENGTH = 70 // resting cord length in px
const MAX_PULL = 90 // how far the knob can be pulled down
const TRIGGER = 32 // pull past this and let go to switch the lights
const ANCHOR_TOP = 6 // px from the top of the mount to where the cord starts
const KNOB_CENTER = LENGTH + 15 // resting distance from the anchor to the knob's center
const MAX_SWING = 1.1 // radians the cord can swing to either side
const STIFFNESS = 260 // spring that pulls the cord back up
const DAMPING = 11
const SWAY_STIFFNESS = 60 // softer spring for the side-to-side swing
const SWAY_DAMPING = 3.5

// A pull-cord light switch with real spring physics: drag the knob down and let go
// to step the house lights (Movie > Dim > Bright > Full), or use the slider.
export function LightCord() {
  const lightLevel = useTheater((s) => s.lightLevel)
  const setLightLevel = useTheater((s) => s.setLightLevel)
  const cycleLight = useTheater((s) => s.cycleLight)

  const swing = useRef<HTMLDivElement>(null!)
  const string = useRef<HTMLDivElement>(null!)
  const knob = useRef<HTMLButtonElement>(null!)
  const root = useRef<HTMLDivElement>(null!)
  const sim = useRef({
    y: 0,
    vy: 0,
    angle: 0,
    va: 0,
    dragging: false,
    moved: false,
    anchorX: 0, // where the cord hangs from, in page pixels
    anchorY: 0,
    grabX: 0, // where on the knob you grabbed it, so it doesn't jump to the cursor
    grabY: 0,
    lastT: 0,
  })
  const raf = useRef(0)

  const draw = () => {
    const s = sim.current
    string.current.style.height = `${LENGTH + s.y}px`
    knob.current.style.transform = `translate(-50%, ${s.y}px)`
    swing.current.style.transform = `rotate(${s.angle}rad)`
  }

  const animate = useCallback(() => {
    cancelAnimationFrame(raf.current)
    let last = performance.now()
    const step = (now: number) => {
      const s = sim.current
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      if (!s.dragging) {
        s.vy += (-STIFFNESS * s.y - DAMPING * s.vy) * dt
        s.y += s.vy * dt
        s.va += (-SWAY_STIFFNESS * s.angle - SWAY_DAMPING * s.va) * dt
        s.angle += s.va * dt
      }
      draw()
      const resting = Math.abs(s.y) < 0.2 && Math.abs(s.vy) < 1 && Math.abs(s.angle) < 0.002 && Math.abs(s.va) < 0.01
      if (s.dragging || !resting) raf.current = requestAnimationFrame(step)
      else {
        s.y = s.vy = s.angle = s.va = 0
        draw()
      }
    }
    raf.current = requestAnimationFrame(step)
  }, [])

  // A quick tug: kick the knob downward and let the spring bring it back.
  const tug = useCallback(() => {
    sim.current.vy = 520
    sim.current.va = (Math.random() - 0.5) * 1.2
    cycleLight()
    animate()
  }, [animate, cycleLight])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key.toLowerCase() === 'l' && !t.closest('input, select, textarea')) tug()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf.current)
    }
  }, [tug])

  const onPointerDown = (e: React.PointerEvent) => {
    knob.current.setPointerCapture(e.pointerId)
    const s = sim.current
    const rootRect = root.current.getBoundingClientRect()
    const knobRect = knob.current.getBoundingClientRect()
    Object.assign(s, {
      dragging: true,
      moved: false,
      vy: 0,
      va: 0,
      anchorX: rootRect.left + rootRect.width / 2,
      anchorY: rootRect.top + ANCHOR_TOP,
      grabX: e.clientX - (knobRect.left + knobRect.width / 2),
      grabY: e.clientY - (knobRect.top + knobRect.height / 2),
      lastT: performance.now(),
    })
    animate()
  }

  // The knob follows the cursor 1:1: the cord points from where it hangs to
  // where your hand is, and stretches to reach it.
  const onPointerMove = (e: React.PointerEvent) => {
    const s = sim.current
    if (!s.dragging) return
    const x = e.clientX - s.grabX - s.anchorX
    const y = e.clientY - s.grabY - s.anchorY
    const pull = Math.hypot(x, y) - KNOB_CENTER
    if (Math.abs(pull) > 3 || Math.abs(x) > 3) s.moved = true

    const now = performance.now()
    const dt = Math.max(0.001, (now - s.lastT) / 1000)
    // CSS rotate() turns clockwise, so a hand to the right needs a negative angle.
    const angle = Math.max(-MAX_SWING, Math.min(MAX_SWING, -Math.atan2(x, y)))
    const length = pull < 0 ? Math.max(pull, -12) : pull < MAX_PULL ? pull : MAX_PULL + (pull - MAX_PULL) * 0.2
    s.va = Math.max(-8, Math.min(8, (angle - s.angle) / dt)) // keep the swing going when you let go
    s.vy = Math.max(-1500, Math.min(1500, (length - s.y) / dt))
    s.angle = angle
    s.y = length
    s.lastT = now
  }

  const onPointerUp = () => {
    const s = sim.current
    if (!s.dragging) return
    s.dragging = false
    if (!s.moved) {
      tug() // a plain click also pulls the cord
      return
    }
    if (s.y > TRIGGER) cycleLight()
    animate()
  }

  const name = lightPresetName(lightLevel)

  return (
    <div className="cord" ref={root}>
      <div className="cord-mount" />
      <div className="cord-swing" ref={swing}>
        <div className="cord-string" ref={string} style={{ height: LENGTH }} />
        <button
          ref={knob}
          className="cord-knob"
          aria-label={`House lights: ${name}. Pull to change`}
          title="Pull me (or press L)"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              tug()
            }
          }}
          style={{ ['--glow' as string]: lightLevel }}
        />
      </div>
      <div className="cord-panel">
        <span className="cord-label">
          Lights <strong>{name}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(lightLevel * 100)}
          onChange={(e) => setLightLevel(Number(e.target.value) / 100)}
          aria-label="House light brightness"
        />
      </div>
    </div>
  )
}
