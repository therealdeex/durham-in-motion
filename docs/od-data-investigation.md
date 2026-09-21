# OD Data Investigation (2022 TTS Origin-Destination Matrices)

Status: **deferred to Phase 2** — no usable machine-readable OD data in the public release.

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
