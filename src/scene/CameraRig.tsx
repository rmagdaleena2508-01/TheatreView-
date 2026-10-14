import { useEffect, useRef } from 'react'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import { eyePosition } from '../layout'
import { useTheater } from '../store'

const { ACTION } = CameraControlsImpl

const HEAD_TURN = 0.75 // radians you can look left/right from a seat
const HEAD_TILT = 0.4 // radians you can look up/down from a seat

export function CameraRig() {
  const controls = useRef<CameraControlsImpl>(null!)
  const mode = useTheater((s) => s.mode)
  const focused = useTheater((s) => s.focused)
  const theater = useTheater((s) => s.theater)

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
      unlock()
      c.mouseButtons.wheel = ACTION.NONE
      c.mouseButtons.right = ACTION.NONE
      c.touches.two = ACTION.NONE
      // 1) Fly into the seat while looking at the screen.
      await c.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, true)
      if (cancelled) return
      // 2) Swap the orbit target to a point just in front of the eyes, so
      //    dragging rotates the head in place instead of orbiting the screen.
      const dir = look.clone().sub(eye).normalize().multiplyScalar(0.01)
      c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x, eye.y + dir.y, eye.z + dir.z, false)
      c.minAzimuthAngle = c.azimuthAngle - HEAD_TURN
      c.maxAzimuthAngle = c.azimuthAngle + HEAD_TURN
      c.minPolarAngle = c.polarAngle - HEAD_TILT
      c.maxPolarAngle = c.polarAngle + HEAD_TILT
    }

    async function goToOverview() {
      unlock()
      c.mouseButtons.wheel = ACTION.DOLLY
      c.mouseButtons.right = ACTION.TRUCK
      c.touches.two = ACTION.TOUCH_DOLLY_TRUCK
      const { position: p, target: t } = theater.overview
      await c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true)
      if (cancelled) return
      c.minDistance = 4
      c.maxDistance = theater.room.depth * 2.5
      c.maxPolarAngle = Math.PI / 2.1 // never go under the floor
    }

    if (mode === 'pov') goToSeat()
    else goToOverview()
    return () => {
      cancelled = true
    }
  }, [mode, focused, theater])

  return <CameraControls ref={controls} makeDefault smoothTime={0.55} draggingSmoothTime={0.15} />
}
