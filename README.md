# Durham in Motion

**A portrait of how Durham Region moves on a typical weekday — and how that story has changed.**

A public data-story website built from the Transportation Tomorrow Survey (TTS), the household
travel survey run by the [Data Management Group](https://dmg.utoronto.ca/) (University of Toronto)
since 1986. Story first, exploration second: the site opens with verified numbers, then maps, then
a community profile, then four decades of context — never the other way around.

## Quick start

```bash
npm install
npm run data:all   # manifest → fetch → normalize → geography → story data → findings → inspect
npm run dev        # local dev server
npm run build      # static export to out/
npm test           # ETL invariants (suppression, crosswalk coverage, golden values)
```

The data pipeline is fully reproducible from public sources; raw downloads land in `data/raw/`
(gitignored) with SHA-256 checksums in `data/intermediate/checksums.json`.

## What's here

```text
scripts/            ETL pipeline (TypeScript, run with tsx)
  lib/sources.ts      every public source: URL, licence, archive path
  lib/labels.ts       raw DMG category labels → canonical metric crosswalk
  lib/read-files.ts   CSV reader (geography columns, ward-header quirks, dedupe)
  lib/values.ts       "*", "N/A", "" parsing — suppression is never zero
  lib/derive.ts       profiles: mode shares, vehicle means, commute, age structure
  normalize-data.ts   → data/processed/normalized.json (97,713 records, 46 geographies)
  process-geography.ts mapshaper: DMG shapefile → simplified WGS84 GeoJSON
  build-story-data.ts → public/data/*.json (region, trends, municipalities, wards)
  find-findings.ts    → public/data/story-candidates.json + docs/findings.md
  inspect-data.ts     validation + docs/data-inventory.md (1,452 partition checks)
components/         story chapters + visualizations (React, Tailwind v4)
lib/                build-time data loaders, formatters, story sentences, geo→SVG
public/data/        the curated JSON the browser consumes (no runtime CSV parsing)
docs/               data-inventory, findings, methodology decisions, design notes
tests/              data-pipeline invariants (node:test via tsx)
```

## Data rules (non-negotiable)

- `*` in DMG files = suppressed (<4 survey records). Stored as suppressed, never zero, never
  reverse-engineered from totals.
- `N/A` = not collected that cycle — kept distinct from suppression and from zero.
- 2022 changed trip collection (ages 5+ vs 11+; fuller walking capture). Every 2022 trip record is
  flagged `not_comparable`; the site never puts 2022 trip counts on a line with earlier cycles.
- Every displayed fact is a deterministic function of the curated JSON.

## The story chapters

0. **Hero** — inlined SVG outline, no map bundle needed for first paint.
1. **Meet Durham** — four verified numbers (people, households, drivers, weekday trips).
2. **How We Move** — a 100-square grid of the 2022 mode split, hover/tap for detail.
3. **Durham Is Not One Place** — choropleth of the 8 area municipalities with 6 curated measures,
   deterministic comparison sentences, explicit suppressed treatment.
4. **Your Durham** — profile postcard for any of the 41 communities (8 municipalities + 33 wards),
   shareable via `?place=<id>`.
5. **The Long View** — 1986→2022 series with methodology-break annotations.
6. **The Finding** — work-at-home share doubled 2016→2022 (the survey's biggest verified move).
7. **How to Read This** — plain-language methodology, practitioner details on `/methodology`.
8. **Explore a Little More** — ranked-bar playground, deliberately small.

## Attribution

Transportation Tomorrow Survey data: Data Management Group, University of Toronto. Additional
historical data: Government of Ontario. Calculations and visualizations by Durham in Motion.
This is an independent public project — not endorsed by, or affiliated with, DMG or U of T.
Sources and checksums: `/sources` and `/data/manifest.json`.

## Deployment

Static export (`out/`) — hostable on any static CDN. No database, no backend, no authenticated
data access. The architecture leaves seams for a future OD/flow layer (`docs/od-data-investigation.md`).
