# TTS product and code audit

Audited 2026-09-23. Companion documents: [implementation plan](tts-implementation-plan.md) and [implementation handoff](tts-handoff-prompt.md).

## Assessment

The site has a useful foundation: archived sources, provenance, normalized records, a static deployment, clear visual identity, and several worthwhile stories. The main problem is the gap between that foundation and what readers actually see. Derived values lose their qualifications, editorial statements are not checked against their predicates, different components implement their own meanings and formatting, and animation/state bugs make interactions unreliable.

There is enough existing data for a substantially better product. Prioritize correctness, then build a shorter narrative with a coherent community explorer. Adding more chapters to the current page would amplify its duplication.

This audit changes documentation only. **Update 2026-09-23 (later the same day): Releases 1 and 2 of the companion plan are now implemented** — A01–A10 are addressed and the verified insight candidates below are shipped as computed analyses; see the completion-status table in the [implementation plan](tts-implementation-plan.md).

## What was checked

- Read the ETL, normalized records, curated JSON, source/permission documentation, story components, visualizations, methodology, and tests.
- Confirmed 97,713 normalized records, eight survey cycles, 34 current survey wards, and 21 manifest entries, including four local iDRS extracts.
- Ran `npm test`: **33/33 passed**. Ran `npm run typecheck`: **passed**. Ran `npm run build`: **passed**, using locally installed Next.js 15.5.25.
- Ran `npm run lint`: **failed as an unattended check**; it opens the ESLint setup prompt and exits 1. There is no configured lint gate.
- Used headless Chrome/Playwright against the static export on port 3310. Inspected desktop at 1440 px and mobile at 390 px; checked explorer overflow at 320 px. Reproduced the interaction defects below. No page errors were observed during those smoke checks; the WebGL map loaded successfully.
- Read DMG's official data guide and checked official external data sources. The full download pipeline was **not** rerun: it rewrites artifacts and has the clean-checkout problems described below. No authenticated queries or external messages were sent.

Passing tests currently establishes a subset of parser and numerical invariants. It does not establish correct claims, complete output validation, accessible interactions, or data-refresh reproducibility. Browser checks were targeted smoke tests, not a complete accessibility or browser-compatibility audit.

## Findings requiring correction

Priority definitions: **P0** = materially wrong displayed facts or loss of statistical meaning; **P1** = broken interaction, unreliable generation, or important interpretability defect; **P2** = presentation and maintainability improvements. “Confirmed” below distinguishes actual output/browser observations from code-path risks.

### A01 — P0: the work-at-home story contradicts its own chart

**Evidence:** `components/story/SurprisingStory.tsx:95` onward asserts that every municipality roughly doubled and that no other measured travel behaviour changed as quickly. Its own input produces:

| Geography | 2016 | 2022 | Interpretation of point estimates |
|---|---:|---:|---|
| Durham | 7.2% | 14.1% | Nearly doubled |
| Ajax | 5.4% | 17.8% | More than tripled |
| Uxbridge | 13.9% | 12.0% | Declined |
| Scugog | 12.4% | 11.6% | Declined |

Confirmed from curated JSON and the rendered page. The universal claim is false; the superlative has no supporting scan. Comparing work-at-home as a share of employed people with transit as a share of trips also supplies no meaningful common ranking.

**Fix:** show the regional change and geographic divergence, carry estimate status through both years, and generate statements from tested predicates. Do not infer statistical significance or causality from these point estimates. Store the prior-year estimate explicitly instead of reconstructing it with `value - (change ?? 0)`.

### A02 — P0: Toronto destinations are relabelled but not aggregated

**Evidence:** `scripts/lib/od.ts:390` maps each Toronto PD to the same `destinationId: "toronto"` but pushes separate entries. `getMunicipalityOriginProfile()` sorts those entries; `scripts/build-od-data.ts` truncates to eight and `TravelOrbit.tsx:163` to six.

Confirmed in the browser: Pickering's destination list says **Toronto: 3,973 trips / 2%**, while its actual Toronto aggregate is **20,682 / 12.2%**. The first is one PD masquerading as the city. Toronto's position in the ranking is wrong, and duplicate IDs can reach React keys.

**Fix:** group at the displayed geographic level, sum, then sort and truncate. Maintain separate fields for full analytical distributions and display lists. Test list/segment reconciliation and uniqueness. Use the complete distribution for map lines and narrative predicates.

### A03 — P0: generated OD analysis contains wrong columns and a reversed conclusion

