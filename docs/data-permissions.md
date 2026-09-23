# Data permissions record

This file records the authorization under which Durham in Motion uses
authenticated iDRS-derived data, so future maintainers do not assume the data
was scraped without permission.

## Authorization status

| | |
|---|---|
| Status | **Authorized** for use in this public application |
| Held by | Shahram (project owner), in the capacity of an authorized transportation practitioner |
| Credential holder | The project owner personally, via their own DMG iDRS account |
| Date of permission | 2026-09-23 |
| Granted by / channel | Direct permission received by the project owner from the data provider (DMG). Details of the correspondence are private; this page records only its existence, date and scope. |
| Scope | Publication of **derived, aggregated** findings from authenticated iDRS extracts of the 2022 Transportation Tomorrow Survey, within the editorial scope of this project, with attribution |

## What this permits

- Using the four iDRS extracts archived under `data/raw/idrs/` as a first-class
  production data source for the site (origin–destination flows, mode-by-
  destination contexts, the 2016-comparable 2022 mode split).
- Publishing aggregated visualizations and text derived from them — the
  pattern every chapter follows. No raw extract, verbatim matrix, or
  substantial verbatim portion is republished as a download.

## What is still required

- **Attribution** on every derived display: “Transportation Tomorrow Survey
  data via DMG iDRS, Data Management Group, University of Toronto.”
- **Provenance**: query descriptions for every extract are recorded in
  `docs/idrs-data.md` and surfaced in `public/data/manifest.json` and
  `public/data/od-flows.json` (`provenance` block).
- **Credential hygiene** (independent of permission): no username, password,
  session cookie, token, browser profile, or credentialed request header ever
  enters Git or the deployed site. `.gitignore` covers `.env*`, `cookies*`,
  `session*`, `browser-profile/`, `auth/`, `playwright/.auth/`. The deployed
  site performs no authenticated querying; ETL runs offline on the approved
  extracts only.
- If the scope of publication ever changes (e.g. redistributing the raw
  extracts themselves), confirm terms with DMG again first.
