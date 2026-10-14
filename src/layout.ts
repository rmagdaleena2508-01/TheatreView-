import { Vector3 } from 'three'
import type { Venue } from './venues'

// Shared constants from cinema design guidance (see docs/CINEMA_RESEARCH.md).
export const EYE_HEIGHT = 1.15 // seated eye level above the seat floor, meters
export const MAX_RISER = 0.54 // max step between rows before a guardrail is required
export const AISLE_WIDTH = 1.2
export const SIDE_AISLE = 1.6
export const THX_MIN_ANGLE = 36 // THX: last row must still see at least 36 degrees
export const SMPTE_MIN_ANGLE = 30 // SMPTE EG-18: minimum 30 degrees
export const NECK_STRAIN_ANGLE = 35 // SMPTE EG-18: discomfort above 35 degrees to screen top

const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const deg = (d: number) => (d * Math.PI) / 180

export type Row = {
  index: number
  letter: string
  z: number // distance from the screen plane to the seat
  floorY: number // floor height of this row above the front-row floor
  eyeY: number
  cValue: number | null // clearance over the head in front, meters; null for the front row
}

export type Seat = {
  id: string // e.g. "E6"
  row: string // e.g. "E"
  rowIndex: number
  number: number // 1-based, counted left to right from the audience view
  index: number // instance index inside the InstancedMesh
  position: Vector3 // floor point where the seat stands
}

export type TheaterLayout = {
  venue: Venue
  screen: { width: number; height: number; bottom: number; top: number; center: Vector3; curveDepth: number }
  rows: Row[]
  seats: Seat[]
  room: { width: number; depth: number; height: number }
  seatingWidth: number
  overview: { position: Vector3; target: Vector3 }
}

// Builds the whole auditorium from a venue's published screen size plus design rules:
// - front row: no closer than the venue's max vertical angle to the top of the screen
// - last row: no further than where the screen fills THX's 36 degree minimum
// - rake: each row is raised just enough that the sightline to the bottom of the
//   screen clears the head in front by the C-value, capped at MAX_RISER per step
export function buildTheater(venue: Venue): TheaterLayout {
  const { width: W, height: H } = venue.screen
  const bottom = venue.screenBottom
  const top = bottom + H

  const firstZ = Math.max(4, (top - EYE_HEIGHT) / Math.tan(deg(venue.maxVerticalAngle)))
  const lastZMax = Math.max(W / 2 / Math.tan(deg(THX_MIN_ANGLE / 2)), firstZ + 4 * venue.rowDepth)
  const rowCount = Math.min(venue.rows, ROW_LETTERS.length, Math.floor((lastZMax - firstZ) / venue.rowDepth) + 1)

  const rows: Row[] = []
  for (let i = 0; i < rowCount; i++) {
    const z = firstZ + i * venue.rowDepth
    if (i === 0) {
      rows.push({ index: 0, letter: 'A', z, floorY: 0, eyeY: EYE_HEIGHT, cValue: null })
      continue
    }
    const prev = rows[i - 1]
    // Heights relative to the focal point (bottom edge of the picture).
    const ePrev = prev.eyeY - bottom
    const eNeeded = ((ePrev + venue.cValue) * z) / prev.z
    const riser = Math.min(MAX_RISER, Math.max(0, eNeeded - ePrev))
    const floorY = prev.floorY + riser
    const eyeY = floorY + EYE_HEIGHT
    const cValue = ((eyeY - bottom) * prev.z) / z - ePrev
    rows.push({ index: i, letter: ROW_LETTERS[i], z, floorY, eyeY, cValue })
  }

  const blockWidth = venue.seatsPerBlock * venue.seatWidth
  const seatingWidth = venue.blocks * blockWidth + (venue.blocks - 1) * AISLE_WIDTH
  const seats: Seat[] = []
  for (const row of rows) {
    let number = 1
    for (let b = 0; b < venue.blocks; b++) {
      const blockStart = -seatingWidth / 2 + b * (blockWidth + AISLE_WIDTH)
      for (let s = 0; s < venue.seatsPerBlock; s++) {
        const x = blockStart + (s + 0.5) * venue.seatWidth
        seats.push({
          id: `${row.letter}${number}`,
          row: row.letter,
          rowIndex: row.index,
          number,
          index: seats.length,
          position: new Vector3(x, row.floorY, row.z),
        })
        number++
      }
    }
  }

  const last = rows[rows.length - 1]
  const room = {
    width: Math.max(W + 3, seatingWidth + SIDE_AISLE * 2),
    depth: last.z + 3,
    height: Math.max(top + 1.5, last.eyeY + 2.5),
  }

  const curveDepth = venue.screen.curveRatio > 0 ? W / venue.screen.curveRatio : 0
  const span = Math.max(room.width, room.depth)

  return {
    venue,
    screen: { width: W, height: H, bottom, top, center: new Vector3(0, bottom + H / 2, 0), curveDepth },
    rows,
    seats,
    room,
    seatingWidth,
    overview: {
      position: new Vector3(0, room.height * 0.8 + span * 0.2, room.depth + span * 0.45),
      target: new Vector3(0, bottom + H * 0.35, firstZ + (last.z - firstZ) * 0.2),
    },
  }
}

export function eyePosition(seat: Seat) {
  return seat.position.clone().add(new Vector3(0, EYE_HEIGHT, 0))
}

export type SeatView = {
  horizontalAngle: number // degrees the screen fills side to side
  verticalAngle: number // degrees from your eyes up to the top of the screen
  cValue: number | null
  rating: string
}

// How the screen looks from a seat, scored against THX / SMPTE guidance.
export function seatView(layout: TheaterLayout, seat: Seat): SeatView {
  const eye = eyePosition(seat)
  const { width, top, curveDepth } = layout.screen
  const a = new Vector3(-width / 2, eye.y, curveDepth).sub(eye).normalize()
  const b = new Vector3(width / 2, eye.y, curveDepth).sub(eye).normalize()
  const horizontalAngle = (Math.acos(a.dot(b)) * 180) / Math.PI
  const verticalAngle = (Math.atan2(top - eye.y, eye.z) * 180) / Math.PI
  const cValue = layout.rows[seat.rowIndex].cValue

  let rating = 'Great'
  if (verticalAngle > NECK_STRAIN_ANGLE + 10) rating = 'Neck strain'
  else if (verticalAngle > NECK_STRAIN_ANGLE) rating = 'Very close'
  else if (horizontalAngle < SMPTE_MIN_ANGLE) rating = 'Far'
  else if (horizontalAngle < THX_MIN_ANGLE) rating = 'Good'
  else if (Math.abs(eye.x) > width * 0.45) rating = 'Off to the side'
  return { horizontalAngle, verticalAngle, cValue, rating }
}