**Evidence:** `scripts/analyze-od.ts:90` labels a column “Beyond” but writes `originTrips` into it at line 100. Its Toronto cell uses `.find()` on the unaggregated destinations, repeating A02. `getModeComposition(... destination: "outside")` excludes external code 998, while the report labels its result as including travel beyond the survey area.

At lines 259 and 329–334, “Elsewhere outside Durham is bigger than Toronto” uses `1 - internalShare - toToronto / allTrips`, mixing trips starting anywhere with Durham-origin trips. Actual Durham-origin totals are **56,903 to places outside Durham/Toronto**, versus **77,303 to Toronto**. The report's 15.2% is not the claimed outbound share; the correct shares of 1,278,317 Durham-origin trips are **4.45%** and **6.05%** respectively.

Also, the public `od-flows.json.matrix` is allocated as 11 × 11 but fills only Durham origin rows. Its last three rows are zeros for origins not included in the export, rather than actual observations.

**Fix:** use explicit row and column identifiers; publish an actual 8 × 11 origin matrix or populate every documented row. Use common analytical selectors for report and website. Add tests for column meanings, outside/external inclusion, and claim direction. These report errors do not invalidate the independently tested 79.44% regional internal share.

### A04 — P0: derived metrics lose missingness and suppression semantics

**Evidence:** `scripts/lib/derive.ts:22` converts every non-observed record into `null`; `share()` calls any null numerator “suppressed,” including not-collected or missing inputs. `catSumFlagged()` starts at zero and regards an entirely suppressed category set as present.

Confirmed with an in-memory fixture: suppressing all senior-age cells returns `{value: 0, status: "partial"}`. No estimate is actually observed. Existing 1986 usual-workplace output is labelled suppressed rather than retaining its source availability state. Historical “Other” mode requires modern rideshare/e-scooter cells, producing unavailable composites without cycle-specific membership rules.

`unknown_mode ?? 0`, partial denominator sums, and `drivingAgeLicenceRate`'s unflagged category sum introduce further code-path risks. A small **sample** count does not establish that the omitted expanded count is small; “approximately” and “small bias” are not justified simply by the suppression rule.

**Fix:** status-aware arithmetic over typed observations; distinguish numerator and denominator completeness, structural category absence, and nonresponse. No observed inputs means no numeric result. Prefer withholding ratios with incomplete denominators until a defensible publication rule exists. A permitted incomplete numerator sum should be labelled an observed subtotal/lower bound where mathematically justified, not a generic precise percentage.

### A05 — P0: methodology overstates historical compatibility

The official guide documents **1986 trip capture at ages 6+**, versus 11+ from 1991 through 2016; the repo repeatedly treats 1986–2016 as one 11+ basis. The guide also defines `excl2016` as **0, 1, and 2**. Code 2 covers excluded non-commute walking; the repo's “neither flag/unclassified” explanation is unsupported. The guide describes survey/weighting changes and specific 2011 household-attribute restrictions, contradicting blanket claims that demographic measures were collected identically. See sections 1.5, 1.8–1.10, 1.18–1.20, and Trip Flags on printed page 75 of the [2022 TTS Data Guide](https://dmg.utoronto.ca/wp-content/uploads/2024/12/2022TTS_Data_Guide-1.pdf).

**Fix:** replace domain-wide compatibility labels in `scripts/lib/read-files.ts:114` with metric/cycle/basis rules; correct `app/methodology/page.tsx`, `LongView.tsx`, README, and generated documentation. Verify the published CSV's own age basis before changing historical numbers: a tabulation may already have restrictions different from the underlying survey. Keep `excl2016 = 0` for the existing comparison but verify codes separately before claiming a reconciliation. A shared top-code assumption also does not guarantee equal bias across communities.

### A06 — P1: two selectors implement incompatible URL state

**Evidence:** `TravelOrbit.tsx:42` reads `?place=` and writes with `history.replaceState`; `CommunityFinder.tsx:51` reads it separately and writes through `router.replace`. There is no shared subscription or explicit synchronization contract.

Confirmed: choosing Whitby in the orbit changes the URL to `?place=whitby`, but the postcard remains Ajax. Choosing the postcard through Next's router can subsequently synchronize both after navigation, so the defect is directional. Loading `?place=durham#your-durham` incorrectly selects Ajax because the validity list excludes the otherwise supported region option. Postcard updates discard the hash. The map has a third independent selection.

