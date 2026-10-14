import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BufferGeometry, CanvasTexture, DoubleSide, PlaneGeometry, SRGBColorSpace, VideoTexture } from 'three'
import { youtubeCommand, youtubeEmbedUrl, type Movie } from '../movie'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useTheater } from '../store'
import { FONT_STACK, fontReady } from '../fonts'

RectAreaLightUniformsLib.init()

// Placeholder picture when no movie is loaded: an animated canvas.
function useScreenTexture() {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return { canvas, texture }
  }, [])

  useFrame(({ clock, invalidate }) => {
    invalidate() // the placeholder animates, so keep drawing while it is on screen
    const ctx = canvas.getContext('2d')!
    const t = clock.elapsedTime
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    g.addColorStop(0, `hsl(${(t * 20) % 360}, 70%, 35%)`)
    g.addColorStop(1, `hsl(${(t * 20 + 120) % 360}, 70%, 20%)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `700 72px ${FONT_STACK}`
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

function PlaceholderPicture({ geometry }: { geometry: BufferGeometry }) {
  const map = useScreenTexture()
  return (
    <mesh geometry={geometry}>
      {/* toneMapped off so the screen is bright enough to bloom */}
      <meshBasicMaterial map={map} toneMapped={false} side={DoubleSide} />
    </mesh>
  )
}

// A direct video file (.mp4 / .webm) drawn as a real WebGL texture, so it glows and
// bends with curved screens. The host must allow CORS, or the browser blocks it.
function FilePicture({ geometry, url }: { geometry: BufferGeometry; url: string }) {
  const playing = useTheater((s) => s.moviePlaying)
  const muted = useTheater((s) => s.movieMuted)
  const setMovieError = useTheater((s) => s.setMovieError)

  const { video, texture } = useMemo(() => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = url
    video.loop = true
    video.muted = true
    video.playsInline = true
    const texture = new VideoTexture(video)
    texture.colorSpace = SRGBColorSpace
    return { video, texture }
  }, [url])

  useEffect(() => {
    video.onerror = () => setMovieError("This video file couldn't be loaded. The site may not allow it to be shown here.")
    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      texture.dispose()
    }
  }, [video, texture, setMovieError])

  useEffect(() => {
    if (playing) video.play().catch(() => {})
    else video.pause()
  }, [video, playing])

  useEffect(() => {
    video.muted = muted
  }, [video, muted])

  // A video texture only updates when a frame is drawn, so keep drawing while it plays.
  useFrame(({ invalidate }) => {
    if (playing) invalidate()
  })

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={texture} toneMapped={false} side={DoubleSide} />
    </mesh>
  )
}

// YouTube picks the stream quality from the player's size on the page. A 1080p-sized
// player lets it choose 1080p when the connection allows it.
const YT_WIDTH = 1920
const YT_HEIGHT = 1080
const HTML_PX = 0.025 // drei <Html transform> draws 1 CSS pixel as 0.025 world units

// YouTube does not let other sites read its video pixels, so it can't be a texture.
// Instead the real YouTube player (an iframe) is placed on the screen in 3D with CSS.
// Our rake guarantees every seat sees over the heads in front to the bottom of the
// screen, so drawing the player on top of the canvas looks right from every seat.
function YoutubePicture({
  geometry,
  movie,
  width,
  height,
}: {
  geometry: BufferGeometry
  movie: Extract<Movie, { kind: 'youtube' }>
  width: number
  height: number
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const playing = useTheater((s) => s.moviePlaying)
  const muted = useTheater((s) => s.movieMuted)
  const src = useMemo(() => youtubeEmbedUrl(movie), [movie])
  // Load the YouTube player only after the theater has drawn and the browser is idle,
  // so its ~125 KB of scripts don't compete with the first paint.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    const timer = window.setTimeout(() => idle(() => setReady(true)), 600)
    return () => window.clearTimeout(timer)
  }, [])

  // Fit a 16:9 picture inside the screen, like a real projector would.
  const fitWidth = Math.min(width, (height * YT_WIDTH) / YT_HEIGHT)
  const scale = fitWidth / (YT_WIDTH * HTML_PX)

  const sync = () => {
    const el = iframe.current
    const state = useTheater.getState()
    youtubeCommand(el, state.moviePlaying ? 'playVideo' : 'pauseVideo')
    youtubeCommand(el, state.movieMuted ? 'mute' : 'unMute')
    if (!state.movieMuted) youtubeCommand(el, 'setVolume', [100])
  }

  useEffect(sync, [playing, muted])

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#000" side={DoubleSide} />
      </mesh>
      {ready && <Html transform position-z={0.03} scale={scale} zIndexRange={[1, 0]} pointerEvents="none">
        <iframe
          ref={iframe}
          className="screen-player"
          src={src}
          width={YT_WIDTH}
          height={YT_HEIGHT}
          title="Movie on the cinema screen"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
            sync()
          }}
        />
      </Html>}
    </>
  )
}

function Screen() {
  const { screen } = useTheater((s) => s.theater)
  const movie = useTheater((s) => s.movie)
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
      {movie?.kind === 'youtube' ? (
        <YoutubePicture key={movie.id} geometry={picture} movie={movie} width={screen.width} height={screen.height} />
      ) : movie?.kind === 'file' ? (
        <FilePicture key={movie.url} geometry={picture} url={movie.url} />
      ) : (
        <PlaceholderPicture geometry={picture} />
      )}
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

// Row letters painted onto small canvases in the app font (Inter, bundled with the
// site). This avoids a text library that downloads its own fonts from a CDN.
const letterTextures = new Map<string, CanvasTexture>()

function paintLetter(texture: CanvasTexture, letter: string) {
  const canvas = texture.image as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#6d7280'
  ctx.font = `600 44px ${FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, 32, 34)
  texture.needsUpdate = true
}

function letterTexture(letter: string) {
  let texture = letterTextures.get(letter)
  if (!texture) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    paintLetter(texture, letter)
    letterTextures.set(letter, texture)
  }
  return texture
}

function RowLabels() {
  const { rows, seatingWidth } = useTheater((s) => s.theater)
  const invalidate = useThree((s) => s.invalidate)
  // Repaint the letters in Inter once the font has loaded.
  useEffect(() => {
    let live = true
    fontReady.then(() => {
      if (!live) return
      letterTextures.forEach((texture, letter) => paintLetter(texture, letter))
      invalidate()
    })
    return () => {
      live = false
    }
  }, [invalidate])
  return (
    <group>
      {rows.map((row) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${row.index}${side}`}
            position={[side * (seatingWidth / 2 + 0.5), row.floorY + 0.02, row.z]}
            rotation-x={-Math.PI / 2}
          >
            <planeGeometry args={[0.45, 0.45]} />
            <meshBasicMaterial map={letterTexture(row.letter)} transparent depthWrite={false} />
          </mesh>
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
