# OD Data Investigation (2022 TTS Origin-Destination Matrices)

Status: **unblocked for Phase 2** — machine-readable OD data obtained via authenticated iDRS
(2026-09-23). See `docs/idrs-data.md` for the extracts, validation and caveats; the raw files
live under `data/raw/idrs/`. The PDF path below remains rejected; the iDRS path removed the
original blocker.

## What was investigated

DMG's [TTS Reports directory](https://dmg.utoronto.ca/transportation-tomorrow-survey/origin-destination-matrices-2/)
lists a **2022 TTS Origin-Destination Matrices** report. The brief asked whether its tables can be
extracted deterministically into an aggregate OD dataset (`ODFlow`-shaped) for desire-line maps.

## Findings

1. The OD matrices are published as **PDF tables** (per-region/municipality matrices by mode,
   purpose and time period), not as CSV/JSON downloads.
2. Reliable extraction would require PDF table parsing with OCR fallback. The tables use multi-level
   row/column headers that shift between report sections. We assess the error rate as incompatible
   with the project's determinism bar: every published number on this site must be traceable to a
   source file and checksum, with no manual repair.
3. The iDRS (authenticated Data Retrieval System) provides machine-readable OD data, but requires a
   registered academic/municipal account. The MVP deliberately uses only unauthenticated public data.
   **Resolved 2026-09-23**: with Shahram's iDRS account we pulled a Durham-resident PD×PD matrix
   (100×103) and a by-mode variant; both reconcile with the public trip totals (see
   `docs/idrs-data.md`). Phase 2 can build the desire-line layer on these.

## Decision

- **v1 ships without OD.** The site's data model (`scripts/lib/read-files.ts` → normalized records)
  and the architecture notes in the README leave a clean seam for a future `od-flows.json` artifact
  and a desire-line layer (deck.gl arcs), with explicit "desire lines, not observed routes" language.
- Revisit when (a) DMG releases machine-readable OD tables, or (b) an authorized aggregation is
  obtained via iDRS.

## How to re-run this investigation

1. Download the 2022 OD report PDF from the DMG reports directory.
2. Attempt deterministic extraction of one municipality-to-municipality matrix (e.g. with
   `pdfplumber` + hand-verified row/column maps for a single table type).
3. Bar to pass: an automated pipeline that reproduces 100% of a matrix's cells across two independent
   runs, with cell-level cross-checks against the report's row/column totals. Anything less stays out.
