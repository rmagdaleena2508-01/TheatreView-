// Real cinemas the room can be rebuilt as. Screen sizes are the published figures
// (see docs/CINEMA_RESEARCH.md for sources). Room depth, rake and row count are not
// published by any venue, so they are derived from cinema design standards in
// buildTheater() below.

export type Venue = {
  id: string
  name: string
  city: string
  format: string
  screen: {
    width: number // meters
    height: number // meters
    aspect: string
    curveRatio: number // chord width : curve depth. 0 = flat. Dolby patent suggests ~20:1
    curveNote: string
  }
  screenBottom: number // meters above the front-row floor
  rows: number // upper bound; fewer rows are used if the THX last-row rule says so
  blocks: number // seat blocks across the room, separated by aisles
  seatsPerBlock: number
  rowDepth: number // meters front-to-back per row (recliners need more)
  seatWidth: number
  cValue: number // sightline clearance target over the head in front, meters
  maxVerticalAngle: number // degrees from front-row eyes to the top of the screen
  seatsNote: string
}

export const VENUES: Venue[] = [
  {
    id: 'multiplex',
    name: 'Standard multiplex',
    city: 'Typical DCI scope auditorium',
    format: 'DCI Scope',
    screen: { width: 14, height: 5.86, aspect: '2.39:1', curveRatio: 0, curveNote: 'Flat' },
    screenBottom: 1.0,
    rows: 12,
    blocks: 2,
    seatsPerBlock: 9,
    rowDepth: 1.1,
    seatWidth: 0.58,
    cValue: 0.12,
    maxVerticalAngle: 35,
    seatsNote: 'about 200 seats',
  },
  {
    id: 'dolby',
    name: 'Dolby Cinema',
    city: 'Premium large format',
    format: 'Dolby Vision laser',
    screen: {
      width: 22.86,
      height: 12.34,
      aspect: '1.85:1',
      curveRatio: 20,
      curveNote: 'Curved, about 20:1 width to depth, wall to wall',
    },
    screenBottom: 0.9,
    rows: 10,
    blocks: 2,
    seatsPerBlock: 10,
    rowDepth: 1.6,
    seatWidth: 0.78,
    cValue: 0.15,
    maxVerticalAngle: 40,
    seatsNote: 'recliners, about 200 seats',
  },
  {
    id: 'bfi',
    name: 'BFI IMAX',
    city: 'London, UK',
    format: 'IMAX 70mm + laser',
    screen: { width: 25.9, height: 19.8, aspect: '1.43:1 (approx.)', curveRatio: 60, curveNote: 'Near flat' },
    screenBottom: 0.6,
    rows: 16,
    blocks: 3,
    seatsPerBlock: 10,
    rowDepth: 1.0,
    seatWidth: 0.55,
    cValue: 0.15,
    maxVerticalAngle: 55,
    seatsNote: 'about 480 seats (layout approximated)',
  },
  {
    id: 'tcl',
    name: 'TCL Chinese Theatre IMAX',
    city: 'Hollywood, USA',
    format: 'IMAX laser',
    screen: { width: 28.65, height: 14.02, aspect: '2.04:1', curveRatio: 25, curveNote: 'Curved, maskable' },
    screenBottom: 0.9,
    rows: 21,
    blocks: 3,
    seatsPerBlock: 15,
    rowDepth: 1.0,
    seatWidth: 0.55,
    cValue: 0.12,
    maxVerticalAngle: 40,
    seatsNote: '932 seats, largest IMAX by capacity',
  },
  {
    id: 'melbourne',
    name: 'IMAX Melbourne',
    city: 'Melbourne, Australia',
    format: 'IMAX 1.43:1',
    screen: { width: 32, height: 23, aspect: '1.43:1', curveRatio: 60, curveNote: 'Near flat' },
    screenBottom: 0.6,
    rows: 18,
    blocks: 3,
    seatsPerBlock: 12,
    rowDepth: 1.0,
    seatWidth: 0.55,
    cValue: 0.15,
    maxVerticalAngle: 55,
    seatsNote: 'layout approximated',
  },
  {
    id: 'leonberg',
    name: 'Traumpalast IMAX',
    city: 'Leonberg, Germany',
    format: 'IMAX laser',
    screen: {
      width: 38.8,
      height: 21.0,
      aspect: '1.85:1',
      curveRatio: 40,
      curveNote: 'Slight curve (assumed)',
    },
    screenBottom: 0.8,
    rows: 20,
    blocks: 3,
    seatsPerBlock: 14,
    rowDepth: 1.05,
    seatWidth: 0.56,
    cValue: 0.15,
    maxVerticalAngle: 50,
    seatsNote: 'world record screen, layout approximated',
  },
]

export const DEFAULT_VENUE = VENUES[0]
