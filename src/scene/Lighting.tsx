import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import {
  AdditiveBlending,
  BackSide,
  Color,
  CylinderGeometry,
  FrontSide,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  ShaderMaterial,
  type Fog,
  type HemisphereLight,
  type PointLight,
  type RectAreaLight,
} from 'three'
import { AISLE_WIDTH, SIDE_AISLE, type TheaterLayout } from '../layout'
import { useTheater } from '../store'

// Real cinemas light the room in layers (house lights, wall washers, aisle step lights),
// all warm white around 2700-3000 K, all dimmed together before the film starts.
const FADE = 0.6 // seconds for lights to fade, like a cinema dimmer
const WARM = new Color('#ffd7a6') // ~2900 K
const AMBER = new Color('#ffab4d')
const SCONCE_STOPS = [0.3, 0.55, 0.8] // fraction of the room depth
const RECT_STOPS = [0.3, 0.6, 0.88] // invisible area lights that do the actual seat lighting
const DOWNLIGHT_SPACING = 3.6 // meters between ceiling cans
const CAN_RADIUS = 0.17

function floorAt(theater: TheaterLayout, z: number) {
  let y = 0
  for (const row of theater.rows) if (row.z - theater.venue.rowDepth / 2 <= z) y = row.floorY
  return y
}

