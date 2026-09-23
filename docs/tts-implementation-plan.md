# TTS implementation plan

Prepared 2026-09-23 from the [code and product audit](tts-audit-2026-09.md). Finding IDs below refer to that audit.

## Completion status — updated after the Releases 1–2 implementation (2026-09-23)

Releases 1 and 2 are **implemented**; Release 3 is prepared to the specification level. Working
state at handoff: lint, typecheck, 74 data tests, `data:check` (27 semantic artifact checks) and
the static build all pass.

| PR | Status | Notes |
|---|---|---|
| PR1 — meaning of estimates | **Done** | `scripts/lib/estimates.ts` (status-aware arithmetic: all-suppressed never numeric, partial numerator → labelled lower bound, incomplete denominator → withheld share), `scripts/lib/compatibility.ts` (1986 trips 6+ per Data Guide §1.5; excl2016 0/1/2 documented; demographics no longer claimed identical), work-at-home story replaced by tested divergence predicates (`lib/wah-story.ts`, `WorkAtHomeDivergence.tsx`), 1986 work-at-home withheld, LongView breaks lines across bases, pct-change baseline fix, commute shares moved to the complete employed denominator with labelling |
| PR2 — OD aggregation | **Done** | Toronto PDs aggregated before ranking (Pickering 20,682 / 12.2%, unique keys), full aggregated `destinations` distribution + display slice, public matrix 8×11 with explicit `rowIds`/`columnIds`, five disjoint mode contexts + combined comparison kept separate, `getRegionTravelProfile`/`getLocalComposition`, `docs/od-findings.md` regenerated with corrected columns and the Toronto-vs-elsewhere claim reversed to the correct direction (77,303 / 6.05% vs 56,903 / 4.45%) |
| PR3 — interactions & refresh | **Done** | Single `?place=` owner (`lib/place-state.ts` + `lib/use-place.ts`; region/municipality/ward validation, anchors + params preserved, Back/Forward via popstate, push for user actions), ModeMorph timer cancels on interaction/unmount, NetworkMap defaults to the full network (reduced motion never hides data) and community filtering works in the final state with keyboard-focusable arcs, pipeline split public/manual (`acquisition` field, inventory for missing imports, clear failure before writes, validated downloads with byte counts), `data:check` gate, `data:all` order fixed (fetch first), ESLint configured noninteractively |
| PR4 — presentation & narrative | **Done** | `lib/metrics.ts` registry (canonical mode labels/palette; per-metric denominator phrasing), `ChartFrame` with takeaway/scope/table/source/caveats, waffle uses largest-remainder apportionment (exactly 100 squares), MapLibre choropleth replaced by a keyboard-accessible SVG choropleth, one `CommunityExplorer` (snapshot/destinations/map/compare) replaces the orbit + map + postcard + ranking chapters with legacy anchors kept, mobile chapter nav added, labels unified ("Car driver/Car passenger/Walk/Cycle"), display floor enforced on lists with hidden-count disclosure |
| PR5 — stronger analyses | **Done** | `public/data/insights.json` with 8 qualified insights (local-vs-cross 56.9/22.5/20.6; concentration 53.9%; mode-by-destination disjoint; purpose with +2-trip reconciliation note; weekday + frequency; work-at-home divergence; comparable municipal transit with Brock withheld; demographic context) + a documented "unavailable" list (joint demographics, routes/times/emissions, inbound travel, reliability) — golden values asserted in `tests/data/insights.test.ts` |
| PR6 — acquisition | **Specified** | `docs/acquisition-manifest.md` records the Q01–Q08 query specs, the import contract and the selection order; nothing requested or imported; the existing four-extract authorization was not reopened |
| PR7 — service context | **Not started** | DRT/GO GTFS + ridership series remain future work per the plan table |

Known remaining items (tracked, not blocking): browser-regression automation lives in the manual
verification pass rather than the repo test suite; a deliberate CSS/contrast design pass over the
light theme; PR6/PR7 execution awaits an explicit instruction and any scope check against
`docs/data-permissions.md`.


