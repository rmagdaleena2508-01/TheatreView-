// The movies the audience can pick under "Now showing". Each one is a YouTube
// video played with YouTube's own player. Titles were checked with YouTube's
// oEmbed endpoint on 2026-10-14.

export type CatalogMovie = {
  id: string // our own id; also stored on each showtime in the database
  film: string // the movie it belongs to, used to group the list
  label: string // what this clip is
  youtubeId: string
  channel: string
}

export const CATALOG: CatalogMovie[] = [
  {
    id: 'nwh-trailer',
    film: 'Spider-Man: No Way Home',
    label: 'Official trailer',
    youtubeId: 'JfVOs4VSpmA',
    channel: 'Sony Pictures Entertainment',
  },
  {
    id: 'nwh-highway',
    film: 'Spider-Man: No Way Home',
    label: 'Scene: Peter fights Doc Ock on the highway',
    youtubeId: 'ioeoCbDiMvE',
    channel: 'Scene City',
  },
  {
    id: 'bnd-trailer',
    film: 'Spider-Man: Brand New Day',
    label: 'Official trailer',
    youtubeId: '8TZMtslA3UY',
    channel: 'Spider-Man',
  },
  {
    id: 'bnd-opening',
    film: 'Spider-Man: Brand New Day',
    label: 'Scene: Opening montage packed with villains',
    youtubeId: 'rHwcullonlY',
    channel: 'Scene City',
  },
  {
    id: 'bnd-hand',
    film: 'Spider-Man: Brand New Day',
    label: 'Scene: Spider-Man vs The Hand',
    youtubeId: 'xkFXXxaCitU',
    channel: 'Movie Base',
  },
  {
    id: 'big-buck-bunny',
    film: 'More movies',
    label: 'Big Buck Bunny',
    youtubeId: 'aqz-KE-bpKQ',
    channel: 'Blender',
  },
  {
    id: 'sintel',
    film: 'More movies',
    label: 'Sintel',
    youtubeId: 'eRsGyueVLvQ',
    channel: 'Blender',
  },
  {
    id: 'tears-of-steel',
    film: 'More movies',
    label: 'Tears of Steel',
    youtubeId: 'R6MlUcmOul8',
    channel: 'Blender',
  },
]

export const DEFAULT_CATALOG_MOVIE = CATALOG[0]

export function catalogUrl(movie: CatalogMovie) {
  return `https://www.youtube.com/watch?v=${movie.youtubeId}`
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
