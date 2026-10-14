import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, InstancedMesh, Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ThreeEvent } from '@react-three/fiber'
import { useTheater } from '../store'

const BASE = new Color('#3b3e48')
const HOVER = new Color('#5fd4ff')
const FOCUS = new Color('#2f7bff')
const SELECTED = new Color('#ffb547') // your seat (held or picked)
const BOOKED_MINE = new Color('#3ddc84')
const TAKEN = new Color('#16171b') // booked by someone else
const HELD_OTHER = new Color('#5a3f1c') // someone else is deciding

// One cinema seat built from a few boxes, merged so it is a single geometry.
// Recliner venues have deeper rows, so the seat gets deeper too.
function makeSeatGeometry(seatWidth: number, rowDepth: number) {
  const w = seatWidth * 0.86
  const d = Math.min(0.9, rowDepth * 0.45)
  const cushion = new BoxGeometry(w, 0.14, d).translate(0, 0.45, 0)
  const back = new BoxGeometry(w, 0.62, 0.12).translate(0, 0.78, d / 2)
  const armL = new BoxGeometry(0.06, 0.26, d).translate(-w / 2 - 0.02, 0.6, 0.02)
  const armR = armL.clone().translate(w + 0.04, 0, 0)
  const legs = new BoxGeometry(w * 0.7, 0.38, d * 0.6).translate(0, 0.19, 0.05)
  return mergeGeometries([cushion, back, armL, armR, legs])!
}

export function Seats() {
  const mesh = useRef<InstancedMesh>(null!)
  const theater = useTheater((s) => s.theater)
  const { seats, venue } = theater
  const geometry = useMemo(() => makeSeatGeometry(venue.seatWidth, venue.rowDepth), [venue])
  const hovered = useTheater((s) => s.hovered)
  const focused = useTheater((s) => s.focused)
  const selected = useTheater((s) => s.selected)
  const mode = useTheater((s) => s.mode)
  const seatStates = useTheater((s) => s.seatStates)
  const setHovered = useTheater((s) => s.setHovered)
  const sit = useTheater((s) => s.sit)

  // Place every seat once per venue.
  useLayoutEffect(() => {
    const dummy = new Object3D()
    for (const seat of seats) {
      dummy.position.copy(seat.position)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(seat.index, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [seats])

  // Recolor only when the hovered / focused / selected seat changes.
  useLayoutEffect(() => {
    for (const seat of seats) {
      const booking = seatStates[seat.id]
      let color = BASE
      if (booking?.state === 'booked') color = booking.mine ? BOOKED_MINE : TAKEN
      else if (booking?.state === 'held') color = booking.mine ? SELECTED : HELD_OTHER
      if (seat === focused && !booking?.mine) color = FOCUS
      else if (seat === hovered && !booking) color = HOVER
      else if (seat === selected && !booking) color = SELECTED
      mesh.current.setColorAt(seat.index, color)
    }
    mesh.current.instanceColor!.needsUpdate = true
  }, [seats, hovered, focused, selected, seatStates])

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (mode === 'pov') return
    const seat = e.instanceId !== undefined ? seats[e.instanceId] : null
    if (seat !== useTheater.getState().hovered) setHovered(seat)
  }

  // Clicking a seat sits you in it: the camera flies to that seat's eye point.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (mode === 'pov' || e.delta > 4 || e.instanceId === undefined) return // ignore drags
    setHovered(null)
    sit(seats[e.instanceId])
  }

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, seats.length]}
      onPointerMove={onMove}
      onPointerOut={() => setHovered(null)}
      onClick={onClick}
    >
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  )
}