## Outcome and release order

Deliver a trustworthy public explanation of how Durham moves, backed by a coherent community explorer and reproducible analytical outputs. Keep the existing Next/React static-export architecture unless a concrete requirement exceeds it. Do not start with a framework migration or a replacement data platform.

| Release | Scope | Completion criterion |
|---|---|---|
| 1 — Trust and function | PR1–PR3 | No known materially false claims, correct OD grouping, preserved estimate states, usable selectors and reduced motion, reproducible checks |
| 2 — Coherent experience | PR4–PR5 | Shared metric/chart contracts, one community workflow, five or more qualified insights using existing sources |
| 3 — Deeper evidence | PR6–PR7 | Documented targeted extracts and a separate dated service/context layer; only supported analyses published |

Dependency order: PR1 → PR2 → PR3 → PR4 → PR5. Acquisition specifications can be prepared alongside Release 1; importing and publishing them follows the data contracts. Rough scope for one experienced implementer: 3–6 focused days for Release 1, 5–9 for Release 2, and 4–10 for an initial Release 3 excluding provider access and review. These are planning estimates; revise after the first PR, especially if fresh extracts change conclusions.

## PR1 — Restore the meaning of the estimates

Addresses A01, A04, A05, and the denominator/status parts of A08. Primary files: `scripts/lib/derive.ts`, `scripts/lib/read-files.ts`, `scripts/lib/labels.ts`, `scripts/build-story-data.ts`, `lib/types.ts`, `lib/format.ts`, `app/methodology/page.tsx`, `components/story/SurprisingStory.tsx`.

1. Introduce a shared analytical contract used by ETL and presentation. It can be plain TypeScript plus explicit runtime validators; a schema library is optional. Maintain a small set of well-defined structures rather than a generic query engine.
2. Preserve source states through aggregation and division. Define aggregation membership per metric and cycle. Distinguish absent/not-collected categories from suppressed and missing cells. Validate finite, nonnegative values and nonzero denominators.
3. Carry both endpoints and their states in historical comparisons. Compute change only for permitted pairs. Percent change requires a nonzero **baseline**; `build-story-data.ts` currently checks the current value instead. Use percentage points for differences between shares.
4. Replace unconditional copy with computed predicates. Correct the work-at-home story immediately. Delete unsupported superlatives and cross-universe comparisons. Surface 2022 as a survey snapshot, never “today.”
5. Create a small metric/cycle compatibility table and apply audit A05's source corrections. Check the archived CSV preambles before assigning historical age bases. Retain explicit caution for harmonized comparisons. Update the affected methodology text and generated templates together.
6. Preserve the source-specific 12-trip and 9-trip reconciliation differences as metadata; do not force different extracts to match exactly or label the causes more confidently than validated.

Suggested contract (illustrative; refine with the first implementation):

```ts
type EstimateStatus =
  | 'observed' | 'suppressed' | 'not_available' | 'missing' | 'partial';

interface Estimate {
  value: number | null;
  status: EstimateStatus;
  metricId: string;
  geographyId: string;
  surveyYear: number;
  basisId: string;
  numerator?: { value: number | null; status: EstimateStatus };
  denominator?: { value: number | null; status: EstimateStatus; label: string };
  sourceIds: string[];
  quality: {
    completeness: 'complete' | 'incomplete' | 'unknown';
    reliability: 'not_assessed' | 'eligible' | 'withheld';
    supportCount?: number; // optional; never substitute expanded count
    noteIds: string[];
  };
}

interface MetricDefinition {
  id: string;
  label: string;
  unit: 'trips' | 'persons' | 'households' | 'share' | 'ratio';
  universe: string;
  denominatorLabel?: string;
  numeratorDefinition: string;
  geographyBasis: 'residence' | 'origin' | 'destination';
  period: string;
  permittedBasisIds: string[];
  precision: number;
  limitations: string[];
}
```

Keep reliability separate from availability: an observed expanded value may still have unknown statistical support. Do not expose confidential support counts merely because the private contract can hold them. Source rules determine what is public.

