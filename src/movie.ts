// What is playing on the big screen.
// - youtube: shown with YouTube's own player, placed on the screen in 3D (CSS3D).
//   YouTube does not let other sites read its video pixels, so it cannot be a WebGL texture.
// - file: a direct .mp4 / .webm link, drawn as a real WebGL video texture (needs CORS).
// - stream: an HLS (.m3u8) adaptive stream, also a real WebGL texture. The stream
//   offers several qualities; we play the best one the connection can keep up with.
export type Movie =
  | { kind: 'youtube'; id: string; start: number; url: string }
  | { kind: 'file'; url: string }
  | { kind: 'stream'; url: string }

// A short, stable key so two Movie objects for the same video compare equal.
export function movieKey(movie: Movie | null) {
  if (!movie) return null
  return movie.kind === 'youtube' ? `youtube:${movie.id}` : `${movie.kind}:${movie.url}`
}

const YOUTUBE_ID = /^[\w-]{11}$/

function parseStart(t: string | null) {
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  if (!m) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

// Turns whatever the user pasted into a Movie, or null if we can't play it.
export function parseMovieUrl(input: string): Movie | null {
  const text = input.trim()
  if (!text) return null
  if (YOUTUBE_ID.test(text)) return { kind: 'youtube', id: text, start: 0, url: text }

  let url: URL
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'))
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1, 12)
    return YOUTUBE_ID.test(id) ? { kind: 'youtube', id, start, url: text } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v')
    const fromPath = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1]
    const id = fromQuery ?? fromPath
    return id && YOUTUBE_ID.test(id) ? { kind: 'youtube', id, start, url: text } : null
  }
  if (/\.m3u8$/i.test(url.pathname)) return { kind: 'stream', url: url.href }
  if (/\.(mp4|webm|m4v|mov|ogv)$/i.test(url.pathname)) return { kind: 'file', url: url.href }
  return null
}

export function youtubeEmbedUrl(movie: Extract<Movie, { kind: 'youtube' }>) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1', // browsers only allow autoplay when muted; the Sound button unmutes
    controls: '0',
    playsinline: '1',
    loop: '1',
    playlist: movie.id, // needed for loop to work on a single video
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3', // no video annotations
    disablekb: '1', // keys belong to the theater (arrows move seats), not the player
    fs: '0', // no full-screen button
    enablejsapi: '1',
    start: String(movie.start),
    origin: window.location.origin,
  })
  return `https://www.youtube-nocookie.com/embed/${movie.id}?${params}`
}

// Sends a command to the YouTube player inside the iframe (IFrame Player API over postMessage).
export function youtubeCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
}
