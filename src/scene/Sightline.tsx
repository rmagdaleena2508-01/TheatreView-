import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { Vector3 } from 'three'
import { eyePosition } from '../layout'
import { useTheater } from '../store'

// Dashed line from the seat's eyes to the screen, plus a ring where it lands.
export function Sightline() {
  const seat = useTheater((s) => s.hovered ?? s.focused)
  const mode = useTheater((s) => s.mode)
  const center = useTheater((s) => s.theater.screen.center)

  const points = useMemo(() => {
    if (!seat) return null
    return [eyePosition(seat), center.clone().add(new Vector3(0, 0, 0.03))] as [Vector3, Vector3]
  }, [seat, center])

  if (!points || mode === 'pov') return null
  return (
    <group>
      <Line points={points} color="#5fd4ff" lineWidth={1.5} dashed dashSize={0.25} gapSize={0.18} transparent opacity={0.8} />
      <mesh position={points[0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#5fd4ff" toneMapped={false} />
      </mesh>
      <mesh position={points[1]}>
        <ringGeometry args={[0.32, 0.4, 48]} />
        <meshBasicMaterial color="#5fd4ff" toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}