**Acceptance:** real/synthetic fixtures cover all-suppressed aggregates, absent categories, unknown denominators, valid zero, zero baseline, and mixed states. All-suppressed inputs never produce a numeric zero. Every displayed share names its population/denominator. Tests demonstrate the work-at-home increase/decrease predicates on Ajax, Uxbridge, and Scugog. Historical tables retain status and line charts break across unavailable points.

## PR2 — Correct OD aggregation and qualify its scope

Addresses A02, A03 and OD parts of A08. Files: `scripts/lib/od.ts`, `scripts/build-od-data.ts`, `scripts/analyze-od.ts`, `lib/types.ts`, `TravelOrbit.tsx`, `ModeMorph.tsx`, `NetworkMap.tsx`.

1. Aggregate destinations by stable display geography before sorting. Preserve a complete private analytical distribution; export only the approved curated distribution needed by charts. Generate top-N displays from that distribution.
2. Separate the three population scopes: trips by Durham-household members anywhere; those trips originating in a particular municipality; trips by that municipality's own households. Explicitly label every selector and chart. Current origin profiles support the second scope, not the third.
3. Define disjoint OD contexts: same municipality, another Durham municipality, Toronto, elsewhere in survey area, outside survey area. Retain “all internal Durham” as an optional combined comparison, not an additional slice in the same composition.
4. Export `rowIds`, `columnIds`, labels, and populated values. Use eight origin rows for the current public matrix. Delete fabricated zero rows. Generate the report from the same selectors; correct column headers and external inclusion.
5. Consolidate all display thresholds in metadata. Apply the rule to visible lists/maps consistently, show hidden connection count if useful, and always calculate totals from complete valid data. A display floor is not disclosure protection or a sample-reliability test.
6. Replace numeric-code inference by marginal-total matching with a versioned authoritative code crosswalk after validating the relevant geography table. Keep reconciliation as a check, not as the identity join. Fail on unknown or ambiguous codes.
7. Turn the false outside-versus-Toronto candidate into a correct comparison or remove it. Do not infer homebound journeys from destination direction alone, or all inbound activity from a resident-filtered extract.

**Acceptance:** Pickering has exactly one Toronto destination, 20,682 trips; its list and orbit agree at 12.2% before presentation rounding. No duplicate keys. Every matrix row reconciles to its origin total and column semantics are tested. Nonoverlapping contexts sum to their appropriate universe within explicit rounding tolerances. A threshold change does not change totals. Brock no longer contradicts the stated display-floor policy. Tests cover exported artifacts and report claims, not only internal functions.

## PR3 — Make interactions and data refresh dependable

Addresses A06, A07, A09. Files include `lib/hooks.ts`, the three community selectors, `ModeMorph.tsx`, `NetworkMap.tsx`, `package.json`, `scripts/fetch-data.ts`, `scripts/build-manifest.ts`, `scripts/inspect-data.ts`, and CI/test configuration.

Interaction work:

- Implement one URL-state owner with parsing, validation, subscriptions, and serialization. Suggested fields: `place`, `metric`, `basis`, `view`; preserve anchors and unrelated parameters.
- Define region/municipality/ward behavior. For a ward, show its parent municipality's OD context with an explicit label or keep the OD section unavailable. Never pretend there is ward OD data.
- Support direct links, refresh, Back/Forward, and invalid query values. Use readable user actions to push history; transient changes may replace it.
- Cancel animation timers on input and unmount. Respect preference changes. Reduced motion must reveal the complete data immediately. Fix network filtering after the final reveal.

Pipeline work:

