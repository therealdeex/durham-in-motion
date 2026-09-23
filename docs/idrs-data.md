# iDRS data extracts (authenticated)

On 2026-09-23 we used an authorized DMG iDRS account (drs.dmg.utoronto.ca) to pull four
machine-readable extracts that the public DMG CSV downloads cannot provide. **These
extracts are used within the scope recorded in
`docs/data-permissions.md`: derived, aggregated displays with attribution. The v1
rule — *the site must not depend on authenticated access at runtime* — still holds:
ETL runs offline on the archived extracts under `data/raw/idrs/` (gitignored,
checksummed via `scripts/lib/sources.ts` → `public/data/manifest.json`); nothing in
the deployed site queries iDRS.

## Access method

Interactive query session through the iDRS web UI (Playwright-driven browser, manual
pace, a handful of queries — no bulk scraping). The UI's "Execute Query" button POSTs
a small form to `/idrs/pqxt/` whose `where` field is a JSON clause array; the last two
extracts reproduce that exact request format. Session-bound; nothing is fetchable
without login.

## The four extracts

| File | Query | Shape |
|---|---|---|
| `tts2022_od_pd_durham-residents.csv` | Cross-tab, Trip 2022, row `pd_orig`, col `pd_dest`, filter `region_hhld in 2`, expansion on | 100 origins × 103 destinations, expanded weekday trips |
| `tts2022_od_pd_durham-residents_by-mode.csv` | same + table attr `mode_prime` | 13 stacked mode blocks, `pd_orig pd_dest total` column format, numeric PD codes |
| `tts2022_mode_by-pd_durham-residents_full.csv` | row `mode_prime`, col `pd_hhld`, filter `region_hhld in 2` | 13 modes × 8 Durham municipalities |
| `tts2022_mode_by-pd_durham-residents_excl2016-0.csv` | same + `and excl2016 in 0` | 2016-comparable basis |

The first two files came from the UI's own "Save As"; the last two from reproducing
the UI's POST (the UI could not represent the two-filter clause — see caveats).
Fetch-saved files are JSON-encoded strings (decode before parsing); Save-As files are
plain text with a provenance preamble before the `Table:` line.

## Validation

- OD matrix grand total **1,440,137** trips vs curated public-CSV total **1,440,149**
  (Δ 12, ≈0.001%) — filter semantics confirmed as "Durham-resident trips".
- Full mode table reconciles with the public 2022 municipal summary mode-by-mode
  (auto driver 931,005 vs 931,006; walk 120,195 vs 120,196; transit composite
  50,755 vs 50,752).
- By-mode OD blocks sum to 1,440,128 — 9 trips short of the unidimensional matrix
  (mode-not-stated residue). Use the unidimensional matrix for totals.

## Key findings (for Phase 2 editorial work)

- **Durham is internally focused**: 1,144,111 of 1,440,137 resident trips (79.4%)
  start and end inside Durham; 77,303 (5.4%) go to Toronto's planning districts.
- **2016-comparable 2022 mode split** (excl2016 = 0): auto driver 71.7%, auto
  passenger 15.5%, walk 5.2%, transit (all three classes) 3.9%, school bus 2.4%,
  cycle 0.6% of 1,298,366 trips. The walking capture change alone accounts for most
  of the gap vs the headline 2022 shares (walk 8.3% full-basis).
- **Transit's comparable share computes to 3.9% vs 6.4% in 2016** — consistent with
  the post-2020 transit decline, and the strongest candidate for a new Long View
  chapter. Handle with the same `caution` flag as all trip-series claims (peak-window
  and wording drift documented in `data-inventory.md`).

## Caveats

1. **excl2016 is not binary in practice.** Full-basis walk (120,195) ≠ excl0
   (67,089) + excl1 (25,393); ~27,700 walking trips report neither flag. DMG's
   guidance (filter excl2016 = 0) still yields the correct comparable series, but
   never present excl0 + excl1 as the full 2022 total.
2. **The UI cannot express two `where` clauses.** Adding a second filter row through
   the form concatenated values into the first filter (`In 02`). The backend accepts
   multiple clauses as a flat array with `"and"` string tokens between objects —
   `[f1, "and", f2]`; arrays without conjunctions fail with `err: even array detected`.
3. **Numeric PD codes** in column-format output are TTS planning-district numbers
   (Durham = 17 Brock … 24 Clarington, Toronto = 1–16); **998 = External** (outside
   the surveyed area). DMG typos persist in labels (e.g. `Kawartha Lakes)`).
4. **No suppression markers** appear in iDRS output (unlike the public CSVs' `*`).
   Small cells are still small samples; apply the same <4-observation caution.
5. **Redistribution**: the extracts are authorized for this project's derived,
   aggregated displays (see `docs/data-permissions.md`). Do not republish the raw
   files themselves; re-run the documented queries instead.

## Reproduction

The queries are one-off interactive sessions, not scripted downloads — `fetch-data.ts`
deliberately does not automate the authenticated session. To reproduce: log into
drs.dmg.utoronto.ca, run the queries above (or POST the documented form to
`/idrs/pqxt/` within the session), and save with the UI's Save As. Verify against the
checksums recorded in `public/data/manifest.json`.
