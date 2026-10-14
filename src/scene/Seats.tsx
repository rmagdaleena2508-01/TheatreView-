import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, InstancedMesh, Object3D, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useTheater } from '../store'

const BASE = new Color('#3b3e48')
const HOVER = new Color('#5fd4ff')
const FOCUS = new Color('#2f7bff')
const SELECTED = new Color('#ffb547') // your seat (held or picked)
const BOOKED_MINE = new Color('#3ddc84')
const TAKEN = new Color('#16171b') // booked by someone else
const HELD_OTHER = new Color('#5a3f1c') // someone else is deciding

// One cinema seat, modelled like a real auditorium chair and merged into a single
// geometry so all seats still draw in one go: padded seat cushion, a padded backrest
// leaning back about 12 degrees, armrests on posts, and a pedestal base. Corners are
// rounded so light rolls over the edges instead of showing hard box lines.
// Recliner venues have deeper rows, so the seat gets deeper too.
function rounded(width: number, height: number, depth: number, radius: number, segments = 1) {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2))
}

function makeSeatGeometry(seatWidth: number, rowDepth: number) {
  const w = seatWidth * 0.84
  const d = Math.min(0.85, rowDepth * 0.44)
  const lean = 0.21 // radians, ~12 degrees
  const cushion = rounded(w, 0.15, d, 0.06, 2).rotateX(-0.05).translate(0, 0.45, -0.01)
  const back = rounded(w * 0.96, 0.62, 0.13, 0.06, 2)
    .translate(0, 0.31, 0) // pivot at the bottom edge so it leans back from the seat
    .rotateX(lean)
    .translate(0, 0.5, d / 2 - 0.02)
  const arm = rounded(0.075, 0.055, d * 0.92, 0.025).translate(0, 0.66, 0.02)
  const post = rounded(0.055, 0.24, 0.09, 0.02).translate(0, 0.53, 0.05)
  const half = w / 2 + 0.035
  const parts = [
    cushion,
    back,
    arm.clone().translate(-half, 0, 0),
    arm.clone().translate(half, 0, 0),
    post.clone().translate(-half, 0, 0),
    post.clone().translate(half, 0, 0),
    rounded(w * 0.42, 0.36, d * 0.42, 0.04).translate(0, 0.18, 0.04), // pedestal
  ]
  // Keep each part's own smooth normals (recomputing them here would facet the curves).
  return mergeGeometries(parts)!
}

export function Seats() {
  const mesh = useRef<InstancedMesh>(null!)
  const hit = useRef<InstancedMesh>(null!)
  const theater = useTheater((s) => s.theater)
  const { seats, venue } = theater
  const geometry = useMemo(() => makeSeatGeometry(venue.seatWidth, venue.rowDepth), [venue])
  // The detailed chair has ~1,000 triangles. Testing the mouse against all of them for
  // every seat on every mouse move would be slow, so the mouse is tested against one
  // invisible box per seat instead.
  const hitBox = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    return new BoxGeometry(size.x, size.y, size.z).translate(centre.x, centre.y, centre.z)
  }, [geometry])
  const hovered = useTheater((s) => s.hovered)
  const focused = useTheater((s) => s.focused)
  const selected = useTheater((s) => s.selected)
  const mode = useTheater((s) => s.mode)
  const seatStates = useTheater((s) => s.seatStates)
  const setHovered = useTheater((s) => s.setHovered)
  const sit = useTheater((s) => s.sit)
  const invalidate = useThree((s) => s.invalidate)

  // Place every seat once per venue.
  useLayoutEffect(() => {
    const dummy = new Object3D()
    for (const seat of seats) {
      dummy.position.copy(seat.position)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(seat.index, dummy.matrix)
      hit.current.setMatrixAt(seat.index, dummy.matrix)
    }
    for (const m of [mesh.current, hit.current]) {
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
    invalidate()
  }, [seats, invalidate])

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
    invalidate()
  }, [seats, hovered, focused, selected, seatStates, invalidate])

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
    <>
      <instancedMesh ref={mesh} args={[geometry, undefined, seats.length]} raycast={() => null}>
        <meshStandardMaterial roughness={0.8} metalness={0.05} />
      </instancedMesh>
      <instancedMesh
        ref={hit}
        args={[hitBox, undefined, seats.length]}
        onPointerMove={onMove}
        onPointerOut={() => setHovered(null)}
        onClick={onClick}
      >
        <meshBasicMaterial visible={false} />
      </instancedMesh>
    </>
  )
}
