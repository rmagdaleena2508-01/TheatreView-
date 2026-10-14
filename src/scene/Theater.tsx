import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { BufferGeometry, CanvasTexture, DoubleSide, PlaneGeometry, Scene, SRGBColorSpace, Vector3, VideoTexture } from 'three'
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

// A video we can draw ourselves: a direct file (.mp4 / .webm) or an HLS stream (.m3u8).
// It becomes a real WebGL texture, so it is sharp, glows, and bends with curved screens.
// The host must allow CORS, or the browser refuses to hand the pixels to WebGL.
// Same arc as the screen, but only `width` wide, so a narrower picture sits exactly
// on the curved screen surface.
function fittedPicture(screenWidth: number, screenDepth: number, width: number, height: number) {
  if (screenDepth <= 0) return curvedPlane(width, height, 0)
  const half = screenWidth / 2
  const radius = (screenDepth * screenDepth + half * half) / (2 * screenDepth)
  return curvedPlane(width, height, radius - Math.sqrt(radius * radius - (width / 2) ** 2))
}

function VideoPicture({
  geometry,
  url,
  stream,
  width,
  height,
  curveDepth,
}: {
  geometry: BufferGeometry
  url: string
  stream: boolean
  width: number
  height: number
  curveDepth: number
}) {
  const playing = useTheater((s) => s.moviePlaying)
  const muted = useTheater((s) => s.movieMuted)
  const invalidate = useThree((s) => s.invalidate)
  // Made inside the effect (not during render) so every mount gets its own video and
  // texture, and unmounting cleans up exactly what it made.
  const [media, setMedia] = useState<{ video: HTMLVideoElement; texture: VideoTexture } | null>(null)
  const [aspect, setAspect] = useState(16 / 9)
  // Fit the film inside the screen without stretching, like a real projector: black
  // bars at the sides (or top and bottom) where the film doesn't reach.
  const fitted = useMemo(() => {
    const fitWidth = Math.min(width, height * aspect)
    return fittedPicture(width, curveDepth, fitWidth, fitWidth / aspect)
  }, [width, height, curveDepth, aspect])

  useEffect(() => {
    const { setMovieError, setMovieQuality } = useTheater.getState()
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = useTheater.getState().movieMuted
    video.playsInline = true
    // Some browsers only decode new frames for a video that is on the page, so keep it
    // in the page but invisible. The 3D screen shows it through the texture.
    video.setAttribute('aria-hidden', 'true')
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
    document.body.appendChild(video)
    const texture = new VideoTexture(video)
    texture.colorSpace = SRGBColorSpace

    let destroyed = false
    let hls: { destroy: () => void } | null = null
    video.onerror = () => setMovieError("This video couldn't be loaded. The site may not allow it to be shown here.")
    video.onloadedmetadata = () => {
      if (!hls) setMovieQuality(`${video.videoHeight}p`)
    }
    video.onresize = () => {
      if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight)
    }
    // The source arrives a moment after the element is made (hls.js loads first), so
    // start playing as soon as there is something to play.
    video.oncanplay = () => {
      if (useTheater.getState().moviePlaying && video.paused) video.play().catch(() => {})
    }

    if (stream) {
      // Use hls.js wherever it works (it lets us start at the best quality). Newer Chrome
      // and Safari can also play HLS by themselves, but then they start blurry and climb
      // slowly, so that is only the fallback (e.g. iPhones without Media Source support).
      // hls.js/light: the same player without subtitles and alternate audio, much smaller.
      import('hls.js/light').then(({ default: Hls }) => {
        if (destroyed) return
        if (!Hls.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = url
          else setMovieError("This browser can't play HLS streams.")
          return
        }
        const player = new Hls({
          capLevelToPlayerSize: false, // the screen is huge in the 3D room; don't cap by element size
          abrEwmaDefaultEstimate: 8_000_000, // assume a good connection (8 Mbps) until measured
          maxBufferLength: 30, // keep 30 s ahead so short network hiccups don't stall the movie
        })
        hls = player
        // Start straight at the best quality. hls.js still steps down by itself if the
        // connection can't keep up, but most people never see a blurry first minute.
        player.on(Hls.Events.MANIFEST_PARSED, () => {
          player.startLevel = player.levels.length - 1
        })
        player.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          const level = player.levels[data.level]
          if (level) setMovieQuality(`${level.height}p`)
        })
        player.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setMovieError('The stream stopped loading. Try another movie.')
        })
        player.loadSource(url)
        player.attachMedia(video)
      })
    } else {
      video.src = url
    }

    // Draw a new 3D frame only when the video has a new picture (24-30 times a second),
    // instead of redrawing the whole room at full speed.
    const hasFrameCallback = 'requestVideoFrameCallback' in video
    let frameRequest = 0
    const onFrame = () => {
      invalidate()
      frameRequest = video.requestVideoFrameCallback(onFrame)
    }
    if (hasFrameCallback) frameRequest = video.requestVideoFrameCallback(onFrame)

    setMedia({ video, texture })
    return () => {
      destroyed = true
      if (hasFrameCallback) video.cancelVideoFrameCallback(frameRequest)
      hls?.destroy()
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      texture.dispose()
      setMedia(null)
    }
  }, [url, stream, invalidate])

  useEffect(() => {
    if (!media) return
    if (playing) media.video.play().catch(() => {})
    else media.video.pause()
  }, [media, playing])

  useEffect(() => {
    if (media) media.video.muted = muted
  }, [media, muted])

  // Older browsers without requestVideoFrameCallback: keep drawing while it plays.
  useFrame(({ invalidate }) => {
    if (playing && media && !('requestVideoFrameCallback' in media.video)) invalidate()
  })

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#000" side={DoubleSide} />
      </mesh>
      {media && (
        <mesh geometry={fitted} position-z={0.005}>
          <meshBasicMaterial key={media.texture.uuid} map={media.texture} toneMapped={false} side={DoubleSide} />
        </mesh>
      )}
    </>
  )
}