**Fix:** one typed URL-state owner, explicit region/municipality/ward behavior, preserved unrelated parameters and anchors, and browser Back/Forward support. Region/ward selections must never silently substitute a different municipality in the orbit.

### A07 — P1: animation overrides choices and reduced motion hides information

**Evidence:** `ModeMorph.tsx:46` closes over the initial `touched = false`, then runs an uncleared timeout. Confirmed: select “Beyond the region” immediately on entry; after the timer it switches to “To Toronto.”

`NetworkMap.tsx:34` initializes `step` before the reduced-motion hook updates. The effect then skips autoplay without advancing to the final state. Confirmed with reduced motion: all sampled connection groups have computed opacity 0, and the chapter stays on step 1 until manually advanced. In normal mode, the `step >= 5 || ...` highlight predicate also prevents community selection from dimming unrelated connections once the full network is shown.

**Fix:** final information visible by default; use motion only as an optional enhancement. Cancel demonstrations immediately on interaction and unmount. Test normal and reduced motion, including changing preferences after mount. Test community filtering in the final state.

### A08 — P1: legends, labels, and chart encodings change the meaning

- `MapChapter.tsx:324` attaches “of trips” to every percentage. Confirmed no-vehicle legend: **“0.0% → 9.0% of trips.”** It should be households; work-at-home and workplace measures also need their own denominators.
- The map, explorer, and several narratives use `.value` and `fmtPct`, discarding statuses that the postcard partly preserves. The map's walk-plus-cycle card treats an unknown component as zero. Its suppression note says shares use only reported trips, while the derivation uses the published total.
- `ModeShare.tsx:94` independently rounds shares, then pads with drivers or truncates the tail. Current inputs round to **102 squares**; truncation removes Other entirely and reduces School bus to three squares. The graphic cannot be described as an exact representation of each percentage.
- `TravelOrbit.tsx:188` promises a 1,000-trip display floor but does not apply it. Confirmed Brock list includes **845, 797, and 412** trips. Its mini-map draws all municipal arcs, including relationships absent from the truncated list, using a minimum positive width.
- Orbit copy says “people from elsewhere” arrive, but `destinationTrips` includes same-municipality trips and only trips by Durham-household members. It cannot measure all inbound visitors or all residents of other regions.
- Orbit verbal rounding calls 81% “around nine in ten” and 77% “about seven in ten.” Prefer the actual rounded percentage or a consistent rounding rule.

**Fix:** central metric definitions and presentation contracts; exact estimates in accessible tables, documented rounding for charts, explicit unknown states, and a single shared display-floor policy distinct from reliability.

### A09 — P1: release and refresh checks do not cover the published product

- `package.json` runs `data:manifest` before `data:fetch`. `build-manifest.ts` exits if source files are absent, so the advertised `data:all` fails on a clean checkout before downloading anything.
- `fetch-data.ts` loops over authenticated extract entries too. If absent, their URL is the iDRS homepage; any successful response over 100 bytes could be saved as CSV because content type/schema is unchecked. This contradicts the documented manual-import behavior. This is a code-path finding; authenticated downloads were not attempted.
- Existing downloads are accepted after checksum changes with a warning; byte counts are always recorded as zero. There is no explicit refresh/version-acceptance workflow.
- `data:all` does not regenerate `docs/od-findings.md` or run tests before producing public artifacts. Generation writes outputs in place, allowing partial refreshes.
- `lib/data.ts` uses JSON type assertions, not runtime validation. ETL/frontend profile types are duplicated; `OdFlows.provenance` even omits numeric values from its type while the generated object contains numeric `surveyYear`.
- There are no component/browser regression tests or CI configuration in the repository. Existing tests do not check derived missingness, editorial assertions, exported OD lists, or output freshness.
- `inspect-data.ts` advertises age/purpose partition checking but defines only household size, household vehicles, household licensed drivers, and resident all-day modes. The ward reconciliation branch looks for municipality totals within the ward file; verify these totals exist rather than counting skipped checks as coverage.

**Fix:** explicit public-fetch/manual-import modes, validation before publishing, a clean-clone path, freshness checks, portable fixtures, configured noninteractive lint, and staged artifact replacement after all checks pass.

### A10 — P2: repeated presentation, weak accessibility, and documentation drift

