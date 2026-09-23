# Durham in Motion

**A portrait of how Durham Region moves on a typical weekday — and how that story has changed.**

A public data-story website built from the Transportation Tomorrow Survey (TTS), the household
travel survey run by the [Data Management Group](https://dmg.utoronto.ca/) (University of Toronto)
since 1986. A short, verified narrative — five questions, each with its takeaway, denominator and
caveats — plus one coherent community explorer.

## Quick start

```bash
npm install
npm run verify       # lint → typecheck → tests → artifact gate → static build
npm run dev          # local dev server
```

Full data pipeline (public sources download automatically; the four iDRS extracts are manual
imports — see below):

```bash
npm run data:all     # fetch → manifest → normalize → geography → OD → OD findings →
                     # story data → insights → findings → artifact gate → inspect
npm run data:check   # read-only semantic gate over the committed public/data artifacts
npm test             # 70+ invariants: parsing, estimate states, OD golden values, insights
```

The public-summary pipeline is reproducible from public sources; downloads land in `data/raw/`
(gitignored) with SHA-256 checksums and byte counts in `data/intermediate/checksums.json`. The four
origin–destination extracts were produced through authorized DMG iDRS access — see
`docs/data-permissions.md` and `docs/idrs-data.md`. On a clean checkout the app builds from the
committed curated JSON without any private input; the OD steps fail with an actionable import
inventory if the extracts are absent.

## What's here

```text
scripts/            ETL pipeline (TypeScript, run with tsx)
  lib/estimates.ts    status-aware arithmetic: suppression is never zero; incomplete
                      denominators withhold ratios; lower bounds are labelled
  lib/compatibility.ts metric × cycle basis rules (1986 trips 6+, 1991–2016 11+, 2022 5+)
  lib/sources.ts      every source: URL, licence, archive path, public vs manual acquisition
  lib/labels.ts       raw DMG category labels → canonical metric crosswalk
  lib/read-files.ts   CSV reader (geography columns, ward-header quirks, dedupe)
  lib/values.ts       "*", "N/A", "" parsing — suppression is never zero
  lib/derive.ts       profiles: mode shares, vehicle means, commute, age structure
  lib/od.ts           iDRS OD extracts: parsers, PD-code map, build-time selectors
                      (destinations aggregated to display geography BEFORE ranking)
  normalize-data.ts   → data/processed/normalized.json (97,713 records, 46 geographies)
  process-geography.ts mapshaper: DMG shapefile → simplified WGS84 GeoJSON
  build-od-data.ts    → public/data/od-flows.json (8×11 matrix, orbits, disjoint mode contexts)
  analyze-od.ts       → docs/od-findings.md (analyses + ranked candidate findings)
  build-story-data.ts → public/data/*.json (region, trends, municipalities, wards)
  build-insights.ts   → public/data/insights.json (8 qualified analyses + documented gaps)
  find-findings.ts    → public/data/story-candidates.json + docs/findings.md
  build-phase3-data.ts → data/processed/phase3/normalized.json (widened iDRS extracts:
                      the travel day, boundary exchange, distance, age, vehicles, transit)
  build-phase4-data.ts → public/data/story-day.json + story-transit.json (the two
                      story pages; re-aggregates raw G/H/N extracts for time×geography
                      and station catchments — see docs/phase4-build.md)
  check-artifacts.ts  read-only semantic gate over the committed artifacts
  inspect-data.ts     validation + docs/data-inventory.md (1,936 partition checks,
                      40 ward↔municipality reconciliations)
lib/                shared client contracts: metric registry (labels/denominators/palette),
                    place-state (single ?place= URL owner), formatting, types;
                    lib/stories/ — Phase 4 story contracts, selectors, loaders
components/
  explore/            the community explorer (snapshot / destinations / map / compare panels)
  insights/           insight charts inside shared ChartFrames
  stories/            editorial primitives (StoryHero, StoryBeat, StickyVisualization,
                      MetricReveal, StoryTimeline, …), the reusable FlowMap engine,
                      and the /stories/day + /stories/transit experiences
  viz/                mode grid, morph, network map, long view, comparable basis
public/data/        the curated JSON the browser consumes (no runtime CSV parsing)
docs/               inventory, findings, od-findings, phase3 audit/findings, phase4 build notes
tests/              data-pipeline invariants incl. OD, insights and Phase 3/4 golden values
```

## Data rules (non-negotiable)

- `*` in DMG files = suppressed (<4 survey records). Stored as suppressed, never zero, never
  reverse-engineered from totals. A share whose denominator is incomplete is **withheld** (bias
  direction unknown); a partially observed numerator over a complete denominator is published as
  an approximate **lower bound**.
- `N/A` = not collected that cycle — kept distinct from suppression and from zero.
- Trip collection bases changed twice (2022 Data Guide §1.5): 1986 collected ages **6+**,
  1991–2016 **11+**, 2022 **5+** with fuller walking capture. 1986 and 2022 trip points are drawn
  as isolated markers — never connected to the 1991–2016 line. `excl2016` is defined by the guide
  as values 0/1/2; comparisons with earlier cycles use `excl2016 = 0`.
- Population scopes are distinct and always labelled: trips by Durham **households**, trips
  **originating** in a municipality, trips by a municipality's **residents**, and **all inbound**
  trips are different populations. OD destinations are aggregated to display geography (Toronto =
  all 16 planning districts summed) before ranking or truncation.
- Every displayed fact is a deterministic function of the curated JSON. Desire lines show where
  trips begin and end — never routes; flows below 1,000 expanded trips are hidden from displays
  without ever changing a total (a readability choice, not a reliability test).
- Expanded counts are estimates; the site never invents standard errors, significance or
  confidence intervals, and ranks analyses it cannot support in a documented "unavailable" list
  (`public/data/insights.json`).

## The story chapters

0. **Hero** — inlined SVG outline, no map bundle needed for first paint.
1. **Meet Durham** — four verified numbers (people, households, drivers, weekday trips).
2. **Most travel is local — but what kind of local?** — the 79% reveal, then the three-way
   composition (56.9% same-municipality / 22.5% between municipalities / 20.6% involving outside). (iDRS OD)
3. **The borders aren't where movement stops** — the desire-line network plus the concentration
   finding (top three corridors = 53.9% of intermunicipal travel). (iDRS OD)
4. **Everyday travel serves more than the commute** — purpose composition (work = 24.0%) and the
   weekday profile (Wednesday vs Friday; 1–4-day commuting).
5. **Destinations change the mode** — one bar across five disjoint contexts, then the 100-square
   region mode grid.
6. **Change was uneven** — the work-at-home divergence (Ajax tripled; Uxbridge and Scugog
   declined) and municipality-level comparable transit change (6.4% → 3.9% region-wide).
7. **Find your community** — ONE explorer: snapshot postcard, destinations, SVG choropleth map,
   rankings. Shareable via `?place=` (region / municipality / ward) with history support.
8. **The long view** — 1986→2022 series with basis breaks, plus the comparable-basis block.
9. **How to read this** — plain-language methodology, practitioner detail on `/methodology`,
   and the questions this data cannot answer (yet).

## The story shelf — `/stories/`

Two focused editorial experiences, linked from the homepage's "Keep exploring"
section (built in Phase 4 from the Phase 3 extracts; every headline number
flows through `lib/stories/selectors.ts` and is pinned in
`tests/data/phase4.test.ts`):

- **A Day in Durham** (`/stories/day/`) — one clock drives a regional map, a
  volume curve, the purpose mix and the boundary balance across a 4 a.m.–4 a.m.
  survey day in 30-minute bins. The reveal: the 3 p.m. hour (161,115 trip
  starts) outranks the 8 a.m. peak (156,056), and the boundary flow reverses
  from −15,134 (07:00) to +10,474 (17:00). After the guided beats, an explore
  mode unlocks a scrubber, play, and purpose/mode curve filters.
- **The Transit Journey** (`/stories/transit/`) — the chain from doorstep to
  destination: how riders reach transit (walk 62% of journeys system-wide),
  the station ladder of car access (Oshawa 90.8% by car, Pickering 26% walk),
  Whitby/Oshawa boarding parity, Union at 46.1% of alightings ("more than half
  end elsewhere"), sample-supported station flows, and the multi-link reality
  of GO journeys.

Architecture notes: the day map renders through the reusable `FlowScene` /
`FlowFrame` contract, so a future "Every Mode Has Its Own Map" can bind the
same engine to persistent mode-network states. Build decisions (bin interval,
display floors, population bases) are documented in `docs/phase4-build.md`.

## Attribution

Transportation Tomorrow Survey data: Data Management Group, University of Toronto. Additional
historical data: Government of Ontario. Calculations and visualizations by Durham in Motion.
This is an independent public project — not endorsed by, or affiliated with, DMG or U of T.
Sources and checksums: `/sources` and `/data/manifest.json`.

## Deployment

Static export (`out/`) — hostable on any static CDN. No database, no backend, no authenticated
data access at runtime: the OD chapters consume the pre-aggregated `public/data/od-flows.json`,
built offline from the authorized extracts.

On dev-lab2 the export is served persistently on **port 3310** (always this port):

```bash
cp deploy/durham-in-motion.service ~/.config/systemd/user/
systemctl --user enable --now durham-in-motion.service
tailscale serve --bg --https=3310 http://127.0.0.1:3310
```

Tailnet URL: `https://dev-lab2.manx-teeth.ts.net:3310/`
