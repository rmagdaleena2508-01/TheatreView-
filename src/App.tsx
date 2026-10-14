import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Theater } from './scene/Theater'
import { Seats } from './scene/Seats'
import { CameraRig } from './scene/CameraRig'
import { Sightline } from './scene/Sightline'
import { Lighting } from './scene/Lighting'
import { Hud } from './ui/Hud'
import { LightCord } from './ui/LightCord'
import { useTheater } from './store'
import { useBookingSync } from './backend/booking'

export default function App() {
  const venueId = useTheater((s) => s.theater.venue.id)
  useBookingSync()
  const start = useTheater.getState().theater.overview.position
  return (
    <div className="app">
      {/* frameloop="demand": draw a new frame only when something changes (camera
          move, light fade, hover). While you just watch the movie, the 3D scene sits
          still and the GPU and main thread are free for the video. */}
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ fov: 50, near: 0.05, far: 400, position: start.toArray() }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#000']} />
        <fog attach="fog" args={['#000', 18, 55]} />
        <Lighting />
        <Theater />
        <Seats key={venueId} />
        <Sightline />
        <CameraRig />
        <EffectComposer>
          <Bloom luminanceThreshold={0.9} intensity={0.9} mipmapBlur />
          <Vignette offset={0.25} darkness={0.75} />
        </EffectComposer>
      </Canvas>
      <Hud />
      <LightCord />
    </div>
  )
}
