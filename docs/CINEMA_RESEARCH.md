# Cinema research notes

Research notes behind the venue presets in `src/venues.ts` and the room rules in `src/layout.ts`.
Collected 2026-10-14.

## What venues publish (and what they don't)

Cinemas publish **screen size**, and sometimes seat count and whether the screen is curved.
None of the venues below publish room depth, ceiling height, row spacing or riser heights.
So the app uses each venue's real screen and builds the room around it with the design rules in
the next section. Anything marked "approximated" or "assumed" is our estimate, not a published figure.

| Venue | Screen (W x H) | Aspect | Shape | Seats | Source |
|---|---|---|---|---|---|
| Traumpalast IMAX, Leonberg, Germany | 38.80 x 21.00 m (814.8 m², Guinness verified Dec 2022) | ~1.85:1 | Not published; slight curve assumed | Not published | [Guinness World Records](https://www.guinnessworldrecords.com/world-records/729198-largest-permanent-cinema-screen-overall), [Guinness news](https://www.guinnessworldrecords.com/news/commercial/2023/1/largest-permanent-imax-screen-unveiled-in-germany-733250), [IMAX press release](https://www.imax.com/md/pr/largest-imax-world-set-open-germany-lochmann-filmtheaterbetriebe) |
| IMAX Melbourne, Australia | 32 x 23 m (31 x 23 m at opening in 1998) | 1.43:1 (largest 1.43:1 screen) | Not published; near flat assumed | Not published | [Wikipedia](https://en.wikipedia.org/wiki/IMAX_Melbourne), [Museums Victoria](https://museumsvictoria.com.au/melbournemuseum/whats-on/imax-melbourne) |
| TCL Chinese Theatre IMAX, Hollywood | ~94 x 46 ft (28.65 x 14.02 m) | ~2.04:1 | Curved, can be masked | 932 (after renovation; 986 first announced) | [Cinema Treasures](https://cinematreasures.org/theaters/1), [SlashFilm](https://www.slashfilm.com/525804/hollywoods-graumans-chinese-theatre-to-convert-into-third-largest-imax-theater-in-north-america) |
| BFI IMAX, London | 25.9 x 19.8 m (512.8 m²); 26.5 x 20 m before Oct 2022 refit | ~1.31:1 measured | Not published; near flat assumed | Not published | [Wikipedia](https://en.wikipedia.com/wiki/BFI_IMAX) |
| AMC Lincoln Square IMAX, New York | ~101 x 75.6 ft (other reports: 97 x 76 ft) | ~1.33:1 | Not published | 400+ | [Hoodline](https://hoodline.com/2026/07/lincoln-square-odyssey-imax-becomes-four-figure-ticket-hustle/), [NBC New York](https://www.nbcnewyork.com/news/business/money-report/christopher-nolans-oppenheimer-is-the-longest-imax-film-ever-heres-where-to-watch-it-in-70mm-imax/4523117/) (not a preset: sources disagree) |
| Dolby Cinema (one example install) | 75 x 40.5 ft (22.86 x 12.34 m) | 1.85:1 (DCI Flat) | Press describes a curved, wall-to-wall screen; patent suggests about 20:1 width to depth | Prototype: 70 | [Dolby Cinema review](https://www.91mobiles.com/reviews/dolby-cinema-pitch-black-perfection/), [Digit](https://www.digit.in/news/audio-video/dolby-cinema-debuts-in-india-heres-what-makes-it-different-from-a-regular-theatre.html), [Large format theater design patent](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10907371) |

## Room rules ("the physics of the room")

These rules turn a screen size into a full auditorium. All of them are in `buildTheater()`.

### Viewing angles (how big the screen looks)
- **SMPTE EG-18-1994**: minimum horizontal viewing angle of **30 degrees**.
- **THX**: at least **36 degrees** from the **last row**. The app uses this to decide how far back
  the last row may be: `lastZ = (W / 2) / tan(18°)`, which is about 1.54 x screen width.
- **Vertical comfort**: SMPTE EG-18 says discomfort starts above **35 degrees** from the eyes up to
  the top of the picture. The front row is placed so it stays under the venue's limit
  (35 degrees for a multiplex; up to 55 degrees for IMAX, which deliberately fills your view).

Sources: [SMPTE EG-18-1994 (withdrawn 2003)](https://pub.smpte.org/doc/eg18/19940325-pub/eg0018-1994_withdrawn2003.pdf),
[Acoustic Frontiers](https://acousticfrontiers.com/blogs/articles/home-theater-viewing-angles-distances-and-sightlines),
[Audio Advice](https://www.audioadvice.com/blogs/expert-advice/how-to-choose-the-best-home-theater-screen-size),
[Front Desk forum (quotes Time-Saver Standards)](https://forum.frontdesk.co.in/showthread.php?tid=2377).

### Rake (how steep the floor is)
- **C-value** = how far your sightline passes above the eyes of the person in front of you.
  Bands from one design guide: 120 mm+ excellent, 80-120 mm good, under 60 mm poor. SMPTE EG-18
  used 9-10 in (229-254 mm) for analysis and 7 in (178 mm) as a minimum.
- The app aims the sightline at the **bottom edge of the picture** and raises each row just enough
  to hit the venue's C-value target (120 mm multiplex, 150 mm Dolby/IMAX):
  `e_next = (e_prev + C) * d_next / d_prev`, with heights measured from the bottom of the picture.
  The result is the real stadium curve: steps get taller towards the back.
- **Max riser**: steps are usually capped at **540 mm** (above that a continuous guardrail is
  needed); 450 mm is a more comfortable maximum.

Sources: [Design Collaborative: optimizing sightlines](https://designcollaborative.com/optimizing-sightlines-for-every-seat-enhancing-audience-experience-in-venues/),
[Wikipedia: Sightline (architecture)](https://en.wikipedia.org/wiki/Sightline_(architecture)).

### Seating
- Seated eye height: 1.15 m above the seat floor.
- Row depth: 1.0-1.1 m for standard seats, 1.6 m for recliners (Dolby preset).
- No more than 16 seats per aisle (Neufert). Presets use blocks of 9-15.

Source: [Auditorium design summary (Neufert)](https://www.slideshare.net/slideshow/auditoriumpptx/257199656).

### Screen height
- No published standard for screen bottom height was found. The app uses 0.6-1.0 m above the
  front-row floor (lower for IMAX, which runs floor to ceiling).

### Curved or flat?
- Curving a screen keeps the throw distance from the lens similar across the picture, reducing
  edge distortion and hot-spotting on high-gain screens. Downside: cross-reflection on high-gain
  curved screens lowers contrast at the sides.
- Original film IMAX used a nearly flat screen; Cinerama and Todd-AO were deeply curved.
- Dolby patent: about 20:1 width to depth; "flat aspect ratio screens are preferred" otherwise.
- In the app, `curveRatio` is width : curve depth. 0 = flat, 20 = Dolby-style curve,
  40-60 = near flat. The screen is bent into a true circular arc.

Sources: [Elite Screens FAQ](https://elitescreens.com/es-faqs/why-is-a-curved-projection-screen-better-than-a-flat-one-i-like-the-way-it-looks-but-what-about-performance/),
[Picture-dominance patent](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10924717).

## Seat rating in the app

| Rating | Rule |
|---|---|
| Neck strain | Look-up angle over 45 degrees |
| Very close | Look-up angle over 35 degrees (SMPTE discomfort) |
| Far | Screen fills less than 30 degrees (below SMPTE) |
| Good | 30-36 degrees (meets SMPTE, below THX) |
| Off to the side | Seat further from center than 45% of screen width |
| Great | Everything else |

## Gaps to fill later
- Room depth and height, riser heights and seat counts for Leonberg, Melbourne and BFI.
- Exact curvature for each IMAX screen.
- Prasads IMAX (Hyderabad) screen size: not found in this round of research.