- The 12-chapter narrative revisits mode share and community differences through the orbit, choropleth, postcard, and ranking with separate definitions and controls. This makes the product feel longer without making the analysis deeper.
- Labels alternate between Drive/Car driver, Ride/Car passenger, Walk/Walking, integers and tenths of a percent, and undefined “commute” universes. Sources rarely expose a measure-specific numerator, denominator, or basis.
- The mobile work-at-home chart renders municipality labels at roughly 9 px after SVG scaling. Layout did not overflow at tested widths, but “fits” is not the same as readable.
- Light-theme `--color-ink-faint` is used for small essential text. Its contrast needs measurement and correction as part of the design pass. Tabs lack a complete tab/tabpanel keyboard pattern. Network and historical SVG detail rely on mouse events; table fallbacks help but do not make the advertised interactions keyboard-equivalent. Mobile has no equivalent of the desktop chapter navigation.
- `MapSection` dynamically imports MapLibre, but mounts the map immediately; browser smoke testing found a canvas before scrolling. This is a code split, not viewport-triggered loading. A fixed eight-polygon SVG map is a plausible simpler replacement if panning/zooming has little reader value.
- `LongView` removes null points before constructing its path, connecting across unavailable years. Table formatting also loses partial-status notes. Its tooltip uses whole SVG width rather than the plot's padded range.
- `docs/data-inventory.md` still calls OD deferred and claims 17/17 sources. Methodology says 33 current wards; actual output has 34. `find-findings.ts` now includes partial 1986 work-at-home in its selection but emits a note saying 1986 is omitted. Committed findings still start in 1991. Generated and manual documentation have diverged.
- The methodology claims normalized data are downloadable, but `normalized.json` is outside `public/`; no corresponding download is implemented.

**Fix:** a reusable chart/card system, consolidated community exploration, metric-aware formatting, readable mobile alternatives, keyboard equivalents, and a generated inventory with current build provenance.

## Better insights supported by existing files

These are independently calculated candidates, not claims of statistical significance. Use the formulas and qualifications below when implementing; do not hardcode the values into components.

| Question / candidate story | Verified calculation | Presentation and qualification |
|---|---|---|
| What does “local” actually mean? | 819,579 same-municipality trips = **56.9%**; 324,532 between Durham municipalities = **22.5%**; 296,026 with at least one endpoint outside Durham = **20.6%**. Denominator: 1,440,137 Durham-household trips. | Three mutually exclusive groups; this develops the existing 79.4% story rather than repeating it. The last group includes trips entirely outside Durham. |
| Which relationships make up the internal network? | Whitby–Oshawa, Oshawa–Clarington, and Pickering–Ajax total 175,079 trips, **53.9%** of 324,532 intermunicipal Durham trips. | Ranked bars plus a map highlight. These are OD relationships, not observed road corridors or proof of a transit route's demand. |
| Does crossing a municipal boundary change the mode mix? | Existing mode blocks give about **56.0% driving / 14.4% walking** within the same municipality versus **76.1% / 0.3%** between Durham municipalities. | Separate disjoint contexts; the current “Around Durham” context mixes them together. This is association, not an effect caused by the boundary. |
| Is everyday travel mostly work travel? | Home-based work 345,949 / 1,440,149 = **24.0%**; home-based discretionary **47.0%**; school **14.8%**; non-home-based **14.2%**. Published categories sum two trips above the total. | Purpose composition with a rounding/reconciliation note. Non-home-based is not synonymous with non-work; do not label the remaining 76% “non-work.” |
| Is there one uniform weekday commute? | Wednesday reports **186,836** people commuting versus Friday **157,391**: **18.7% more**, or 29,445. | Monday–Friday profile. Counts describe people reporting each day last week; the same person can appear on several days. Not five mutually exclusive shares. |
| How frequent was commuting? | 128,168 reported 1–4 days out of 263,835 with known 0–5 day responses = **48.6%**. | Distribution labelled with this exact denominator. Excludes 422,549 in the combined exclusively-home/unemployed category and 5,508 unknown; do not call it the share of all employed residents who work hybrid. |
| Did work-at-home change everywhere in the same way? | A01 shows the contrasting municipality changes. | Diverging change bars with both years and status, replacing the false universal story. |
| How much of a transit journey is hidden by its primary mode? | Published resident route-count categories 2–5 sum to **24,041**; the six-route category is suppressed. | Start with the reported subtotal and availability. Verify category coverage before publishing a “multiple routes” share; never infer the suppressed category by subtracting from the total. Access/egress and service-use data also exist. Service-use categories may overlap. |
| Has demographic change altered the context? | Regional 65+ share **13.3% → 15.5%** from 2016 to 2022; household count **+8.4%**, while top-coded vehicles per known household **1.83 → 1.81**. | Paired trends, with survey caveats and known-response denominator. This does not establish older residents' individual travel behaviour or vehicle access. |
| Where was the comparable transit decline concentrated? | The local `mode_by-pd ... excl2016-0` extract retains all eight municipalities; the current site collapses it to the region. | Compare municipality-level counts and shares with 2016 on an explicitly harmonized basis. Include the regional contrast: total comparable trips **+1.5%**, transit share **6.4% → 3.9%**. |

