# TheatreView: product plan

## The aim

When you book a movie ticket you pick a dot on a flat map and hope for the best. TheatreView lets you
**sit in the seat before you buy it**. You see a 3D copy of the real auditorium, click a seat, and
the camera flies into that seat at eye height so you see exactly what the screen will look like
from there: how big it is, how much you have to tilt your head, and whether the person in front
blocks the view. Then you book that seat.

Who it helps:
- **Moviegoers** get fewer bad-seat surprises and more confidence to pay for premium seats.
- **Cinemas** sell more premium seats, get fewer complaints, and have a booking page people talk about.

## How it works (explained for a 12-year-old)

Think of TheatreView as a restaurant.

| Restaurant | TheatreView | What it really is |
|---|---|---|
| The dining room you sit in | **Frontend** | The website in your browser: the 3D theater, the buttons, the seat bar |
| The waiter | **API** | Messages the website sends to ask for things ("which seats are free?", "book E6 for me") |
| The kitchen | **Backend** | A computer on the internet that keeps the real list of seats and bookings |
| The fridge | **Database** | Where the kitchen stores everything so nothing is forgotten |
| The supplier trucks | **Outside APIs** | Other companies' services we borrow: movie posters, payments, AI help |

```
   YOU (browser)
       |
       v
+---------------------------+
|  FRONTEND (the 3D room)   |   React + React Three Fiber + three.js
|  - draws the theater      |   hosted on Vercel
|  - flies the camera       |
|  - shows the seat bar     |
+-------------+-------------+
              |  "which seats are free?"  "hold E6"  "book E6"
              v
+---------------------------+
|  API (the waiter)         |   Supabase auto REST API + Edge Functions
+-------------+-------------+
              |
              v
+---------------------------+       +------------------------------+
|  BACKEND + DATABASE       | <---> |  OUTSIDE APIs (suppliers)    |
|  - shows, seats, bookings |       |  - TMDB: posters, trailers   |
|  - live seat updates      |       |  - Stripe: payments (test)   |
|  - user accounts          |       |  - Claude: "seat concierge"  |
+---------------------------+       +------------------------------+
         Supabase (Postgres)
```

Live updates: when someone else books a seat, the kitchen shouts to every open dining room
("E6 is gone!") using Supabase Realtime, and that seat turns grey on your screen without a refresh.

## Tech stack

| Part | Tool | Why |
|---|---|---|
| Build tool | Vite + React + TypeScript | Fast dev server, typed code |
| 3D | three.js + @react-three/fiber | Standard way to write three.js in React |
| 3D helpers | @react-three/drei | CameraControls, Line, Text, video textures |
| Camera motion | camera-controls (`setLookAt`, `smoothTime`) | Smooth, weighty fly-to moves |
| Glow | @react-three/postprocessing | Bloom for screen and wall lights, vignette |
| State | zustand | Hovered / focused / selected seat, camera mode |
| Backend | Supabase | Postgres, auto API, Realtime, Auth, Edge Functions in one place |
| Movie data | TMDB API | Free posters, titles, runtimes |
| Payments | Stripe Checkout (test mode) | Real booking flow without real money |
| AI | Claude API via a Supabase Edge Function | Seat concierge; API key never reaches the browser |
| Hosting | Vercel (frontend) + Supabase (backend) | Free tiers, deploy on every git push |

## Phases

Each phase ends with something you can open in a browser and show someone.

### Phase 1: The room (frontend only) - DONE
- Raked auditorium: 10 rows x 16 seats, center aisle, each row 0.32 m higher than the last.
- Seats drawn as one `InstancedMesh` (1 draw call), hover and click highlight.
- Dashed sightline from the seat's eyes to the screen, ring where it lands.
- "View Seat POV": camera flies into the seat at eye height (1.15 m), then you can turn your head
  about 43 degrees left/right and 23 degrees up/down. Esc flies back out.
- Wall sconces, screen light spill (RectAreaLight), fog, bloom, vignette.
- Seat bar (seat, row, POV, Select) and legend.
- House lights: a pull-cord switch with spring physics (Movie, Dim, Bright, Full), a fine slider,
  and the L key. Lights fade like a cinema dimmer and the fog pulls back so the back rows show.

### Phase 2: Real cinemas - DONE
- Venue presets with published screen sizes: standard multiplex, Dolby Cinema, BFI IMAX,
  TCL Chinese Theatre IMAX, IMAX Melbourne, Traumpalast Leonberg (world's largest IMAX).
- Room built from cinema design rules: SMPTE 30 degree / THX 36 degree viewing angles, 35 degree
  vertical comfort, C-value sightline rake capped at 540 mm risers. Curved screens as true arcs.
- Clicking a seat now sits you in it straight away. Arrow keys hop between seats while seated.
- Seat bar shows how much of your view the screen fills, look-up angle, head clearance and a rating.
- Research and sources: docs/CINEMA_RESEARCH.md.

### Phase 3: Make it feel real (frontend)
- Real movie on the screen with `useVideoTexture` (Blender open movies such as *Tears of Steel*, CC BY).
- Screen light changes color with the movie (sample a tiny copy of the video each frame).
- Spatial audio: `PositionalAudio` from the screen, so back rows sound further away.
- Better seat model made in Blender, loaded as `.glb`, converted with `gltfjsx`.
- Mobile touch controls, fullscreen button, `prefers-reduced-motion` support.

### Phase 4: Backend + API (Supabase)
- Tables: `movies`, `auditoriums` (seat layout as JSON), `shows`, `bookings`, `seat_holds`.
- Seats come from the database instead of being hard-coded in `layout.ts`.
- Taken seats are grey and cannot be selected.
- Seat hold: clicking Select holds the seat for 5 minutes so two people cannot buy the same one
  (unique constraint on `show_id + seat_id` plus an expiry time).
- Realtime: subscribe to `bookings` and `seat_holds` so other people's picks show up live.
- Sign in with email magic link (Supabase Auth).

### Phase 5: Outside APIs
- TMDB: movie list page with posters, pick a showtime, then enter the 3D room.
- Stripe Checkout in test mode: hold, then pay, then a webhook confirms the booking.
- Claude "seat concierge" (Edge Function): "two seats, aisle, not too close, kid with me". The model
  gets the free seats plus their seat scores as a tool and returns its picks, and the camera flies
  to them.

### Phase 6: Ship it
- Deploy the frontend to Vercel, environment variables for the Supabase URL and anon key.
- Code-split the 3D bundle, compress textures (KTX2), lazy-load the video.
- Performance budget: 60 fps on a mid-range laptop, under 3 s to first interaction.
- Analytics: which seats people preview vs. which they buy.
- README, demo video, LinkedIn post.

## Folder map

```
src/
  venues.ts           real cinemas: published screen sizes and seating presets
  layout.ts           builds the room from a venue (angles, rake, seats) + seat rating
  store.ts            shared state: hovered, focused, selected, mode
  App.tsx             puts the 3D canvas and the HUD on the page
  scene/
    Theater.tsx       screen, stepped floor, walls, wall lights, row letters
    Seats.tsx         all seats as one InstancedMesh, hover + click
    CameraRig.tsx     overview <-> seat POV camera moves
    Sightline.tsx     dashed line from seat to screen
  ui/
    Hud.tsx           seat bar, legend, keyboard shortcuts
```
