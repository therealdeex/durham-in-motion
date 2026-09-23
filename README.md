# Durham in Motion

**A portrait of how Durham Region moves on a typical weekday — and how that story has changed.**

A public data-story website built from the Transportation Tomorrow Survey (TTS), the household
travel survey run by the [Data Management Group](https://dmg.utoronto.ca/) (University of Toronto)
since 1986. Story first, exploration second: the site opens with verified numbers, then maps, then
a community profile, then four decades of context — never the other way around.

## Quick start

```bash
npm install
npm run data:all   # manifest → fetch → normalize → geography → OD → story data → findings → inspect
npm run dev        # local dev server
npm run build      # static export to out/
npm test           # ETL invariants incl. OD golden values (suppression, crosswalk, headline numbers)
```

The public-summary pipeline is fully reproducible from public sources; raw downloads land in
`data/raw/` (gitignored) with SHA-256 checksums in `data/intermediate/checksums.json`. The four
origin–destination extracts were produced through authorized DMG iDRS access — see
`docs/data-permissions.md` and `docs/idrs-data.md`.

## What's here

```text
scripts/            ETL pipeline (TypeScript, run with tsx)
  lib/sources.ts      every public source: URL, licence, archive path
  lib/labels.ts       raw DMG category labels → canonical metric crosswalk
  lib/read-files.ts   CSV reader (geography columns, ward-header quirks, dedupe)
  lib/values.ts       "*", "N/A", "" parsing — suppression is never zero
  lib/derive.ts       profiles: mode shares, vehicle means, commute, age structure
  lib/od.ts           iDRS OD extracts: parsers, PD-code map, build-time selectors
  normalize-data.ts   → data/processed/normalized.json (97,713 records, 46 geographies)
  process-geography.ts mapshaper: DMG shapefile → simplified WGS84 GeoJSON
  build-od-data.ts    → public/data/od-flows.json (municipality flows, orbits, mode contexts)
  analyze-od.ts       → docs/od-findings.md (A–I analyses + ranked candidate findings)
  build-story-data.ts → public/data/*.json (region, trends, municipalities, wards)
  find-findings.ts    → public/data/story-candidates.json + docs/findings.md
  inspect-data.ts     validation + docs/data-inventory.md (1,452 partition checks)
components/         story chapters + visualizations (React, Tailwind v4)
lib/                build-time data loaders, formatters, story sentences, geo→SVG
public/data/        the curated JSON the browser consumes (no runtime CSV parsing)
docs/               data-inventory, findings, od-findings, permissions, methodology decisions
tests/              data-pipeline invariants incl. OD golden values (node:test via tsx)
```

## Data rules (non-negotiable)

- `*` in DMG files = suppressed (<4 survey records). Stored as suppressed, never zero, never
  reverse-engineered from totals.
- `N/A` = not collected that cycle — kept distinct from suppression and from zero.
- 2022 changed trip collection (ages 5+ vs 11+; fuller walking capture). Every 2022 trip record is
  flagged `not_comparable`; the site never puts 2022 trip counts on a line with earlier cycles.
  The one exception pattern: the comparable-basis extract (`excl2016 = 0`) is explicitly labelled
  and used only for the like-for-like 2016 ↔ 2022 comparison.
- Every displayed fact is a deterministic function of the curated JSON. OD desire lines show where
  trips begin and end — never routes; flows below 1,000 expanded trips are hidden from displays
  without ever changing a total.

## The story chapters

0. **Hero** — inlined SVG outline, no map bundle needed for first paint.
1. **Meet Durham** — four verified numbers (people, households, drivers, weekday trips).
2. **Most movement is local** — the reveal: 1.44 M trips → the Toronto assumption → **79% begin
   and end inside Durham** → Toronto in proportion. (iDRS OD data)
3. **The borders aren't where movement stops** — staged desire-line network of the eight
   municipalities; hover for exact two-way flows. (iDRS OD data)
4. **Choose your community** — each municipality's travel orbit, shareable via `?place=<id>`.
5. **Where we're going changes how we get there** — one stacked bar morphing between destination
   contexts (walk collapses, transit ×7 to Toronto). (iDRS OD-by-mode data)
6. **How We Move** — the 100-square mode-split grid.
7. **Durham Is Not One Place** — choropleth of the 8 municipalities with curated measures.
8. **Your Durham** — ward-level profile postcards.
9. **The Long View** — 1986→2022 series with methodology-break annotations, plus the
   comparable-basis block: transit 6.4% (2016) → 3.9% (2022 like-for-like).
10. **The Finding** — work-at-home share doubled 2016→2022.
11. **How to Read This** — plain-language methodology, practitioner detail on `/methodology`.
12. **Explore a Little More** — ranked-bar playground, deliberately small.

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
