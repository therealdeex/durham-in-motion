# Acquisition manifest — targeted aggregate extracts (Release 3 prep)

Prepared 2026-09-23 from the [implementation plan](tts-implementation-plan.md) PR6 and the
[audit](tts-audit-2026-09.md). **Status: specifications only — nothing has been requested or
imported.** The existing four extracts remain authorized and in production
([permissions record](data-permissions.md)); each new extract below must be checked against that
authorization scope before it is pulled. No message is sent to any provider without an explicit
instruction from the project owner.

## Import contract (applies to every extract)

Each manually imported file lands under `data/raw/idrs/`, is declared in
`scripts/lib/sources.ts` with `acquisition: "manual"`, and must provide:

| Field | Recorded where |
|---|---|
| ID, provider, exact dataset/version and survey cycle | `sources.ts` entry + this manifest |
| Unit of observation (trip / person / household) | this manifest |
| Population and age filters (exact variable values) | this manifest |
| Geography of household / origin / destination (variable names) | this manifest |
| Dimensions and category dictionary | this manifest |
| Time period (all-day / AM / PM) | this manifest |
| Weight/expansion setting | this manifest |
| Handling of unknown and external codes | this manifest |
| Paired support query (unexpanded count), when available | this manifest |
| Expected reconciliations (tolerances) | this manifest + a golden-value test |
| Permission scope | `docs/data-permissions.md` (extend only if required) |
| Retrieval date, SHA-256 | `data/intermediate/checksums.json` → `public/data/manifest.json` |
| Public aggregation policy (what may be displayed) | this manifest |

Pipeline behaviour on import (already implemented): manual sources are never fetched
automatically; absent files produce an actionable inventory; OD-dependent steps fail with a clear
message **before** writing any public artifact; downloads/imports are checksummed and byte-counted;
`data:check` gates the committed artifacts. Raw extracts are never committed and never republished
verbatim — only derived, aggregated displays with attribution.

**Rule: verify exact iDRS variable names in the iDRS dictionary before running a query.** The
field names below are the conceptual specs from the audit; none has been executed.

## Query manifest

### Q01 — unexpanded support for the existing four tabulations (first batch)

- **Purpose:** distinguish readable flows from estimates supported by adequate samples; qualify
  rankings. Expanded flow ≥ 1,000 does not establish ≥ 4 observations.
- **Query:** the same four tabulations as [idrs-data.md](idrs-data.md) with expansion **off**
  (raw record counts); plus any provider reliability/disclosure guidance available.
- **Reconciliation:** keys and filters must match the expanded tables cell-for-cell.
- **Limitations:** clarify whether support counts trips, persons or unique households; nominal n
  alone does not provide survey-design confidence intervals. Uncertainty stays "not estimated"
  until provider guidance exists.

### Q02 — OD involving Durham from all surveyed households (second batch)

- **Purpose:** separate residents' movements from inbound workers/visitors; describe destinations
  honestly (current extract covers Durham-household trips only).
- **Query:** no household-region filter; origin **or** destination in Durham; PD origin × PD
  destination; broad purpose and AM/PM/all-day exports.
- **Reconciliation:** preserve origin-only, destination-only and both-inside partitions; do not
  add overlapping query totals.
- **Limitations:** excludes people outside the survey's population frame; authorization scope for
  this wider population must be confirmed first.

### Q03 — household municipality × primary mode × broad purpose × period (first batch)

- **Purpose:** identify which kinds of trips carry the mode gap.
- **Query:** Durham households; coarse categories to control sparse cells; export support
  alongside weighted counts.
- **Reconciliation:** totals must reconcile with the resident full-basis tables.

### Q04 — mode × distance bands × broad purpose

- **Purpose:** short motorized-trip opportunities as a screening measure.
- **Query:** Durham-household trips; documented distance measure; sentinel/unknown values
  validated.
- **Limitations:** straight-line distance is not routed distance, feasibility, or automatically
  replaceable travel.

### Q05 — designed joint demographic cross-tabs

- **Purpose:** actual joint measures of mobility resources and travel (the marginal-table boundary).
- **Query:** separate household/person/trip tabulations with their own weights: vehicle
  availability × coarse income; travel outcomes × vehicle availability / age.
- **Limitations:** never divide trip rows by household totals without an explicit designed rate;
  coarse bins and provider-approved disclosure rules.

### Q06 — 2016 and harmonized 2022 purpose × mode × period

- **Purpose:** comparable change beyond region-wide mode share.
- **Query:** matched windows and populations; fixed geography; same dimensions both cycles;
  preserve basis restrictions (excl2016 = 0 family for 2022).

### Q07 — person zero-trip indicator and trip counts

- **Purpose:** mobility participation, including people who make no trips.
- **Limitations:** requires persons who made no trips; cannot be inferred from a trip-only extract
  or a household-total residual.

### Q08 — commuting location/frequency and transit access aggregates

- **Purpose:** distinguish usual workplace from actual commute frequency; transit access detail.
- **Limitations:** descriptive evidence only — not a causal explanation of remote work or transit
  use.

## Selection order

Q01 and Q03 form the first acquisition batch (they sharpen analyses the site already publishes).
Q02 follows when inbound analysis is desired. Q04–Q08 are selected by editorial value and support
availability, not requested indiscriminately. Avoid ultra-fine ward × demographic cubes that would
mostly be sparse. A rejected or unavailable extract becomes a recorded limitation
(see the "unavailable" block in `public/data/insights.json`) — never a licence to infer the missing
table or to reverse-engineer suppressed cells.
