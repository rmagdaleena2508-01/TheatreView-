import { useCallback, useEffect, useRef } from 'react'
import { lightPresetName, useTheater } from '../store'

const LENGTH = 70 // resting cord length in px
const MAX_PULL = 90 // how far the knob can be pulled down
const TRIGGER = 32 // pull past this and let go to switch the lights
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
  const sim = useRef({ y: 0, vy: 0, angle: 0, va: 0, dragging: false, startX: 0, startY: 0, moved: false })
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
    Object.assign(sim.current, { dragging: true, startX: e.clientX, startY: e.clientY, moved: false, vy: 0, va: 0 })
    animate()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = sim.current
    if (!s.dragging) return
    const dy = e.clientY - s.startY
    const dx = e.clientX - s.startX
    if (Math.abs(dy) > 3 || Math.abs(dx) > 3) s.moved = true
    // Rubber-band: the cord gets stiffer the further you pull.
    s.y = dy <= 0 ? dy * 0.15 : MAX_PULL * (1 - Math.exp(-dy / MAX_PULL))
    s.angle = Math.max(-0.5, Math.min(0.5, Math.atan2(dx, LENGTH + s.y)))
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
    <div className="cord">
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