// A soft "light in the air" material: brightest near the source, fading with distance
// and toward the edges, added on top of the scene. Cheap stand-in for volumetric light.
function beamMaterial() {
  return new ShaderMaterial({
    uniforms: { uColor: { value: WARM.clone() }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFacing;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 viewPos = modelViewMatrix * local;
        vec3 viewNormal = normalize(normalMatrix * n);
        vFacing = abs(dot(viewNormal, normalize(-viewPos.xyz)));
        vAlong = uv.y; // 1 at the ceiling, 0 on the floor
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying float vFacing;
      void main() {
        // clamp first: pow() of a tiny negative number is NaN, and the bloom pass would
        // smear that NaN across the whole picture
        float fall = pow(clamp(vAlong, 0.0, 1.0), 3.5);   // bright just under the lens, gone well above the floor
        float edge = pow(clamp(vFacing, 0.0, 1.0), 3.0);  // very soft sides, no hard outline
        gl_FragColor = vec4(uColor, uOpacity * fall * edge);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide, // one layer only, so overlapping cones don't stack into hard edges
  })
}

// The warm "scallop" a wall sconce paints on the wall above and below it.
function scallopMaterial() {
  return new ShaderMaterial({
    uniforms: { uColor: { value: AMBER.clone() }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        // y = 0 at the fixture, 1 at the far end; the cone widens as it travels.
        float y = abs(vUv.y - 0.5) * 2.0;
        float width = mix(0.18, 0.5, y);
        float x = (vUv.x - 0.5) / width;
        float shape = exp(-x * x * 2.5) * pow(clamp(1.0 - y, 0.0, 1.0), 1.7);
        gl_FragColor = vec4(uColor, uOpacity * shape);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

type Spot = { x: number; z: number; floor: number }

// Every light that the house-light level controls. Values are eased toward their
// targets each frame, so changing the level fades the room instead of snapping.
export function Lighting() {
  const theater = useTheater((s) => s.theater)
  const { room, rows, seatingWidth, venue } = theater
  const hemi = useRef<HemisphereLight>(null!)
  const sconces = useRef<PointLight[]>([])
  const area = useRef<RectAreaLight[]>([])
  const lensMat = useRef<MeshBasicMaterial>(null!)
  const stepMat = useRef<MeshBasicMaterial>(null!)
  const cans = useRef<InstancedMesh>(null!)
  const lenses = useRef<InstancedMesh>(null!)
  const beams = useRef<InstancedMesh>(null!)
  const steps = useRef<InstancedMesh>(null!)
  const level = useRef({ current: useTheater.getState().lightLevel })
  const beam = useMemo(beamMaterial, [])
  const scallop = useMemo(scallopMaterial, [])
  // One shared material for every sconce, so they all dim together.
  const sconceMat = useMemo(() => new MeshBasicMaterial({ color: AMBER, toneMapped: false }), [])

  const invalidate = useThree((s) => s.invalidate)
  // Start drawing frames again when the light level changes.
  useEffect(() => useTheater.subscribe((s, prev) => s.lightLevel !== prev.lightLevel && invalidate()), [invalidate])

  // A grid of recessed downlights over the seating, like a real auditorium ceiling.
  const downlights = useMemo<Spot[]>(() => {
    const cols = Math.max(2, Math.round(room.width / DOWNLIGHT_SPACING))
    const spots: Spot[] = []
    for (let z = rows[0].z - 1.5; z < room.depth - 1; z += DOWNLIGHT_SPACING) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols - 0.5) * (room.width - 2)
        spots.push({ x, z, floor: floorAt(theater, z) })
      }
    }
    return spots
  }, [theater, room, rows])

  // Small amber step lights on each riser along every aisle, so you can find your
  // way in the dark. They stay on, dimly, even during the movie.
  const stepLights = useMemo(() => {
    const blockWidth = venue.seatsPerBlock * venue.seatWidth
    const aisleXs: number[] = [seatingWidth / 2 + SIDE_AISLE / 2, -(seatingWidth / 2 + SIDE_AISLE / 2)]
    for (let b = 0; b < venue.blocks - 1; b++) {
      aisleXs.push(-seatingWidth / 2 + (b + 1) * blockWidth + b * AISLE_WIDTH + AISLE_WIDTH / 2)
    }
    const lights: { x: number; y: number; z: number }[] = []
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].floorY - rows[i - 1].floorY < 0.05) continue // no riser, no step light
      for (const x of aisleXs) {
        lights.push({ x, y: rows[i - 1].floorY + 0.06, z: rows[i].z - venue.rowDepth / 2 - 0.006 })
      }
    }
    return lights
  }, [rows, seatingWidth, venue])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    downlights.forEach((d, i) => {
      dummy.position.set(d.x, room.height - 0.06, d.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      cans.current.setMatrixAt(i, dummy.matrix)
      dummy.position.y = room.height - 0.135
      dummy.rotation.x = Math.PI / 2
      dummy.updateMatrix()
      lenses.current.setMatrixAt(i, dummy.matrix)
      // Beam: a widening cone from the can down to the floor.
      const length = room.height - 0.14 - d.floor
      dummy.position.set(d.x, room.height - 0.14 - length / 2, d.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, length, 1)
      dummy.updateMatrix()
      beams.current.setMatrixAt(i, dummy.matrix)
    })
    for (const m of [cans.current, lenses.current, beams.current]) {
      m.count = downlights.length
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
    stepLights.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      steps.current.setMatrixAt(i, dummy.matrix)
    })
    steps.current.count = stepLights.length
    steps.current.instanceMatrix.needsUpdate = true
    steps.current.computeBoundingSphere()
    invalidate()
  }, [downlights, stepLights, room, invalidate])

  // One unit-tall truncated cone; each instance is stretched to reach the floor.
  const beamGeometry = useMemo(() => new CylinderGeometry(CAN_RADIUS * 0.9, 1.1, 1, 32, 1, true), [])

  useFrame(({ gl, scene, camera, invalidate }, delta) => {
    // The ceiling is see-through from above (overview). The lenses face down, so they
    // vanish on their own from up there; the light cones are faded out. (Hiding the
    // objects instead made the browser stall the moment the camera entered the room.)
    const inside = camera.position.y < room.height

    const target = useTheater.getState().lightLevel
    easing.damp(level.current, 'current', target, FADE, delta)
    const l = level.current.current
    if (Math.abs(l - target) > 0.001) invalidate() // keep fading until we arrive

    hemi.current.intensity = 0.2 + l * 2.6
    for (const r of area.current) if (r) r.intensity = l * 32
    for (const p of sconces.current) if (p) p.intensity = 1.5 + l * 12
    // Lens brightness above the bloom threshold only when the lights are on.
    lensMat.current.color.copy(WARM).multiplyScalar(0.05 + l * 2.4)
    sconceMat.color.copy(AMBER).multiplyScalar(0.6 + l * 2.2)
    stepMat.current.color.copy(AMBER).multiplyScalar(1.2 + l * 0.6)
    beam.uniforms.uOpacity.value = inside ? l * 0.05 : 0 // cinemas keep the air clear, so beams are faint
    scallop.uniforms.uOpacity.value = 0.25 + l * 0.6
    gl.toneMappingExposure = 1 + l * 0.8
    // Fog hides the back rows in the dark; push it away as the lights come up.
    const fog = scene.fog as Fog | null
    if (fog) {
      fog.near = room.depth * (0.8 + l)
      fog.far = room.depth * (2.5 + l * 3)
    }
  })

  const sconceDistance = Math.max(6, room.width * 0.3)
  const maxDownlights = 400

  return (
    <group>
      <hemisphereLight ref={hemi} args={['#8fa4ff', '#1a1a1a', 0.25]} />

      {/* Ceiling, only visible from inside: it faces down, so the overview camera
          above the room looks straight through it. */}
      <mesh position={[0, room.height, room.depth / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[room.width, room.depth + 1]} />
        <meshStandardMaterial color="#0c0c0f" roughness={1} side={FrontSide} />
      </mesh>

      {/* Recessed downlights: dark metal can, glowing lens, soft cone of light. */}
      <instancedMesh ref={cans} args={[undefined, undefined, maxDownlights]}>
        <cylinderGeometry args={[CAN_RADIUS + 0.03, CAN_RADIUS + 0.03, 0.12, 24, 1, true]} />
        <meshStandardMaterial color="#1b1b20" metalness={0.6} roughness={0.4} side={BackSide} />
      </instancedMesh>
      <instancedMesh ref={lenses} args={[undefined, undefined, maxDownlights]}>
        <circleGeometry args={[CAN_RADIUS, 24]} />
        <meshBasicMaterial ref={lensMat} toneMapped={false} side={FrontSide} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[beamGeometry, beam, maxDownlights]} frustumCulled={false} />

      {/* These do the real lighting on the seats. RectAreaLights are physically based
          soft lights; a few of them light the room much more cheaply than one real
          spotlight per downlight would. */}
      {RECT_STOPS.map((stop, i) => (
        <rectAreaLight
          key={stop}
          ref={(r) => {
            area.current[i] = r!
          }}
          position={[0, room.height - 0.2, room.depth * stop]}
          width={room.width * 0.7}
          height={2.4}
          color={WARM}
          rotation-x={-Math.PI / 2}
        />
      ))}

      {/* Wall sconces: a glowing cylinder that washes the wall above and below it. */}
      {SCONCE_STOPS.flatMap((stop, si) =>
        [-1, 1].map((side, i) => {
          const z = room.depth * stop
          const x = side * (room.width / 2 - 0.06)
          const idx = si * 2 + i
          return (
            <group key={`${side}${stop}`} position={[x, floorAt(theater, z) + 3, z]}>
              <mesh material={sconceMat}>
                <cylinderGeometry args={[0.065, 0.065, 0.42, 20]} />
              </mesh>
              {/* Light scallop painted on the wall: up and down from the fixture. */}
              <mesh position-x={side * 0.055} rotation-y={-side * (Math.PI / 2)} material={scallop}>
                <planeGeometry args={[1.6, 4.2]} />
              </mesh>
              <pointLight
                ref={(p) => {
                  sconces.current[idx] = p!
                }}
                color={AMBER}
                distance={sconceDistance}
                decay={2}
                position-x={-side * 0.3}
              />
            </group>
          )
        }),
      )}

      {/* Aisle step lights. */}
      <instancedMesh ref={steps} args={[undefined, undefined, 600]}>
        <boxGeometry args={[0.32, 0.035, 0.01]} />
        <meshBasicMaterial ref={stepMat} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
