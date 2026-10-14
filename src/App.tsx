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

export default function App() {
  const venueId = useTheater((s) => s.theater.venue.id)
  const start = useTheater.getState().theater.overview.position
  return (
    <div className="app">
      <Canvas
        dpr={[1, 2]}
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
