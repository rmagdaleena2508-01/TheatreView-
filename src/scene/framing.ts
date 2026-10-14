import { Vector3 } from 'three'
import type { TheaterLayout } from '../layout'

const OVERVIEW_MARGIN = 1.04 // a little breathing room around the room

// Finds the closest camera spot (at a fixed nice angle) where the whole screen and
// every seat fit in view. It measures the real window shape, so a wide laptop and a
// tall phone both get a filled frame instead of one fixed, far-away camera.
// `coveredLeft` is how many pixels of the left side are hidden behind the info panel.
// The camera always stays on the room's centre line, looking straight at the screen,
// so the room never looks turned. When the panel is open, the room is simply framed a
// little smaller so it stays clear of the panel on both sides.
// Camera angle measured down from straight up. Wide windows get a flatter, more
// "standing at the back" view that spreads the room sideways; tall phone screens get
// a steeper, bird's-eye view that stacks the rows up the screen.
export function overviewTilt(aspect: number) {
  const t = Math.min(1, Math.max(0, (aspect - 0.6) / 1.4))
  return ((52 + t * 22) * Math.PI) / 180
}

export function frameOverview(theater: TheaterLayout, fov: number, width: number, height: number, coveredLeft: number) {
  const { screen, rows, seatingWidth } = theater
  const first = rows[0]
  const last = rows[rows.length - 1]
  const halfSeats = seatingWidth / 2 + 0.6
  const halfScreen = screen.width / 2 + 0.3
  const backZ = last.z + theater.venue.rowDepth / 2
  // The points that must be in view: the screen's corners and the seating area's
  // corners (following the sloped floor, so empty space under the back rows is ignored).
  const points = [
    new Vector3(-halfScreen, screen.bottom, 0),
    new Vector3(halfScreen, screen.bottom, 0),
    new Vector3(-halfScreen, screen.top, 0),
    new Vector3(halfScreen, screen.top, 0),
    new Vector3(-halfSeats, first.floorY, first.z - 0.5),
    new Vector3(halfSeats, first.floorY, first.z - 0.5),
    new Vector3(-halfSeats, last.floorY, backZ),
    new Vector3(halfSeats, last.floorY, backZ),
    new Vector3(-halfSeats, last.floorY + 1.2, backZ),
    new Vector3(halfSeats, last.floorY + 1.2, backZ),
  ]
  const target = new Vector3()
  for (const p of points) target.add(p)
  target.multiplyScalar(1 / points.length)

  const usableWidth = Math.max(240, width - 2 * coveredLeft)
  const tilt = overviewTilt(usableWidth / height)
  const toCamera = new Vector3(0, Math.cos(tilt), Math.sin(tilt))
  const forward = toCamera.clone().negate()
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, forward)

  const tanV = Math.tan((fov * Math.PI) / 360)
  const tanH = tanV * (usableWidth / height)

  // Closest distance (for the current target) where every point is inside the frame.
  const fitDistance = () => {
    let d = 0
    for (const p of points) {
      const r = p.clone().sub(target)
      const towardCamera = r.dot(toCamera)
      d = Math.max(d, towardCamera + Math.abs(r.dot(right)) / tanH, towardCamera + Math.abs(r.dot(up)) / tanV)
    }
    return d
  }

  // Near things look bigger than far things, so the room's middle on screen is not
  // its middle in 3D. Nudge the target until the room sits centred in the frame,
  // which lets the camera move in closer.
  let distance = fitDistance()
  for (let i = 0; i < 8; i++) {
    const eye = target.clone().addScaledVector(toCamera, distance)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const p of points) {
      const v = p.clone().sub(eye)
      const depth = v.dot(forward)
      const x = v.dot(right) / (depth * tanH)
      const y = v.dot(up) / (depth * tanV)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    target
      .addScaledVector(right, ((minX + maxX) / 2) * distance * tanH)
      .addScaledVector(up, ((minY + maxY) / 2) * distance * tanV)
    distance = fitDistance()
  }
  distance *= OVERVIEW_MARGIN

  target.x = 0 // dead centre: the screen is square-on to your laptop
  return { position: target.clone().addScaledVector(toCamera, distance), target, distance }
}
