import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import type { Fog, HemisphereLight, MeshStandardMaterial, PointLight, RectAreaLight } from 'three'
import type { TheaterLayout } from '../layout'
import { useTheater } from '../store'

const FADE = 0.6 // seconds for lights to fade, like a cinema dimmer
const SCONCE_STOPS = [0.3, 0.55, 0.8] // fraction of the room depth
const CEILING_STOPS = [0.3, 0.6, 0.88]

function floorAt(theater: TheaterLayout, z: number) {
  let y = 0
  for (const row of theater.rows) if (row.z - theater.venue.rowDepth / 2 <= z) y = row.floorY
  return y
}

// Every light that the house-light level controls. Values are eased toward their
// targets each frame, so changing the level fades the room instead of snapping.
export function Lighting() {
  const theater = useTheater((s) => s.theater)
  const { room } = theater
  const hemi = useRef<HemisphereLight>(null!)
  const sconces = useRef<PointLight[]>([])
  const sconceMats = useRef<MeshStandardMaterial[]>([])
  const ceiling = useRef<RectAreaLight[]>([])
  const ceilingMats = useRef<MeshStandardMaterial[]>([])
  const level = useRef({ current: useTheater.getState().lightLevel })

  const invalidate = useThree((s) => s.invalidate)
  // Start drawing frames again when the light level changes.
  useEffect(() => useTheater.subscribe((s, prev) => s.lightLevel !== prev.lightLevel && invalidate()), [invalidate])

  useFrame(({ gl, scene, invalidate }, delta) => {
    const target = useTheater.getState().lightLevel
    easing.damp(level.current, 'current', target, FADE, delta)
    const l = level.current.current
    if (Math.abs(l - target) > 0.001) invalidate() // keep fading until we arrive

    hemi.current.intensity = 0.2 + l * 2.6
    for (const p of sconces.current) if (p) p.intensity = 2 + l * 14
    for (const m of sconceMats.current) if (m) m.emissiveIntensity = 3 + l * 6
    for (const r of ceiling.current) if (r) r.intensity = l * 35
    for (const m of ceilingMats.current) if (m) m.emissiveIntensity = l * 1.6
    gl.toneMappingExposure = 1 + l * 0.8
    // Fog hides the back rows in the dark; push it away as the lights come up.
    const fog = scene.fog as Fog | null
    if (fog) {
      fog.near = room.depth * (0.8 + l)
      fog.far = room.depth * (2.5 + l * 3)
    }
  })

  const sconceDistance = Math.max(6, room.width * 0.3)

  return (
    <group>
      <hemisphereLight ref={hemi} args={['#8fa4ff', '#1a1a1a', 0.25]} />

      {/* Wall sconces */}
      {SCONCE_STOPS.flatMap((stop, si) =>
        [-1, 1].map((side, i) => {
          const z = room.depth * stop
          const x = side * (room.width / 2 - 0.08)
          const idx = si * 2 + i
          return (
            <group key={`${side}${stop}`} position={[x, floorAt(theater, z) + 3, z]}>
              <mesh>
                <boxGeometry args={[0.1, 0.35, 0.12]} />
                <meshStandardMaterial
                  ref={(m) => {
                    sconceMats.current[idx] = m!
                  }}
                  color="#ffb347"
                  emissive="#ff9a2e"
                  toneMapped={false}
                />
              </mesh>
              <pointLight
                ref={(p) => {
                  sconces.current[idx] = p!
                }}
                color="#ff9a3c"
                distance={sconceDistance}
                decay={2}
                position-x={-side * 0.3}
              />
            </group>
          )
        }),
      )}

      {/* Ceiling house lights: soft panels that wash the seats from above */}
      {CEILING_STOPS.map((stop, i) => (
        <group key={stop} position={[0, room.height - 0.05, room.depth * stop]}>
          <mesh rotation-x={Math.PI / 2}>
            <planeGeometry args={[room.width * 0.6, 1.2]} />
            <meshStandardMaterial
              ref={(m) => {
                ceilingMats.current[i] = m!
              }}
              color="#222"
              emissive="#fff1dc"
              toneMapped={false}
            />
          </mesh>
          <rectAreaLight
            ref={(r) => {
              ceiling.current[i] = r!
            }}
            width={room.width * 0.6}
            height={1.2}
            color="#fff1dc"
            rotation-x={-Math.PI / 2}
          />
        </group>
      ))}
    </group>
  )
}
