# Phase 3 data audit — widened iDRS extracts (acquired 2026-09-23)

Phase 3 acquisition ran the handoff's controlled manifest (Queries A–P plus
destination-purpose and unexpanded mirrors) against the 2022 TTS through an
authorized DMG iDRS account. **Raw outputs are preserved exactly under
`data/raw/idrs/phase3/` (gitignored, SHA-256 in
`data/processed/phase3/extractions.json`); normalized results live separately
in `data/processed/phase3/normalized.json`.** Source files are never modified
or republished; publication scope remains as recorded in
[`data-permissions.md`](data-permissions.md).

## Access method

Same as Phase 2 ([idrs-data.md](idrs-data.md)): interactive iDRS session at
manual pace. Cross-tabs POST small forms to `/idrs/pqxt/` inside the logged-in
session. Every Phase 3 query used:

```text
row=<var>&col=<var>&tbl=<var>&format=csv&rowGroups=&colGroups=&tblGroups=
&expf=expf          ← expansion ON; omit the parameter for unexpanded counts
&arrYears=2022&strType=trip|tran       ← Transit dataset type is "tran"
&where=<JSON clause array>             ← empty for no filters
```

Filter clause shape (reproduced from the UI's own POST):

```json
[{"bv":"region_hhld","qo":"in","val":{"aR":[],"aI":["2"]},"tg":false}]
```

Confirmed behaviours:

- `where=` empty — no filters. `where=[]` fails with `err: even array detected`
  (consistent with Phase 2 caveats).
- Multiple clauses join as a flat array with `"and"` strings between objects.
- Expansion OFF = omit `expf` (returns raw survey-record counts).
- With a `tbl` dimension, `format=csv` returns stacked blocks — either
  `"Table: <label>"` matrices or `TABLE : var (label)` blocks of
  `code code total` triplets (sparse, numeric PD codes).
- Responses are JSON-encoded strings; some archive paths add a second
  encoding. `decodeIdrs` (scripts/lib/phase3.ts) unwraps both.
- `trip_km` is usable directly as a row variable: it arrives as reported
  straight-line **whole km** (observed 0–6,218, including one implausible
  6,218 km trip), banded locally.
- `start_time` arrives at **reported-minute** granularity (566 distinct HHMM
  values 0400–2759), not 5-minute bins — binning is done locally.

## Query manifest and reconciliation

Reference totals: resident trip universe **1,440,137** (validated in Phase 2);
resident transit journeys **50,755** (Phase 2 transit composite); resident
OD-by-mode **1,440,128** (Phase 2 archive). Dimension residues of ±20 trips
(mode/purpose/station "not stated" records) are expected.

| ID | File (data/raw/idrs/phase3/) | Dataset | Row × Col × Table | Filters | Exp | Grand total | Reconciliation | Unknown/empty | Status |
|---|---|---|---|---|---|---|---|---|---|
| A | tts2022_od_pd_all-households.csv | Trip | pd_orig × pd_dest | none | ON | 19,470,494 | No external figure; internal checks: Durham-origin rows 1,362,248 ≥ Phase-2 resident 1,278,317; internal 1,157,095 ≥ resident internal 1,144,111 | none observed | **PASS_WITH_NOTE** (all-households population is wider than Phase 2's authorization discussion — same derived/aggregated-only publication rule applied; re-confirm with DMG if raw wider-population outputs were ever to be shared) |
| B | tts2022_od_pd_all-households_unexpanded.csv | Trip | same | none | OFF | 759,736 | Expansion factor 25.63× vs A; keys match A cell-for-cell | none | **PASS** |
| C | tts2022_od_municipality_all-households_by-mode.csv | Trip | pd_orig × pd_dest × mode_prime | none | ON | 19,470,475 | Δ −19 vs A (mode-not-stated residue) | none | **PASS** |
| D | tts2022_od_municipality_all-households_by-purpose.csv | Trip | pd_orig × pd_dest × trip_purp | none | ON | 19,470,395 | Δ −99 vs A (purpose residue) | 4 purpose blocks only (broad categories) | **PASS_WITH_NOTE** (trip_purp is broad; detailed purpose comes from D2) |
| D2 | tts2022_od_municipality_all-households_by-destination-purpose.csv | Trip | pd_orig × pd_dest × purp_dest2022 | none | ON | 19,470,424 | Δ −70 vs A | 18 detailed purpose blocks; "Voting" nearly empty (11 trips) | **PASS** |
| E | tts2022_od_pd_durham-residents_by-purpose.csv | Trip | pd_orig × pd_dest × trip_purp | region_hhld = 2 | ON | 1,440,126 | Δ −11 vs 1,440,137 | 4 broad purpose blocks | **PASS** |
| F | tts2022_time_mode_purpose_durham-residents.csv | Trip | start_time × mode_prime × trip_purp | region_hhld = 2 | ON | 1,440,145 | Δ +8 vs 1,440,137 | trips without valid start_time absent from curves | **PASS_WITH_NOTE** (times are reported minutes; bin locally) |
| F-unexp | tts2022_time_mode_purpose_durham-residents_unexpanded.csv | Trip | same | region_hhld = 2 | OFF | 54,535 | Keys match F | none | **PASS** |
| G | tts2022_time_od_departing-durham.csv | Trip | start_time × pd_orig × pd_dest | region_orig = 2 | ON | 1,362,255 | Δ +7 vs A's Durham-origin rows 1,362,248; col pd_orig limited to the 8 Durham codes by the filter | overnight survey-hours sparse (expected) | **PASS** |
| H | tts2022_time_od_arriving-durham.csv | Trip | start_time × pd_orig × pd_dest | region_dest = 2 | ON | 1,359,082 | Δ −13 vs A's Durham-destination rows 1,359,095 | same | **PASS** |
| I | tts2022_trip-distance_by-mode_durham-residents.csv | Trip | trip_km × mode_prime | region_hhld = 2 | ON | 1,440,151 | Δ +14 vs 1,440,137 | no explicit unknown-distance code; implausible outliers (≥1,000 km) banded to 40+ and excluded from editorial use | **PASS_WITH_NOTE** |
| J | tts2022_trip-distance_by-purpose_durham-residents.csv | Trip | trip_km × trip_purp | region_hhld = 2 | ON | 1,440,147 | Δ +10 | same | **PASS** |
| K | tts2022_age_by-mode_durham-residents.csv | Trip | age_range × mode_prime | region_hhld = 2 | ON | 1,440,148 | Δ +11 | native 5-year groups 05–09 … 95+; structural check: 5–14 drive share = 0 | **PASS** |
| K-unexp | tts2022_age_by-mode_durham-residents_unexpanded.csv | Trip | same | region_hhld = 2 | OFF | 54,535 | = F-unexp universe ✓ | none | **PASS** |
| L | tts2022_age_by-purpose_durham-residents.csv | Trip | age_range × trip_purp | region_hhld = 2 | ON | 1,440,147 | Δ +10 | 4 broad purposes | **PASS** |
| M | tts2022_household-vehicles_by-mode_durham-residents.csv | Trip | n_vehicle × mode_prime | region_hhld = 2 | ON | 1,440,149 | Δ +12 | native counts 0–10 grouped 0/1/2/3+ locally | **PASS** |
| N | tts2022_go-boardings_access-type_origin-pd_durham-residents.csv | Transit | go_on × tran_type × pd_orig | region_hhld = 2 | ON | 50,753 | Δ −2 vs Phase-2 transit composite 50,755 | includes "GO Rail not used" rows (local-only journeys); blocks absent for PDs with no GO usage (37 of ~131 present) | **PASS** |
| O | tts2022_go_station_od_durham-residents.csv | Transit | go_on × go_off | region_hhld = 2 | ON | 50,751 | Δ −4 vs 50,755 (station fields missing on 2 journeys) | "GO Rail not used" diagonal = 32,017 local-only journeys — excluded from station rankings | **PASS** |
| O-unexp | tts2022_go_station_od_durham-residents_unexpanded.csv | Transit | same | region_hhld = 2 | OFF | 2,158 | Pairwise support carried with station OD | many cells < 4 records — display floor required | **PASS_WITH_NOTE** |
| P | tts2022_transit_route-count_access-type_go-station.csv | Transit | n_route × tran_type × go_on | region_hhld = 2 | ON | 50,753 | = N ✓ | n_route counts links, not public-facing transfers | **PASS** |
| P-unexp | tts2022_transit_route-count_access-type_go-station_unexpanded.csv | Transit | same | region_hhld = 2 | OFF | 2,158 | = O-unexp universe ✓ | none | **PASS** |
| E-recheck | tts2022_od_pd_durham-residents_by-mode_recheck.csv | Trip | pd_orig × pd_dest × mode_prime | region_hhld = 2 | ON | 1,440,128 | **exact** match to Phase-2 archive tts2022_od_pd_durham-residents_by-mode.csv | none | **PASS** (POST-reproduction validation) |

Overall: **21 PASS / PASS_WITH_NOTE, 0 INVESTIGATE, 0 REJECT** (22 records —
E-recheck is a validation extract). A successful HTTP response was never
treated as semantic correctness: every table was reconciled against known
universes before use, and all headline claims carry unexpanded support
(mirror-run rule).

## What the pipeline builds

- `npm run data:phase3` → `data/processed/phase3/normalized.json`
  (relationships, mode/purpose flows, the travel day at native resolution,
  distance bands, age groups, vehicles, GO stations/access/links) and
  `data/processed/phase3/extractions.json` (the `IdrsExtraction` manifest with
  SHA-256, size, acquisition time per file).
- `npm run data:phase3-findings` →
  `data/processed/phase3/story-candidates.json` (deterministic story mining;
  input to editorial selection, not automatic site content).
- Golden values pinned in `tests/data/phase3.test.ts`.

## Known limitations carried forward

1. **All-households scope**: A/B/C/D/D2 include every surveyed household
   GGH-wide. Findings derived from them describe trips, not people, and never
   economic attraction (a net trip balance is not a jobs measure).
2. **"Home"-ending inbound trips** are largely Durham residents returning;
   "why people come" is computed on the non-Home remainder and labelled as
   such.
3. **Survey-record support**: expanded cell ≥ 1,000 does not establish
   adequate sample; unexpanded mirrors (B, F-unexp, K-unexp, O-unexp,
   P-unexp) travel with headline claims. Station-OD cells rest on very few
   records (e.g. Union↔Whitby: 146 records) — rankings safe, small cells not.
4. **GO station geography**: go_on/go_off identify GO rail stations only;
   for non-rail transit, DMG uses origin/destination locations as proxies.
5. **trip_km** is straight-line whole km — never routed distance, feasibility,
   or evidence that a short drive "could have been walked".
6. **n_route** counts transit links; a two-link journey generally implies a
   change but is not a "transfer" in the public sense.
7. **Credential hygiene** unchanged: no credentials, cookies, or session
   artifacts enter Git; the deployed site never queries iDRS.
