// The movies the audience can pick under "Now showing".
// - Spider-Man clips play from YouTube, in YouTube's own player. That is the only way
//   we are allowed to show them. YouTube picks their quality.
// - The free Blender films (CC BY) play as HLS streams drawn straight onto the 3D screen,
//   so they get full quality, no YouTube buttons, and glow with the room.
// YouTube titles were checked with YouTube's oEmbed endpoint on 2026-10-14.

export type CatalogMovie = {
  id: string // our own id; also stored on each showtime in the database
  film: string // the movie it belongs to, used to group the list
  label: string // what this clip is
  url: string // a YouTube link or an .m3u8 stream
  channel: string // who publishes it
}

export const CATALOG: CatalogMovie[] = [
  {
    id: 'nwh-trailer',
    film: 'Spider-Man: No Way Home',
    label: 'Official trailer',
    url: 'https://www.youtube.com/watch?v=JfVOs4VSpmA',
    channel: 'Sony Pictures Entertainment',
  },
  {
    id: 'nwh-highway',
    film: 'Spider-Man: No Way Home',
    label: 'Scene: Peter fights Doc Ock on the highway',
    url: 'https://www.youtube.com/watch?v=ioeoCbDiMvE',
    channel: 'Scene City',
  },
  {
    id: 'bnd-trailer',
    film: 'Spider-Man: Brand New Day',
    label: 'Official trailer',
    url: 'https://www.youtube.com/watch?v=8TZMtslA3UY',
    channel: 'Spider-Man',
  },
  {
    id: 'bnd-opening',
    film: 'Spider-Man: Brand New Day',
    label: 'Scene: Opening montage packed with villains',
    url: 'https://www.youtube.com/watch?v=rHwcullonlY',
    channel: 'Scene City',
  },
  {
    id: 'bnd-hand',
    film: 'Spider-Man: Brand New Day',
    label: 'Scene: Spider-Man vs The Hand',
    url: 'https://www.youtube.com/watch?v=xkFXXxaCitU',
    channel: 'Movie Base',
  },
  {
    id: 'big-buck-bunny',
    film: 'More movies',
    label: 'Big Buck Bunny (1080p stream)',
    // Mux's public test stream of the Blender film, 320p up to 1080p.
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    channel: 'Blender Foundation, streamed by Mux',
  },
  {
    id: 'sintel',
    film: 'More movies',
    label: 'Sintel',
    url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
    channel: 'Blender',
  },
  {
    id: 'tears-of-steel',
    film: 'More movies',
    label: 'Tears of Steel (stream)',
    // Unified Streaming's public demo stream of the Blender film, up to 1680x750.
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    channel: 'Blender Foundation, streamed by Unified Streaming',
  },
]

export const DEFAULT_CATALOG_MOVIE = CATALOG[0]

export function catalogUrl(movie: CatalogMovie) {
  return movie.url
}

// Groups the catalog by film, keeping the order above.
export function catalogByFilm() {
  const groups: { film: string; movies: CatalogMovie[] }[] = []
  for (const movie of CATALOG) {
    let group = groups.find((g) => g.film === movie.film)
    if (!group) groups.push((group = { film: movie.film, movies: [] }))
    group.movies.push(movie)
  }
  return groups
}
