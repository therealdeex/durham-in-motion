# Phase 4 build notes — the two story experiences

Phase 4 turns the strongest Phase 3 findings into two public storytelling
experiences: **A Day in Durham** (`/stories/day/`) and **The Transit
Journey** (`/stories/transit/`). No new data was acquired; everything renders
from `public/data/story-day.json` and `public/data/story-transit.json`, built
by `npm run data:phase4` from the Phase 3 normalized extracts (plus a
re-aggregation of the raw G/H/N extracts for geography the normalized file
collapses).

## Temporal binning decision (30 minutes)

The brief required an explicit choice between 15/30/60-minute bins, judged on
reliable values, readable temporal change, and truthful animation:

- **15-minute bins**: off-peak frames fall below usable survey support — the
  thinnest half-hour already rests on 11 records; quarter-hours cut that in
  half, and map frames dissolve.
- **60-minute bins**: stable, but they erase exactly what the story turns on —
  the transition into the 3 p.m. surge and the boundary reversal around
  midday. The guided beats would jump hours at a time.
- **30-minute bins (chosen)**: every one of the 48 bins covering 04:00–27:59
  keeps double-digit survey-record support (min 11, peak hours in the
  thousands; total 54,535 = the F-unexp universe), and the frames animate in
  readable steps. The guided narrative lands on curated hourly beats; the
  scrubber moves in half-hour steps.

Map-frame pairs below **300 expanded trips per half-hour** are hidden from
frames — a readability floor in the tradition of the site-wide 1,000-trip
daily floor; totals never change. At 3 p.m., 11 corridors clear the floor; at
4 a.m., none do (which is itself the point of the opening beat).

## Populations, kept distinct and labelled

- **Volume curve, purpose stack, mode filters**: Query F/F-unexp — weekday
  trips by members of Durham households (1,440,145 with stated start times).
- **Boundary counters and map frames**: Queries G/H — trips starting (G) or
  ending (H) anywhere in Durham Region regardless of household residence.
  These are the only time × geography extracts; the map therefore shows
  everyone moving, not only residents. No unexpanded mirror exists for G/H,
  so map frames carry expanded values only (documented in the story's
  practitioner note).
- **Transit story**: Transit dataset, Durham households — 50,753 journeys,
  18,736 using GO rail. Station-access profiles rest on expanded values
  (N); station-to-station claims carry record support from O-unexp, with a
  display floor of 4 records per cell.

## Editorial-integrity rules carried into the stories

- Every headline number is computed at build time through a selector in
  `lib/stories/selectors.ts` (golden-pinned in `tests/data/phase4.test.ts`,
  gated in `scripts/check-artifacts.ts`) — no constants in JSX.
- "Arrive by car" never becomes "park-and-ride"; drive and drop-off access
  stay separate and are combined only under an explicit "by car" label.
- `n_route` is described as transit *links*; "transfer" is never claimed.
- The Whitby/Oshawa boarding parity (2,712 vs 2,729) is framed as parity,
  never a ranking.
- Union's 46.1% is presented as "less than half", with the denominator
  (18,734 journeys with a stated destination station) documented.
- Day-level pick-up/drop-off context (87,405 internal trips, D2) qualifies
  the afternoon-composition copy without hourly attribution — the extracts
  have no detailed-purpose × time dimension.

## Reusable interfaces (for "Every Mode Has Its Own Map")

The day map renders through `FlowScene`/`FlowFrame` (`lib/stories/types.ts`)
and `components/stories/FlowMap.tsx` — deliberately unbound to time. A future
mode-network story feeds the same renderer persistent per-mode states
(`scene.id = mode`, `category = mode`) without rewriting the engine.

## OG images

`public/og-day.png` and `public/og-transit.png` are 1200×630 screenshots of
`scripts/og/day.html` and `scripts/og/transit.html` (draft-served on a
scratch port, captured with Playwright at CSS scale). Regenerate by serving
that directory and re-capturing; the headline numbers in the drafts match the
pinned golden values.
