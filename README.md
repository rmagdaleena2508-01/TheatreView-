# TheatreView

**Sit in a movie seat before you buy the ticket.**

Pick a seat in a 3D movie theater. The camera flies into that seat. You see the screen just like
you would from there. Then you know if it is a good seat.

![The 3D theater with a seat picked and a line from the seat to the screen](docs/images/overview.jpg)

## Why I made this

I just saw this idea on LinkedIn. I got inspired, so I started building it.

When you book a movie, you pick a dot on a flat map. You never really know what the view will be
like until you get there. Is the screen too big? Do you have to look up? Will the person in front
block you? TheatreView lets you find out first.

## What it can do

- **Click a seat to sit in it.** The camera flies to that seat at eye height and looks at the screen.
- **Look around.** Drag to turn your head. Use the arrow keys to move to the next seat.
- **See a score for every seat.** It tells you how much of your view the screen fills, how far
  you look up, how much room there is over the head in front of you, and if the seat is Great,
  Good, Far, Very close or Neck strain.
- **Try real theaters.** Switch between six theaters, from a normal one to the biggest IMAX
  screen in the world. Each one uses the real screen size.
- **Pull the light cord.** A string hangs at the top right. Pull it down to make the room
  brighter. Pull again to change it. There is also a slider.
- **Curved and flat screens.** Some theaters have a curved screen, so the app bends it too.
- **Pick a movie.** Under "Now showing" you can pick from a list: Spider-Man: No Way Home and
  Spider-Man: Brand New Day (trailers and scenes), plus free Blender movies. Or paste your own
  YouTube link, or a direct `.mp4` or `.webm` link.

![Sitting in seat H23 at the TCL Chinese Theatre IMAX](docs/images/seat-view.jpg)

## Try it

