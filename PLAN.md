# TheatreView: product plan

Live: [theatre-view.vercel.app](https://theatre-view.vercel.app) · Last updated: 2026-10-15

## The aim

When you book a movie ticket you pick a dot on a flat map and hope for the best. TheatreView lets you
**sit in the seat before you buy it**. You see a 3D copy of the real auditorium, click a seat, and
the camera flies into that seat at eye height so you see exactly what the screen will look like
from there: how big it is, how much you have to tilt your head, and whether the person in front
blocks the view. Then you book that seat.

Who it helps:
- **Moviegoers** get fewer bad-seat surprises and more confidence to pay for premium seats.
- **Cinemas** sell more premium seats, get fewer complaints, and have a booking page people talk about.

## Status at a glance

| Phase | What | Status |
|---|---|---|
| 1 | The room | Done |
| 2 | Real cinemas | Done |
| 3 | Make it feel real | Mostly done |
| 4 | Backend + API (Supabase) | Built and tested, switched off on the live site |
| 5 | Outside APIs (TMDB, Stripe, Claude) | Planned |
| 6 | Ship it | Mostly done (live on Vercel) |

## How it works (explained for a 12-year-old)

Think of TheatreView as a restaurant.

| Restaurant | TheatreView | What it really is |
|---|---|---|
| The dining room you sit in | **Frontend** | The website in your browser: the 3D theater, the buttons, the seat bar |
| The waiter | **API** | Messages the website sends to ask for things ("which seats are free?", "book E6 for me") |
| The kitchen | **Backend** | A computer on the internet that keeps the real list of seats and bookings |
| The fridge | **Database** | Where the kitchen stores everything so nothing is forgotten |
| The supplier trucks | **Outside APIs** | Other companies' services we borrow: movies, payments, AI help |

```
   YOU (browser)
       |
       v
+---------------------------+
|  FRONTEND (the 3D room)   |   React + React Three Fiber + three.js
|  - draws the theater      |   static files on Vercel's CDN (live)
|  - flies the camera       |
|  - plays the movie        |
+-------------+-------------+
              |  "which seats are free?"  "hold E6"  "book E6"
              v                                   (switched off for now)
+---------------------------+
|  API (the waiter)         |   Supabase REST + Postgres functions (RPC)
+-------------+-------------+
              |
              v
+---------------------------+       +------------------------------+
|  BACKEND + DATABASE       | <---> |  OUTSIDE SERVICES            |
|  - shows, holds, bookings |       |  - YouTube: Spider-Man clips |
|  - live seat updates      |       |  - HLS streams: Blender films|
|  - guest accounts         |       |  - later: TMDB, Stripe,      |
+---------------------------+       |    Claude seat concierge     |
     Supabase (Postgres, Mumbai)    +------------------------------+
```

Live updates: when someone else holds or books a seat, a database trigger sends a tiny
"seat_changed" message to everyone watching that show (Supabase Realtime Broadcast). Each browser
waits a short random moment and then re-reads the seat map, so the seat turns grey without a refresh.

## Tech stack

| Part | Tool | Why |
|---|---|---|
| Build tool | Vite + React + TypeScript | Fast dev server, typed code |
| 3D | three.js + @react-three/fiber | Standard way to write three.js in React |
| 3D helpers | @react-three/drei | `Line` for the sightline |
| Camera motion | camera-controls + our own wrapper | Drag / head turn; custom curved, eased flights; capped time step |
| YouTube on screen | three.js `CSS3DRenderer` | Real YouTube player placed on the 3D screen; DOM only touched when the camera moves |
| Streams | hls.js (light build, lazy-loaded) | HLS adaptive streams as a real `VideoTexture`, starting at the top quality |
| Glow | @react-three/postprocessing | Bloom for screen and lights, vignette |
| Fades | maath `easing.damp` | Dimmer-style light fades |
| State | zustand | Theater, seats, mode, lights, movie, booking |
| Font | Inter via @fontsource-variable/inter | One font everywhere, bundled (no font CDN) |
| Backend | Supabase (Postgres, Realtime, Auth) | Tables, RLS, RPC functions, broadcast trigger, anonymous sign-in |
| Hosting | Vercel (frontend) + Supabase free plan (backend) | Static CDN, deploy on every push to `main` |
| Later: movie data | TMDB API | Posters, titles, runtimes |
| Later: payments | Stripe Checkout (test mode) | Real booking flow without real money |
| Later: AI | Claude API via a Supabase Edge Function | Seat concierge; API key never reaches the browser |

## Phases

Each phase ends with something you can open in a browser and show someone.

### Phase 1: The room - DONE
- Raked auditorium, seats drawn as one `InstancedMesh`, hover and click highlight.
- Dashed sightline from the seat's eyes to the screen, ring where it lands.
- Click a seat to sit in it: camera at eye height (1.15 m), head turn about 43° left/right and
  23° up/down. Arrow keys hop between seats, Esc flies back out.
- Seat bar (seat, row, view score, POV, Select) and legend.
- House lights: pull cord with spring physics that follows the cursor 1:1, a slider, and the L key
  (Movie, Dim, Bright, Full). Lights fade like a dimmer and the fog pulls back as they come up.

### Phase 2: Real cinemas - DONE
- Venue presets with published screen sizes: standard multiplex, Dolby Cinema, BFI IMAX,
  TCL Chinese Theatre IMAX, IMAX Melbourne, Traumpalast Leonberg (world's largest IMAX).
- Room built from cinema design rules: SMPTE 30° / THX 36° viewing angles, 35° vertical comfort,
  C-value sightline rake capped at 540 mm risers. Curved screens as true arcs.
- Seat score: screen fill, look-up angle, head clearance, rating.
- Research and sources: docs/CINEMA_RESEARCH.md.

### Phase 3: Make it feel real - MOSTLY DONE
Done:
- Movie list under "Now showing": Spider-Man: No Way Home and Brand New Day trailers and scenes
  (YouTube), free Blender films (HLS streams), or paste a YouTube / `.m3u8` / `.mp4` link.
- YouTube: real player on the screen via `CSS3DRenderer`, controls only from the side panel (mouse
  never reaches the player). Quality is YouTube's choice; it can't be forced.
- Streams: hls.js starts at the highest level (1080p for Big Buck Bunny), drawn as a `VideoTexture`
  that glows and bends with curved screens; correct aspect with black bars; redraws only on new
  video frames (`requestVideoFrameCallback`).
- Chairs: padded cushion, ~12° leaning backrest, armrests on posts, pedestal, rounded edges (built in
  code with `RoundedBoxGeometry`; Blender is not installed here). An invisible box per seat is used
  for mouse picking so hover stays fast.
- Lighting like a real cinema: recessed ceiling downlights with faint soft cones, wall sconces that
  wash the wall, amber aisle step lights, a ceiling visible only from inside. Seats lit by a few
  RectAreaLights.
- Starting view fits the window (per-aspect camera tilt, perspective-correct framing, camera always
  on the centre line); the left panel folds away and starts folded on small screens.
- Loading screen stays until the first real frame; shaders (including hidden ones) are compiled
  in the background first.
- Camera flights follow a curve that lifts over the rows (no flying through chairs), ease-out so they
  move the instant you click: about 0.7 s into a seat, 1.0 s out, 0.35 s seat to seat.
- One font everywhere (Inter), social preview image, Open Graph tags.

Still to do:
- Screen light changes color with the movie (sample a tiny copy of the video each frame; only
  possible for streams, not YouTube).
- Spatial audio: `PositionalAudio` from the screen, so back rows sound further away.
- Mobile touch controls, fullscreen button, `prefers-reduced-motion` support for camera flights.
- Optional: a real Blender chair (.glb, Draco) with one shared baked ambient-occlusion lightmap.
- Optional: drei `ContactShadows` under the rows; walk mode with `PointerLockControls`.

Differentiators (none of the similar demos do these):
- **"Who's in front of me?"** Fill the room with instanced silhouettes of real-world heights. Enter
  your own seated height and see if a tall person in front blocks your view; the head-clearance
  number updates. Turns the C-value math into something you can see.
- **Best-seat heatmap.** One toggle colors every seat by its view score.
- **Compare two seats side by side** (split view, two cameras).

### Phase 4: Backend + API (Supabase) - BUILT, SWITCHED OFF
Built and tested:
- Supabase project `theatreview` (Mumbai, free plan). Tables: `venues`, `shows` (with `movie_id`),
  `seat_holds`, `bookings`. Seat positions are not stored; the frontend builds them the same way
  every time, so `venue + seat_id` is enough.
- Row Level Security: venues and shows are public; people only see their own holds and bookings.
  Nobody writes directly.
- Postgres functions: `hold_seat` (atomic, 5-minute hold, one hold per person per show),
  `book_seat` (only from your own valid hold), `release_hold`, `get_seat_states` (taken seats without
  revealing who). Holds expire by timestamp; nothing needs to clean up on time.
- Trigger broadcasts `seat_changed` per show; clients coalesce refreshes with random jitter and retry
  transient errors with backoff.
- Tested with two pretend users: double holds refused, booked seats refused, booking without a hold
  refused, expired holds free the seat. 100 simultaneous seat-map reads all succeeded.

To switch it on:
1. Turn on **Allow anonymous sign-ins** in Supabase (Authentication → Providers).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel and redeploy.
3. Set `BOOKING_ENABLED = true` in `src/config.ts`.
4. Test with two browsers at once.

Limits: free plan allows 200 live connections and 100 live messages a second. Busy ticket sales
would need Supabase Pro (500 / 500).

### Phase 5: Outside APIs - PLANNED
- TMDB: movie posters and titles for the showtime list.
- Stripe Checkout in test mode: hold, then pay, then a webhook confirms the booking.
- Claude "seat concierge" (Edge Function): "two seats, aisle, not too close, kid with me". The model
  gets the free seats plus their seat scores as a tool and returns its picks, and the camera flies
  to them.
- Move the Blender films from public test streams to a real video host (Cloudflare Stream, Mux or
  Bunny Stream).

### Phase 6: Ship it - MOSTLY DONE
Done:
- Live on Vercel (static files, served from the nearest edge; Mumbai for India).
- Lighthouse (phone): performance 39 to 52-78, total blocking time 17.2 s to 0.2-3.9 s.
  On-demand rendering, lazy-loaded Supabase and hls.js, deferred YouTube, no third-party fonts.
- Hashed assets cached for a year (`vercel.json`); daily GitHub Action keeps the database awake.
- Click to camera movement under 40 ms; no long tasks during flights in testing.
- Load tested: 10,000 page requests in 15 s at 100 connections with no errors.
- README with phases, My Thinking, credits and licenses; social preview image.

Still to do:
- Split the 3D bundle (~470 KB zipped) into smaller chunks.
- Analytics: which seats people preview vs. which they buy.
- Demo video, LinkedIn post.

## Folder map

```
src/
  venues.ts           real cinemas: published screen sizes and seating presets
  layout.ts           builds the room from a venue (angles, rake, seats) + seat rating
  store.ts            shared state: theater, seats, mode, lights, movie, booking
  movie.ts            parses YouTube / stream / file links; YouTube player commands
  movies.ts           the "Now showing" catalog
  config.ts           feature switches (BOOKING_ENABLED)
  fonts.ts            Inter font
  App.tsx             canvas, shader warm-up, loading screen, HUD
  scene/
    Theater.tsx       screen (flat or curved), movie on it, floor, walls, row letters
    Seats.tsx         chair geometry, instanced seats, hit boxes, hover + click
    CameraRig.tsx     camera-controls wrapper and curved flights
    framing.ts        best starting camera for the window size
    Sightline.tsx     dashed line from seat to screen
    Lighting.tsx      downlights, sconces, step lights, area lights, fades
  ui/
    Hud.tsx           venue panel, movie list, seat bar, booking buttons, shortcuts
    LightCord.tsx     pull cord and light slider
  backend/
    supabase.ts       lazy Supabase client
    booking.ts        shows, holds, bookings, realtime, retries
supabase/
  migrations/         tables, RLS, functions, broadcast trigger
  seed.sql            demo venues and showtimes
docs/
  CINEMA_RESEARCH.md  cinema facts, design rules, sources
.github/workflows/keep-warm.yml   daily database ping
vercel.json                       one-year cache for hashed assets
```