- Split public HTTP sources from manual authenticated imports in source metadata. Missing authenticated files produce an actionable import inventory, not an attempted homepage download. Validate file structure before acceptance.
- Correct order: acquire/import → validate raw → normalize/geography → derive OD/story/findings → validate outputs → write final manifest/build metadata → publish artifacts. Run OD findings as part of the complete generation workflow.
- Add a refresh option and explicit checksum-change reporting; record actual byte counts. Use temporary/staging outputs and replace the final set only after successful validation.
- Supply `data:check` as a read-only gate and a semantic freshness check that ignores generation timestamps. Document app-only builds from committed curated JSON separately from full ETL reproduction with private local inputs.
- Make tests portable: small synthetic/public fixtures for parser and contract tests; private extract integration tests opt in when available. Never commit raw authenticated matrices as fixtures. Run complete integration tests in the authorized local environment before release.
- Configure a real noninteractive lint command compatible with the installed stack, and add type/test/build gates. Keep the lockfile authoritative; a broad dependency upgrade is outside this PR.
- Add the missing meaningful partition checks, with explicit counts for run, skipped, warning, and failed checks. Do not claim ward/municipality reconciliation if no same-cycle municipality total was actually compared.

**Acceptance:** clean app checkout builds from committed artifacts; public-only acquisition works without credentials; absent manual inputs fail clearly before final writes; unchanged inputs regenerate equivalent semantic content. A deliberate invalid input leaves previous final artifacts intact. Tests cover Whitby orbit → postcard/map synchronization, `place=durham`, ward links, anchor retention, history, manual destination selection surviving the timer, and visible reduced-motion connections. Lint/test/typecheck/build all exit noninteractively.

## PR4 — Standardize presentation and shorten the narrative

Addresses A08–A10. Preserve the current visual identity while making repeated information use shared components.

Create a common `ChartFrame` (question/title, takeaway, scope/year/basis, graphic, table toggle, source/definition, caveats), `MetricValue`, `EstimateNote`, `ComparisonBadge`, and `SourceDisclosure`. Use one mode palette/order/label mapping and one metric registry. Components consume presentation-ready analytical results rather than recomputing shares.

| Element | Presentation rule |
|---|---|
| Counts | Rounded compact estimate in editorial text; full source precision in tables, labelled as estimates |
| Shares | One decimal by default; same precision for comparable values within a chart |
| Share changes | Signed percentage points; relative change only when explicitly labelled |
| Ratios | Two decimals where useful; include denominator/unit |
| Partial or suppressed | Visible text status, explanation, and a nonnumeric graphic state; never silently rank as exact |
| Very small observed shares | Use a suitable `<0.1%` label if a 0.0% display would imply none; retain exact table value |
| Chart domains | Consistent for peer comparisons; automatic limits must include benchmark and explain clipping if used |
| Waffle | Document apportionment when complete; use an alternative bar/table when incomplete rather than reallocating unknown observations |
| Trends | Full years in tables; visible gaps for unavailable observations and annotations tied to the selected metric |

Proposed landing narrative:

1. **Most travel is local — what kind of local?** Disjoint same-municipality/cross-municipality/outside composition.
2. **Everyday travel serves more than the commute.** Purpose and weekday context.
3. **Destinations reveal different mode choices.** Same municipality versus another Durham municipality versus Toronto.
4. **Change was uneven.** Comparable transit and work-at-home municipality differences, with basis controls.
5. **Find your community.** One route into the richer explorer, plus an accessible concise methodology link.

Consolidate orbit, map, postcard and rankings into one community workspace with tabs or panels for overview, destinations, mode/purpose, and change. Route structure is flexible; retain existing shared links or provide compatible redirects/query parsing. Do not require every section to mount a heavy interactive map.

Accessibility/responsiveness requirements: plain buttons or fully implemented tabs; touch and keyboard equivalents; visible focus; useful tables for all charts; 320/390/768/1440 px checks; essential mobile text at readable CSS size, typically at least 12 px; adequate contrast; reduced motion; map load failure; and no reliance on horizontal clipping to hide layout defects. Prefer an SVG choropleth for eight static municipalities if its functionality satisfies the design.

**Acceptance:** the same metric has identical label, value, precision, status, denominator and source across overview, map, ranking and export. Current waffle truncation is eliminated. Ranked/unknown communities remain discoverable. Visual snapshots and browser tests cover the affected states, not just the initial page. The release explains more with fewer duplicate chapters.

