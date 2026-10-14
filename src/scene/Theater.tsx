import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { CanvasTexture, DoubleSide, PlaneGeometry, SRGBColorSpace } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useTheater } from '../store'

RectAreaLightUniformsLib.init()

// Placeholder "movie": an animated canvas. Phase 2 swaps this for a real video.
function useScreenTexture() {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return { canvas, texture }
  }, [])

  useFrame(({ clock }) => {
    const ctx = canvas.getContext('2d')!
    const t = clock.elapsedTime
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    g.addColorStop(0, `hsl(${(t * 20) % 360}, 70%, 35%)`)
    g.addColorStop(1, `hsl(${(t * 20 + 120) % 360}, 70%, 20%)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 72px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('NOW SHOWING', canvas.width / 2, canvas.height / 2 + 24)
    texture.needsUpdate = true
  })

  return texture
}

// A plane bent into a circular arc, concave toward the audience. The edges come
// forward by `depth` meters (the sagitta); depth 0 gives a flat screen.
function curvedPlane(width: number, height: number, depth: number) {
  const geo = new PlaneGeometry(width, height, depth > 0 ? 96 : 1, 1)
  if (depth > 0) {
    const half = width / 2
    const radius = (depth * depth + half * half) / (2 * depth)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      pos.setZ(i, radius - Math.sqrt(radius * radius - x * x))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }
  return geo
}

function Screen() {
  const map = useScreenTexture()
  const { screen } = useTheater((s) => s.theater)
  const picture = useMemo(() => curvedPlane(screen.width, screen.height, screen.curveDepth), [screen])
  const frame = useMemo(
    () => curvedPlane(screen.width + 0.6, screen.height + 0.6, screen.curveDepth * 1.02),
    [screen],
  )
  return (
    <group position={screen.center}>
      <mesh geometry={frame} position-z={-0.06}>
        <meshStandardMaterial color="#050505" side={DoubleSide} />
      </mesh>
      <mesh geometry={picture}>
        {/* toneMapped off so the screen is bright enough to bloom */}
        <meshBasicMaterial map={map} toneMapped={false} side={DoubleSide} />
      </mesh>
      {/* Light that the screen throws onto the seats */}
      <rectAreaLight
        position-z={screen.curveDepth / 2 + 0.2}
        width={screen.width}
        height={screen.height}
        intensity={2.2}
        color="#bcd2ff"
        rotation-y={Math.PI}
      />
    </group>
  )
}

// Stepped floor: one block per row, raised by the rake computed in buildTheater().
function Floor() {
  const { rows, room, venue } = useTheater((s) => s.theater)
  const last = rows[rows.length - 1]
  const backDepth = room.depth - last.z
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, room.depth / 2]}>
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial color="#0b0b0e" roughness={1} />
      </mesh>
      {rows.slice(1).map((row) => (
        <mesh key={row.index} position={[0, row.floorY / 2, row.z]}>
          <boxGeometry args={[room.width - 0.2, row.floorY + 0.001, venue.rowDepth]} />
          <meshStandardMaterial color="#121217" roughness={0.95} />
        </mesh>
      ))}
      {/* Back landing so the last row doesn't float */}
      <mesh position={[0, last.floorY / 2, last.z + venue.rowDepth / 2 + backDepth / 2]}>
        <boxGeometry args={[room.width - 0.2, last.floorY + 0.001, backDepth]} />
        <meshStandardMaterial color="#121217" roughness={0.95} />
      </mesh>
    </group>
  )
}

function Walls() {
  const { room } = useTheater((s) => s.theater)
  const wallMat = <meshStandardMaterial color="#0d0d11" roughness={1} side={DoubleSide} />
  return (
    <group>
      <mesh position={[-room.width / 2, room.height / 2, room.depth / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[room.depth, room.height]} />
        {wallMat}
      </mesh>
      <mesh position={[room.width / 2, room.height / 2, room.depth / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[room.depth, room.height]} />
        {wallMat}
      </mesh>
      <mesh position={[0, room.height / 2, -0.3]}>
        <planeGeometry args={[room.width, room.height]} />
        {wallMat}
      </mesh>
    </group>
  )
}

function RowLabels() {
  const { rows, seatingWidth } = useTheater((s) => s.theater)
  return (
    <group>
      {rows.map((row) =>
        [-1, 1].map((side) => (
          <Text
            key={`${row.index}${side}`}
            position={[side * (seatingWidth / 2 + 0.5), row.floorY + 0.02, row.z]}
            rotation-x={-Math.PI / 2}
            fontSize={0.32}
            color="#6d7280"
          >
            {row.letter}
          </Text>
        )),
      )}
    </group>
  )
}

export function Theater() {
  return (
    <group>
      <Screen />
      <Floor />
      <Walls />
      <RowLabels />
    </group>
  )
}