You need [Node.js](https://nodejs.org) 20.19 or newer.

```bash
git clone https://github.com/rmagdaleena2508-01/TheatreView-.git
cd TheatreView-
npm install
npm run dev
```

Then open the link it prints (it looks like `http://localhost:5173`).

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app on your computer |
| `npm run build` | Checks the code and makes a version ready to put online |
| `npm run preview` | Opens the online-ready version so you can check it |
| `npm run lint` | Looks for small mistakes in the code |

### Turn on booking (optional)

The app works without this. You only need it for holding and booking seats.

1. Make a free project at [supabase.com](https://supabase.com).
2. In the project, open **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**.
3. Open the **SQL Editor** and run these two files, in this order:
   - `supabase/migrations/20261014000000_phase4_booking.sql`
   - `supabase/seed.sql`
4. Copy `.env.example` to `.env.local` and fill in your project URL and publishable key
   (from **Project Settings → API Keys**).
5. Run `npm run dev` again.

## How to use it

| Do this | What happens |
|---|---|
| Pick a theater in the box at the top left | The room changes to that theater |
| Move your mouse over a seat | A line shows where that seat looks at the screen |
| Click a seat | You sit in it |
| Drag (while sitting) | You look around |
| Arrow keys (while sitting) | You move to the seat next to you, in front, or behind |
| Esc | You stand up and fly back out |
| Drag (not sitting) | You walk around the room |
| Scroll (not sitting) | You zoom in and out |
| Pull the cord, or press L | The lights change: Movie, Dim, Bright, Full |
| Pick a movie under "Now showing" | That movie plays on the big screen |
| Paste a YouTube link and press Play | Your own video plays on the big screen |
| Pause / Sound on / Stop | Controls the movie (it starts muted) |
| Pick a showtime (with booking on) | The seat map shows which seats are taken for that show |
| Select | Holds the seat for you for 5 minutes (or just marks it, with booking off) |
| Book seat | Books the seat you are holding |

## How it works

Think of the app like a restaurant.

| Restaurant | TheatreView | What it is |
|---|---|---|
| The room you eat in | **Frontend** | The 3D theater you see in your browser |
| The waiter | **API** | Carries messages, like "Is seat E6 free?" |
| The kitchen | **Backend** | Keeps the real list of seats and bookings |
| The fridge | **Database** | Stores everything so nothing gets lost |
| Delivery trucks | **Outside services** | Movie posters, payments, AI help |

The frontend is done. The backend is being built now, in Phase 4.

```
You (browser)
    |
    v
Frontend: the 3D theater  (React + three.js)
    |   "Is E6 free?"  "Book E6 for me"
    v
API + Backend + Database  (Supabase, Phase 4: building now)
    |
    v
Outside services  (movie posters, payments, AI, coming in Phase 5)
```

## Tech stack

| Part | Tool | Why I picked it |
|---|---|---|
| Building the app | [Vite](https://vite.dev) + [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) | Fast to start, and TypeScript catches mistakes early |
| 3D | [three.js](https://threejs.org) + [React Three Fiber](https://r3f.docs.pmnd.rs) | The most used way to make 3D on the web, written the React way |
| 3D helpers | [drei](https://github.com/pmndrs/drei) | Ready-made pieces: camera controls, text, lines |
| Camera moves | [camera-controls](https://github.com/yomotsu/camera-controls) | Smooth fly-to moves that feel heavy, not jumpy |
| Glow | [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) | Makes the screen and lamps glow, and darkens the edges |
| Smooth fades | [maath](https://github.com/pmndrs/maath) | Fades the lights in and out like a real theater |
| Shared memory | [zustand](https://github.com/pmndrs/zustand) | One small place that remembers the seat, the theater and the lights |
| Backend | [Supabase](https://supabase.com) (Postgres) | Database, live updates and sign-in in one place |
| Hosting (later) | [Vercel](https://vercel.com) | Puts the app online every time I push code |

## The phases

I am building TheatreView in **6 phases**. Click a phase to see the details.

<details>
<summary><b>Phase 1: The room</b> ✅ Done</summary>

<br>

- A 3D theater with a big screen, a sloped floor, walls and lamps.
- 216 seats. All of them are drawn as one object, so the app stays fast.
- Move your mouse over a seat and it lights up.
- A dashed line goes from the seat to the screen, with a ring where it lands.
- The camera flies into a seat, and you can turn your head.
- A bar at the bottom shows the seat, the row and the buttons.
- A pull cord for the lights, with real spring movement.

</details>

<details>
<summary><b>Phase 2: Real theaters</b> ✅ Done</summary>

<br>

- Six theaters with their real screen sizes:
  - Standard multiplex
  - Dolby Cinema
  - BFI IMAX, London
  - TCL Chinese Theatre IMAX, Hollywood
  - IMAX Melbourne
  - Traumpalast IMAX, Leonberg (the biggest IMAX screen in the world)
- Each room is built with real theater design rules: how far the first and last rows can be, and
  how high each row must be so you can see over the person in front of you.
- Curved screens are bent into a real curve.
- Every seat gets a score.
- All facts and links are in [docs/CINEMA_RESEARCH.md](docs/CINEMA_RESEARCH.md).

</details>

<details>
<summary><b>Phase 3: Make it feel real</b> 🔜 Next</summary>

<br>

- ✅ Play a real movie on the screen: paste a YouTube link, or a direct video file link.
- The screen's light changes color with the movie.
- Sound that comes from the screen, so it is quieter in the back rows.
- A better seat model made in Blender.
- Touch controls for phones, a full-screen button, and a calm mode for people who do not like motion.

</details>

<details>
<summary><b>Phase 4: Backend and API</b> 🚧 Building now</summary>

<br>

**The short brief:** Phase 4 turns TheatreView from "look at a seat" into "really get a seat".
Many people can open the same show at the same time. When one person picks a seat, everyone else
sees it change right away, and nobody can ever get the same seat twice.

What I am building:

1. **A database** (Supabase) with four lists: theaters, showtimes, seat holds and bookings.
2. **A showtime picker.** Each theater has a few showtimes. You pick one before you pick a seat,
   and that show's movie starts playing on the screen.
3. **Hold a seat for 5 minutes.** Press Select and the seat is yours for 5 minutes. A timer counts
   down. If time runs out, the seat is free again.
4. **Book it.** Press "Book seat" while your hold is still good, and the seat is booked for real.
   (Payment comes in Phase 5.)
5. **Live seat map.** Booked seats turn dark. Seats someone else is holding turn brown. It all
   changes on your screen without a refresh.
6. **No sign-up needed.** You get a quiet guest account the first time you hold a seat.
7. **Safe by design.** The browser can only ask the database to do things. The database checks
   every request, so a seat can never be booked twice, even if two people click at the same time.
8. **Still works without a backend.** If you run the app without Supabase keys, you can still
   preview every seat. Only booking turns off.

What is done so far: the database plan, the safe hold and book steps, the showtime picker, the timer
and the live seat colors. What is left: connect it to a real Supabase project and test it with two
browsers at once.

</details>

<details>
<summary><b>Phase 5: Outside services</b> ⏳ Planned</summary>

<br>

- Movie posters and titles from [TMDB](https://www.themoviedb.org).
- Pretend payments with [Stripe](https://stripe.com) test mode, so no real money moves.
- An AI seat helper. You type "two seats on the aisle, not too close, I have a kid with me" and
  it picks seats and flies you there. The AI key stays on the server, never in the browser.

</details>

<details>
<summary><b>Phase 6: Put it online</b> ⏳ Planned</summary>

<br>

- Put the app on Vercel so anyone can use it.
- Make it load faster: split the 3D code and shrink the pictures.
- Goal: smooth on a normal laptop, ready to use in under 3 seconds.
- Count which seats people look at and which seats they buy.
- Make a demo video.

</details>

## My Thinking

These are the small choices I made along the way, and why. Click one to read it.

<details>
<summary><b>Click a seat and you sit in it right away</b></summary>

<br>

At first, clicking a seat only picked it. You had to press a second button to sit. That felt
wrong. Sitting in the seat is the whole point of the app, so now one click does it.

</details>

<details>
<summary><b>All the seats are one 3D object</b></summary>

<br>

The biggest theater has 945 seats. If every seat were its own object, the computer would have to
draw 945 things every frame. Instead, the app draws one seat shape 945 times in one go (this is
called instancing). It stays fast, and the app still knows which seat you clicked.

</details>

<details>
<summary><b>Turning your head, not walking around</b></summary>

<br>

When you sit, the camera spins around a point just in front of your eyes, not around the screen.
So when you drag, it feels like turning your head. You can turn about 43 degrees left or right
and about 23 degrees up or down, like a real person in a chair.

</details>

<details>
<summary><b>The camera flies in two steps</b></summary>

<br>

First the camera flies to the seat while looking at the screen. Then it quietly switches to
"head turning" mode. If it did both at once, the flight looked twisty and strange.

</details>

<details>
<summary><b>Real screen sizes, but rule-based rooms</b></summary>

<br>

Theaters tell you their screen size. They do not tell you how deep the room is, how high the
ceiling is or how tall each step is. So the app uses the real screen size, then builds the room
with real design rules:

- The last row must still see the screen fill at least 36 degrees of your view (THX rule).
- No seat should see less than 30 degrees (SMPTE rule).
- The front row should not have to look up more than 35 degrees (more for IMAX, which wants to fill your view).
- Each row is raised just enough to see over the head in front by 12 to 15 cm.
- No step can be taller than 54 cm, because then you would need a railing.

Anything I had to guess is marked "approximated" or "assumed" in the research notes.

</details>

<details>
<summary><b>The floor steps get taller toward the back</b></summary>

<br>

I did not use the same step height for every row. Each row is lifted just enough so your eyes see
over the person in front of you to the bottom of the screen. The further back you go, the more lift
you need. That makes the real "stadium" shape you see in theaters.

</details>

<details>
<summary><b>A pull cord for the lights</b></summary>

<br>

The room was too dark to see the seats, so I needed a light switch. A plain button felt boring, so I
made a pull cord, like an old lamp. It stretches when you pull, swings, and springs back. Each pull
moves to the next light level. A slider is there too, for people who want exact control or use a
keyboard.

</details>

<details>
<summary><b>Lights fade, they do not snap</b></summary>

<br>

Real theaters fade the lights slowly. So the app fades them over about half a second. When the lights
go up, the fog in the room also moves back, so you can see the back rows.

</details>

<details>
<summary><b>The room starts bright</b></summary>

<br>

A dark theater looks cool, but you could not see the seats. So the app starts on "Bright". You can
pull the cord down to "Movie" when you want the real dark feeling.

</details>

<details>
<summary><b>Seat scores use real numbers</b></summary>

<br>

The score is not a guess. The app measures how wide the screen looks from your eyes, how far you look
up, and how much room there is over the head in front of you. Then it checks those numbers against
the THX and SMPTE rules.

</details>

<details>
<summary><b>How a YouTube video gets onto a 3D screen</b></summary>

<br>

YouTube does not let other websites read the pixels of its videos. That means the 3D engine cannot
paint a YouTube video onto the screen like a picture. So I did a trick: I put the real YouTube player
on the page and tilted and stretched it with CSS so it sits exactly on the 3D screen. When the camera
moves, the player moves with it.

The seats never cover the player, because the rows are built so every seat can see over the heads in
front to the bottom of the screen. So drawing the player on top always looks right.

A few small things came with this:

- The video starts **muted**, because browsers only let videos play by themselves when they are quiet.
  Press "Sound on" to hear it.
- You cannot click on the YouTube player itself, so that dragging still moves the camera. The Pause,
  Sound on and Stop buttons talk to the player for you.
- The video stays flat even on curved screens. The curves are small, so it is hard to notice.
- The movie list lives in `src/movies.ts`. I checked every title with YouTube's own lookup service, so
  the names match the real videos.
- Some videos do not allow playing on other websites. Those will show an error inside the player.

Direct `.mp4` or `.webm` links work a different way. They become a real 3D picture, so they glow and
bend with curved screens. The website that hosts the file has to allow it (this is called CORS).

</details>

<details>
<summary><b>The light cord follows your hand</b></summary>

<br>

At first, the cord swung the wrong way. If you pulled left, it went right. That is because the
screen turns things clockwise for a positive angle, and I forgot to flip it. Now the knob stays
exactly under your mouse while you hold it, and the cord points from where it hangs to your hand.
When you let go, it keeps its swing and springs back, like a real string.

</details>

<details>
<summary><b>The database does not store where seats are</b></summary>

<br>

The app already builds every theater the same way every time from the theater's numbers. So seat
"H12" in the multiplex is always in the same spot. The database only needs to know "show 5, seat H12
is booked". This keeps the database small and means I never have two copies of the seat map that
could disagree.

</details>

<details>
<summary><b>Holds run out by themselves</b></summary>

<br>

Each hold has an "until" time. The database only counts a hold if that time has not passed yet. So
nothing has to wake up and delete old holds on time. A seat is free the very second its hold runs out.

</details>

<details>
<summary><b>Two people can never get the same seat</b></summary>

<br>

The browser is not allowed to change the seat lists directly. It can only ask the database to "hold
this seat" or "book this seat". The database does the check and the change in one single step, so
there is no gap where two people can sneak in. On top of that, the bookings list has a rule that one
seat in one show can only be booked once.

</details>

<details>
<summary><b>Guest accounts instead of sign-up</b></summary>

<br>

Asking for an email before you can even try a seat felt like too much. So the app makes a quiet guest
account the first time you hold a seat. That way every hold still belongs to someone. Email sign-in
can come later, when you actually pay.

</details>

<details>
<summary><b>Live updates say "something changed", not "who did it"</b></summary>

<br>

When a hold or booking changes, the database sends a tiny message: "seat H12 changed". Every open
browser then asks for the latest seat map. The message never says who took the seat, so nobody's
info leaks. The app also asks for the seat map right after it connects, in case a change slipped by
while it was connecting.

</details>

<details>
<summary><b>A movie list, and every showtime has its movie</b></summary>

<br>

Pasting a link is nice, but most people just want to press a button. So "Now showing" has a short
list, grouped by movie: Spider-Man: No Way Home, Spider-Man: Brand New Day, and a few free Blender
movies. The paste box is still there for anything else.

Each showtime in the database also says which movie it plays. When you pick a showtime, that movie
starts on the screen, so the booking part and the screen always match.

The videos stay on YouTube and play in YouTube's own player. The app does not copy or store them.
Some of the scene clips are uploaded by fan channels, so they could be taken down one day. If that
happens, YouTube shows its own message on the screen and you can pick another one.

</details>

<details>
<summary><b>Some things are left out on purpose</b></summary>

<br>

- **AMC Lincoln Square IMAX** is not in the app. Different websites give different screen sizes, so I
  did not trust them.
- **The shortcut keys** (L, arrows) do nothing while you are typing in a box or picking a theater.

</details>

## Folder map

```
src/
  venues.ts           the real theaters and their screen sizes
  layout.ts           builds the room: rows, steps, seats, and the seat score
  store.ts            remembers the theater, the seat, the lights, and the movie
  movie.ts            reads YouTube and video links, and talks to the YouTube player
  movies.ts           the movie list under "Now showing"
  App.tsx             puts the 3D room and the buttons on the page
  scene/
    Theater.tsx       the screen (flat or curved), the movie on it, floor, walls, row letters
    Seats.tsx         all the seats, mouse-over and click
    CameraRig.tsx     the camera flying in and out of seats
    Sightline.tsx     the dashed line from seat to screen
    Lighting.tsx      all the lamps and how bright they are
  ui/
    Hud.tsx           the theater box, the seat bar, and shortcut keys
    LightCord.tsx     the pull cord and light slider
  backend/
    supabase.ts       connects to Supabase (only if keys are set)
    booking.ts        showtimes, holds, bookings, and live updates
supabase/
  migrations/         the database tables, safety rules, and functions
  seed.sql            demo theaters and showtimes
docs/
  CINEMA_RESEARCH.md  real theater facts, design rules, and links
PLAN.md               the full product plan
```

## Known problems

- In very tall IMAX rooms, the top of the screen can be cut off in the starting view. Drag to move
  around, or sit in a seat to see the whole screen.
- The 3D code is one big file (about 500 KB zipped). It will be split up in Phase 6.

## Help make it better

Ideas and fixes are welcome.

1. Fork this repo.
2. Make a new branch: `git checkout -b my-idea`
3. Make your change and check it with `npm run build`.
4. Push it and open a pull request.

If you find a bug, please open an issue and tell me what you clicked and what you saw.

## Thank you

- The LinkedIn post that gave me this idea.
- [Codrops: Cinema Seat Preview Experiment](https://tympanus.net/codrops/?p=25885), an early version of this idea.
- [StadiView](https://github.com/fengjun8/stadiview), a stadium version that showed me how to handle lots of seats.
- [pmndrs](https://github.com/pmndrs), the people who make React Three Fiber, drei, zustand and maath.
- The README layout was inspired by [Best-README-Template](https://github.com/othneildrew/Best-README-Template) and [awesome-readme](https://github.com/matiassingers/awesome-readme).

## License

[MIT](LICENSE). You can use it, change it and share it. Just keep the license file.