## PR5 — Publish stronger analyses from existing data

Build small pure selectors and a generated `insights.json` with IDs, input metric references, formulas, values, eligibility, comparison basis, caveats, and source IDs. Keep human editorial selection, but every numeric and directional claim must refer to an eligible calculation. Do not rank candidate stories solely by effect size: geographic relevance, denominator completeness, comparability, uncertainty, and readability matter.

Initial analytical backlog, in implementation order:

| Analysis | Required inputs | Deliverable / acceptance |
|---|---|---|
| Local versus cross-municipality | Existing complete OD matrix | Mutually exclusive composition reproduces the audit's 56.9% / 22.5% / 20.6% |
| Concentration of intermunicipal flows | Existing pairs | Top-three share uses intermunicipal total, never all trips; explicit OD relationship caveat |
| Mode by disjoint destination | Existing OD mode blocks | Same vs other municipality vs Toronto with counts and shares; parent combined context clearly identified |
| Purpose | Resident all-day summary records | Categories preserve source definitions and account for the observed two-trip rounding discrepancy |
| Weekday commuting / frequency | Person commute-day and commute-frequency records | Separate multiresponse weekday counts from the mutually exclusive frequency distribution; excluded populations visible |
| Work-at-home geography | Same-cycle employed measures and 2016/2022 profiles | Both endpoint values, signed pp change and coverage; no “everywhere doubled” |
| Comparable municipality transit | Existing municipality `excl2016=0` mode table and 2016 summaries | Preserve municipality resolution, retain source differences, show absolute and share changes |
| Transit journey details | Routes, access/egress, service-use summaries | Each breakdown gets its actual universe; overlapping services never drawn as exclusive slices |
| Demographic / vehicle context | Person and household histories | Describe community associations; no inferred individual joint behaviour or claim that top-coding bias is equal |

**Acceptance:** ship at least the first five alongside the corrected existing change story. Each has a definition, formula, coverage and comparable basis, a readable chart/table, and meaningful selector tests. Distinguish “observed descriptive difference” from “statistically reliable difference.” Add an analysis coverage matrix showing which questions remain unavailable and why.

## PR6 — Acquire targeted aggregate data

Prepare the query manifest and importer before requesting data. This plan does not authorize sending requests or messages on the user's behalf. Existing project permission for the four extracts remains in force; check whether additional extracts fall within it without reopening settled authorization unnecessarily.

Every extract specification must record: ID, source/provider, exact dataset/version and survey cycle, unit of observation, population/age filters, geography of household/origin/destination, dimensions and category dictionary, time period, weight/expansion setting, handling of unknown and external codes, paired support query, expected reconciliations, permission scope, retrieval date, checksum, and public aggregation policy. Verify exact iDRS variable names in its dictionary; do not invent executable field names from the conceptual specs below.

| ID | Proposed query and scope | Output / decision unlocked | Validation / limitation |
|---|---|---|---|
| Q01 | Same existing four tabulations, expansion off; request any supported reliability/disclosure guidance | Sample support for current OD/mode aggregates | Keys/filters match expanded tables. Clarify whether support is trips, persons or unique households; design uncertainty needs more than nominal n. |
| Q02 | All survey households; origin or destination in Durham; PD origin × PD destination; broad purpose and AM/PM/all-day exports | Inbound activity, outbound activity, and internal trips beyond resident-only scope | Preserve origin-only, destination-only and both-inside partitions; do not add overlapping query totals. Excludes people outside the survey's population frame. |
| Q03 | Durham households; household municipality × primary mode × broad purpose × period | Which kinds of trips carry the mode gap? | Begin with coarse categories; totals reconcile to resident full-basis tables. Export support alongside weighted counts. |
| Q04 | Durham-household trips; mode × distance bands × broad purpose, optionally household municipality | Short motorized-trip opportunities as a screening measure | Use documented distance measure; validate sentinel/unknown values. Straight-line distance is not routed distance, feasibility, or automatically replaceable travel. |
| Q05 | Separate household/person/trip tabulations with their own weights: vehicle availability × coarse income; travel outcomes × vehicle availability/age | Actual joint measures of mobility resources and travel | Never divide trip rows by household totals without an explicit designed rate; coarse bins and provider-approved disclosure rules. |
| Q06 | 2016 and harmonized 2022; same population/geography/dimensions, broad purpose × mode × period | Comparable change beyond region-wide mode share | Matched windows and populations; fixed geography; preserve basis restrictions and report remaining incompatibilities. |
| Q07 | Person-based zero-trip indicator and trip counts with age/vehicle access, if available | Mobility participation, including people absent from trip tables | Needs persons who made no trips; cannot infer them from a trip-only extract or household-total residual. |
| Q08 | Person commuting location/frequency plus relevant categories, or transit route/access aggregates where useful | Distinguish usual workplace from actual commute frequency; understand transit access | Separate descriptive evidence from a causal explanation of remote work or transit use. |