Further available domains: AM/PM versus all-day modes, household composition and dwelling type, income-band distributions, workplace/school destinations, transit access/egress, and municipal histories. Audit each denominator and cycle taxonomy before promotion to a story.

**The analytical boundary:** the summary files are mostly separate marginal tables. They cannot establish “low-income seniors without cars take transit” by joining municipality-level percentages. Joint population questions need actual cross-tabulations. Wards from different years cannot be treated as identical geographic units without a boundary crosswalk.

## Additional data worth collecting

Order these by the decision or story they unlock, not the number of new records. Detailed specifications are in the implementation plan.

| Priority | Data | Why it matters | Availability / constraint |
|---|---|---|---|
| 1 | Unexpanded support for the existing iDRS tables; provider reliability/disclosure guidance | Distinguish readable flows from estimates supported by adequate samples; qualify rankings | A targeted iDRS/provider request. Expanded flow ≥1,000 does not establish ≥4 observations. Raw sample counts alone do not provide survey-design confidence intervals. |
| 2 | OD involving Durham from **all surveyed households**, including trip purpose and period | Separate residents' movements from inbound workers/visitors; describe destinations more honestly | Requires a new extract with a different population filter. Preserve provenance and validate current authorization scope for the additional extract; existing four-extract use remains authorized. |
| 3 | Mode × purpose × period; mode × distance bands; mode × household vehicles/income/age | Identify where mode differences occur, short-trip candidates, and mobility disparities | Targeted aggregate cross-tabs; coarsen dimensions to control sparse cells. Ask for necessary variables and support, not unrestricted person-level records. |
| 4 | DRT and GO schedules, plus ridership/service series | Put 2022 behaviour alongside service availability and subsequent change | DRT documents its schedule feed in its [transit data dictionary](https://maps.durham.ca/OpenData/OpenData_DataDictionary.pdf); [Metrolinx Open Data](https://www.metrolinx.com/en/about-us/open-data) lists GO GTFS, parking/utilization, and archived ridership products. Confirm feed dates and archive access. |
| 5 | Census population, household and socioeconomic context with boundary identifiers | Better geographic denominators, contextual equity measures, and population weighting | Use [Statistics Canada's Census Profile](https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm?Lang=E); identify Durham Regional Municipality/CD and its CSDs, not the Durham electoral district or Oshawa CMA as substitutes. |
| 6 | Walking/cycling networks, barriers, destinations and facility locations | Assess access to stations, schools, healthcare and shops | Candidate datasets require Durham coverage/date checks. The [Canadian Cycling Network Database](https://www150.statcan.gc.ca/n1/pub/23-26-0004/232600042024001-eng.htm) offers standardized infrastructure; its [metadata](https://www150.statcan.gc.ca/n1/pub/23-26-0004/232600042025001-eng.htm) warns coverage is incomplete. |
| Later | Collision records, traffic counts, service reliability, travel times, accessibility barriers | Safety, exposure and actual travel burden | Availability at useful Durham geography remains unverified. Do not imply trip exposure, route choice, on-time performance, or disability experience can be inferred from TTS aggregates alone. |

There is a valuable freshness story: DRT's official [About DRT](https://www.durhamregiontransit.com/about-us/about-drt/) page reports record fall ridership exceeding pre-pandemic levels in its 2025 highlights. That makes a dated “2022 snapshot” plus a separate operational update more useful than presenting 2022 as “today.” Agency ridership and TTS resident primary-mode trips are different measures; do not splice them into one trend.

## Recommended product direction

Keep the typography, recognizable mode palette, static deployment, and the local-movement story. Reduce the landing page to four or five carefully verified questions, with a single entry into community analysis. Give each answer a visible takeaway, numerator/denominator, comparison, caveat, table, and source trail. Put richer filters, peer comparisons, and municipal histories in a unified explorer.

The next implementation should first earn trust, then deliver analytical depth. The companion plan defines the release order, acceptance checks, and acquisition specifications.