// YouTube picks the stream quality from the player's layout size times the screen's
// pixel density, so 1280x720 already allows 1080p+ on retina laptops. A bigger player
// made every camera move repaint a much larger layer and felt sluggish.
const YT_WIDTH = 1280
const YT_HEIGHT = 720

// YouTube does not let other sites read its video pixels, so it can't be a texture.
// Instead the real YouTube player (an iframe) is placed on the screen in 3D with CSS,
// the way the official three.js "CSS3D YouTube" example does it. CSS3DRenderer only
// touches the page when the camera actually moved, so hovering seats (which redraws
// the 3D room) no longer makes the browser re-place the video layer every frame.
// Our rake guarantees every seat sees over the heads in front to the bottom of the
// screen, so drawing the player on top of the canvas looks right from every seat.
function YoutubePicture({
  geometry,
  movie,
  width,
  height,
  center,
}: {
  geometry: BufferGeometry
  movie: Extract<Movie, { kind: 'youtube' }>
  width: number
  height: number
  center: Vector3
}) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const playing = useTheater((s) => s.moviePlaying)
  const muted = useTheater((s) => s.movieMuted)
  const [layer] = useState(() => {
    const renderer = new CSS3DRenderer()
    renderer.domElement.className = 'screen-layer'
    return { renderer, scene: new Scene() }
  })
  const iframe = useRef<HTMLIFrameElement | null>(null)

  const sync = () => {
    const el = iframe.current
    const state = useTheater.getState()
    youtubeCommand(el, state.moviePlaying ? 'playVideo' : 'pauseVideo')
    youtubeCommand(el, state.movieMuted ? 'mute' : 'unMute')
    if (!state.movieMuted) youtubeCommand(el, 'setVolume', [100])
  }

  // The layer sits on top of the 3D canvas, under the buttons.
  useEffect(() => {
    const host = gl.domElement.parentElement!
    host.appendChild(layer.renderer.domElement)
    return () => layer.renderer.domElement.remove()
  }, [gl, layer])

  useEffect(() => {
    layer.renderer.setSize(size.width, size.height)
    invalidate()
  }, [layer, size, invalidate])

  // Build the player. It loads only after the theater has drawn and the browser is
  // idle, so its ~125 KB of scripts don't compete with the first paint.
  useEffect(() => {
    const el = document.createElement('iframe')
    el.className = 'screen-player'
    el.width = String(YT_WIDTH)
    el.height = String(YT_HEIGHT)
    el.title = 'Movie on the cinema screen'
    el.allow = 'autoplay; encrypted-media; picture-in-picture'
    el.referrerPolicy = 'strict-origin-when-cross-origin'
    el.onload = () => {
      el.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
      sync()
    }
    iframe.current = el
    // Fit a 16:9 picture inside the screen, like a real projector would.
    const fitWidth = Math.min(width, (height * YT_WIDTH) / YT_HEIGHT)
    const object = new CSS3DObject(el)
    object.position.set(center.x, center.y, center.z + 0.03)
    object.scale.setScalar(fitWidth / YT_WIDTH)
    layer.scene.add(object)
    invalidate()

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    const timer = window.setTimeout(() => idle(() => (el.src = youtubeEmbedUrl(movie))), 600)
    return () => {
      window.clearTimeout(timer)
      layer.scene.remove(object)
      el.remove()
      iframe.current = null
    }
  }, [movie, width, height, center, layer, invalidate])

  useEffect(sync, [playing, muted])

  // Runs only on frames the 3D room draws (camera moves, hovers, light fades).
  useFrame(({ camera }) => layer.renderer.render(layer.scene, camera))

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="#000" side={DoubleSide} />
    </mesh>
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
        <YoutubePicture
          key={movie.id}
          geometry={picture}
          movie={movie}
          width={screen.width}
          height={screen.height}
          center={screen.center}
        />
      ) : movie?.kind === 'file' || movie?.kind === 'stream' ? (
        <VideoPicture
          key={movie.url}
          geometry={picture}
          url={movie.url}
          stream={movie.kind === 'stream'}
          width={screen.width}
          height={screen.height}
          curveDepth={screen.curveDepth}
        />
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