Q01 and Q03 are the first acquisition batch. Q02 follows when inbound analysis is desired. Q04–Q08 should be selected by editorial value and support availability, not requested indiscriminately. Avoid ultra-fine ward/zone × demographic cubes that will mostly be sparse.

A rejected or unavailable extract is a recorded limitation, not permission to infer the missing table. Missing provider design information means “uncertainty not estimated”; do not manufacture confidence intervals from expanded counts. Do not reverse-engineer suppressed observations from parent/child totals.

## PR7 — Add service context and a dated update layer

Use the official source links and availability checks in the audit. Start with DRT/GO schedules and a small operational ridership/service series; postpone complex accessibility routing until those sources and geographies are validated.

| Source | Collection specification | Join/use | Acceptance |
|---|---|---|---|
| DRT + GO GTFS | Versioned zip, service validity dates, agency timezone, stops/routes/trips/stop_times/calendar/calendar_dates and applicable frequency rules | Scheduled departures, span and transfer opportunities; spatial join stops to verified geography | Correct service exceptions and times beyond 24:00; distinguish timetable service from actual performance. Seek 2022 archives for historical comparisons; label current schedules separately. |
| Agency operational reports | Monthly/annual ridership and service hours, units, period, revision notes and service disruptions | Separate post-2022 context panel | Boardings versus linked journeys and calendar/fiscal periods explicit. No arithmetic splice to TTS mode share. |
| Census | Stable geographic IDs, vintage-specific boundaries, population universe, age, income, dwelling and other selected context | Municipality comparison first; population-weighted small-area joins later | Durham CD/CSD coverage verified; no silent assignment of Oshawa CMA to all Durham. 2021 conditions labelled as 2021. |
| Networks and destinations | Dated foot/cycle links, crossings/barriers, facilities and station entrances | Later: network-based catchments/accessibility | Record completeness; no estimate of population access from municipality centroids. Distinguish simple buffer screening from routed access. |

For a later accessibility analysis, define travel budget, departure window, walking speed, transfer assumptions, destination inventory, population weighting and sensitivity checks before coding. Label it modelled access, not observed TTS travel. Do not infer precise emissions or potential mode shift from municipal desire-line lengths.

## Release checklist

- All P0 findings resolved; remaining P1 findings tracked explicitly with user impact.
- Metric/source contracts validated at build time; generated artifacts and docs match source hashes.
- Arithmetic and narrative assertions tested on actual fixtures and adversarial missingness cases.
- Relevant public and authorized private integrations reconcile with documented tolerances.
- Typecheck, configured lint, unit/data tests, browser regressions, static build pass.
- Desktop/mobile, touch/keyboard, reduced motion, shared-link/history and load-failure behavior reviewed.
- Every claim has scope, date, denominator, basis, availability and source trail; all new-source limitations visible where needed.
- No raw private extracts, credentials or unsupported derived disclosure enter public artifacts. Existing authorized aggregate publication continues.
- Final handoff states what changed, validation results, new insights shipped, and any acquisition still unavailable. No silent declaration of completion for unavailable data.
