# Data provenance record

This file records how Durham in Motion uses data derived from the
Transportation Tomorrow Survey (TTS) accessed through the DMG iDRS system
(drs.dmg.utoronto.ca).

## Data access

- TTS 2022 data was obtained through the standard iDRS web query interface
  under an authorized iDRS account, using ordinary interactive queries at
  manual pace. No bulk scraping was performed.
- Data access and use of the iDRS system is in accordance with the iDRS
  terms of service.

## What this site publishes

- Only **derived, aggregated** findings: summarized origin-destination flows,
  mode-share comparisons, and related visualizations.
- No raw extract, verbatim matrix, or substantial verbatim portion of the
  source data is published or downloadable.
- Query provenance is recorded in `docs/idrs-data.md` and surfaced in
  `public/data/manifest.json` and `public/data/od-flows.json` (the
  `provenance` block).

## Attribution

Every derived display includes: "Transportation Tomorrow Survey data via
DMG iDRS, Data Management Group, University of Toronto."

## Credential hygiene

No username, password, session cookie, token, browser profile, or
credentialed request header enters Git or the deployed site. `.gitignore`
covers `.env*`, `cookies*`, `session*`, `browser-profile/`, `auth/`,
`playwright/.auth/`. The deployed site performs no authenticated querying;
ETL runs offline on the archived extracts only.

## Scope changes

If the scope of publication ever changes (e.g. redistributing raw extracts
or substantially verbatim source material), terms should be re-confirmed
with DMG first.
