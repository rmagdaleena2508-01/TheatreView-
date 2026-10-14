import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
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

// Compiles every shader in the background while the loading screen is up, then waits
// for two real frames before saying the room is ready. Without this the page sat on a
// black screen while the browser compiled shaders on the first frame.
function SceneReady() {
  const { gl, scene, camera, invalidate } = useThree()
  useEffect(() => {
    let live = true
    const done = () => {
      invalidate()
      requestAnimationFrame(() => requestAnimationFrame(() => live && useTheater.getState().setSceneReady()))
    }
    // Compile hidden things too (e.g. ceiling lights that only show from inside the
    // room), otherwise the browser stalls mid-flight the first time they appear.
    const hidden: { visible: boolean }[] = []
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o)
        o.visible = true
      }
    })
    const restore = () => hidden.forEach((o) => (o.visible = false))
    gl.compileAsync(scene, camera).then(
      () => (restore(), done()),
      () => (restore(), done()),
    )
    return () => {
      live = false
    }
  }, [gl, scene, camera, invalidate])
  return null
}

// Same look as the loading screen in index.html, so the hand-over is invisible.
function LoadingScreen() {
  const ready = useTheater((s) => s.sceneReady)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => setGone(true), 600)
    return () => window.clearTimeout(timer)
  }, [ready])
  if (gone) return null
  return (
    <div className={ready ? 'boot boot-done' : 'boot'} role="status" aria-live="polite">
      <div>
        TheatreView<small>Building the theater…</small>
        <span className="boot-bar" />
      </div>
    </div>
  )
}

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
        onCreated={(state) => {
          if (import.meta.env.DEV) (window as unknown as { __r3f: typeof state }).__r3f = state
        }}
      >
        <color attach="background" args={['#000']} />
        <fog attach="fog" args={['#000', 18, 55]} />
        <Lighting />
        <Theater />
        <Seats key={venueId} />
        <Sightline />
        <CameraRig />
        <SceneReady />
        <EffectComposer>
          <Bloom luminanceThreshold={0.9} intensity={0.9} mipmapBlur />
          <Vignette offset={0.25} darkness={0.75} />
        </EffectComposer>
      </Canvas>
      <Hud />
      <LightCord />
      <LoadingScreen />
    </div>
  )
}
