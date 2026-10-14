import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import {
  Box3,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from 'three'
import { eyePosition } from '../layout'
import { frameOverview } from './framing'
import { useTheater } from '../store'

const { ACTION } = CameraControlsImpl
CameraControlsImpl.install({ THREE: { Box3, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 } })

const HEAD_TURN = 0.75 // radians you can look left/right from a seat
const HEAD_TILT = 0.4 // radians you can look up/down from a seat
const FLY_IN_TIME = 0.36 // seconds-ish for the big flights (into a seat, back out)
const SEAT_HOP_TIME = 0.22 // quick slide when moving from one seat to the next
function panelCover(width: number) {
  const panel = document.querySelector('.venue')
  if (!panel || width < 700) return 0
  return panel.getBoundingClientRect().right + 8
}

export function CameraRig() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const cameraForControls = useThree((s) => s.camera)
  // Our own small wrapper around camera-controls (instead of drei's) so we can cap
  // the time step. The room only draws when something changes, so the first frame
  // after a pause can report several seconds have passed; without the cap the camera
  // would jump straight to the seat instead of flying there.
  const [cc] = useState(() => {
    const c = new CameraControlsImpl(cameraForControls)
    c.smoothTime = FLY_IN_TIME
    c.draggingSmoothTime = 0.15
    return c
  })
  const controls = useRef<CameraControlsImpl>(cc)
  useEffect(() => {
    cc.connect(gl.domElement)
    const wake = () => invalidate()
    const events = ['controlstart', 'control', 'transitionstart', 'update', 'wake'] as const
    events.forEach((e) => cc.addEventListener(e, wake))
    return () => {
      events.forEach((e) => cc.removeEventListener(e, wake))
      cc.disconnect()
    }
  }, [cc, gl, invalidate])
  useFrame((_, delta) => {
    cc.update(Math.min(delta, 1 / 30))
  }, -1)
  const seated = useRef(false) // true once the camera is sitting in a seat
  const mode = useTheater((s) => s.mode)
  const focused = useTheater((s) => s.focused)
  const theater = useTheater((s) => s.theater)
  const panelOpen = useTheater((s) => s.panelOpen)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  // Re-frame the overview when the window or the panel changes, but never move
  // the camera while you are sitting in a seat.
  const frameKey = mode === 'overview' ? `${size.width}x${size.height}:${panelOpen}` : 'seat'

  // Handy for debugging and timing camera moves from the browser console.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __controls: CameraControlsImpl }).__controls = controls.current
  }, [])

  useEffect(() => {
    const c = controls.current
    let cancelled = false

    const unlock = () => {
      c.minAzimuthAngle = -Infinity
      c.maxAzimuthAngle = Infinity
      c.minPolarAngle = 0
      c.maxPolarAngle = Math.PI
      c.minDistance = 0
      c.maxDistance = Infinity
    }

    async function goToSeat() {
      if (!focused) return
      const eye = eyePosition(focused)
      const look = theater.screen.center
      const dir = look.clone().sub(eye).normalize().multiplyScalar(0.01)
      unlock()
      c.mouseButtons.wheel = ACTION.NONE
      c.mouseButtons.right = ACTION.NONE
      c.touches.two = ACTION.NONE
      if (seated.current) {
        // Already sitting: glide straight across to the next seat, eyes on the screen.
        // Camera and its look-at point move together, so it's a quick slide, not a swoop.
        c.smoothTime = SEAT_HOP_TIME
        await c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x, eye.y + dir.y, eye.z + dir.z, true)
      } else {
        // 1) Fly into the seat while looking at the screen.
        c.smoothTime = FLY_IN_TIME
        await c.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, true)
        if (cancelled) return
        // 2) Swap the orbit target to a point just in front of the eyes, so
        //    dragging rotates the head in place instead of orbiting the screen.
        c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x, eye.y + dir.y, eye.z + dir.z, false)
      }
      if (cancelled) return
      seated.current = true
      c.minAzimuthAngle = c.azimuthAngle - HEAD_TURN
      c.maxAzimuthAngle = c.azimuthAngle + HEAD_TURN
      c.minPolarAngle = c.polarAngle - HEAD_TILT
      c.maxPolarAngle = c.polarAngle + HEAD_TILT
    }

    async function goToOverview() {
      seated.current = false
      c.smoothTime = FLY_IN_TIME
      unlock()
      c.mouseButtons.wheel = ACTION.DOLLY
      c.mouseButtons.right = ACTION.TRUCK
      c.touches.two = ACTION.TOUCH_DOLLY_TRUCK
      // Wait a frame so the panel has its final size before we measure it.
      await new Promise((r) => requestAnimationFrame(r))
      if (cancelled) return
      const view = frameOverview(theater, camera.fov, size.width, size.height, panelCover(size.width))
      const { position: p, target: t } = view
      await c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true)
      if (cancelled) return
      c.minDistance = 4
      c.maxDistance = Math.max(theater.room.depth * 2.5, view.distance * 1.6)
      c.maxPolarAngle = Math.PI / 2.1 // never go under the floor
    }

    if (mode === 'pov') goToSeat()
    else goToOverview()
    return () => {
      cancelled = true
    }
  }, [mode, focused, theater, frameKey])

  return null
}
