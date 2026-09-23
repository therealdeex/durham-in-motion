# Implementation handoff prompt

Copy the text below into a new coding-agent session in this repository.

---

You are improving Durham in Motion, a public Next.js/React static-export website about the Transportation Tomorrow Survey. The site has considerable data but contains incorrect claims, inconsistent statistical formatting, broken interactions, and underused analytical potential.

Read these files first:

- `docs/tts-audit-2026-09.md` — concrete findings A01–A10, reproduced bugs, verified insight candidates, and official source references.
- `docs/tts-implementation-plan.md` — ordered PRs, data contracts, acceptance checks, and acquisition specifications.
- `README.md`, `docs/data-permissions.md`, `docs/idrs-data.md`, and any applicable `AGENTS.md`.

Implement Releases 1 and 2 of the plan, working through PR1–PR5 in order. Deliver actual code, corrected generated outputs and documentation, and relevant verification. Prepare the query manifest/import contracts for Release 3 and incorporate additional sources only when available and within authorization. Do not stop at another plan. Do not invent data or make the existing-data improvements depend on provider responses.

Keep the existing static architecture and visual identity. Aim for a shorter, more informative narrative plus one coherent community explorer. Do not add a database, LLM-written claims, a generic BI platform, or an unrelated framework/dependency migration.

The audit baseline is 2026-09-23: 33 data tests, typecheck and static build passed. The lint command failed because it prompted for configuration. Those passing tests did not catch the following confirmed defects; reproduce and fix them:

1. The work-at-home narrative says every municipality doubled. Uxbridge went approximately 13.9% → 12.0%; Scugog 12.4% → 11.6%; Ajax 5.4% → 17.8%. Correct the narrative and test its predicates.
2. Toronto PDs are renamed without aggregation. Pickering's destination list shows a single PD's 3,973 trips as “Toronto,” instead of the full 20,682. Aggregate before ranking/truncation and use unique keys.
3. The OD findings report writes origin totals under “Beyond,” uses incomplete Toronto values, and falsely says elsewhere exceeds Toronto. Durham-origin values are 56,903 elsewhere versus 77,303 Toronto. Public matrix rows for non-Durham origins are fabricated zeros; use explicit valid rows/columns.
4. Missing/not-collected/suppressed states collapse in derivation. An all-suppressed senior-age aggregate can become numeric zero. Preserve typed source states through sums, ratios, historical differences, tables and charts.
5. Historical compatibility and `excl2016` documentation require the official-guide corrections identified in A05. Check the actual archived summary basis before changing values. Do not assume all demographic measures have identical definitions or equal top-coding bias.
6. Orbit selection can update `?place=` without updating the postcard; `?place=durham` reloads as Ajax. Build shared URL state with region/ward behavior, anchors, refresh and history.
7. ModeMorph's stale timeout overwrites a manual selection. Reduced-motion NetworkMap starts with invisible connections and stays there; final-state community filtering is also ineffective. Make data visible by default and motion optional.
8. Percentage legends call households and workers “trips”; some components discard partial status. The current 100-square chart rounds to 102 then truncates, removing Other. Orbit lists promise a threshold they do not enforce. Correct these through shared contracts.
9. `data:all` runs the manifest before fetch and fails on a clean checkout. Missing manual iDRS inputs can be sent through the public downloader. Split acquisition modes, validate before acceptance, stage output generation, configure lint and meaningful release checks.
10. Documentation and generated findings are stale; there are 34 current wards. Fix templates and regenerate rather than patching only output text.

After correctness and interaction fixes, ship at least five qualified analyses from existing data: local versus cross-municipality travel; concentration of intermunicipal OD relationships; mode differences across disjoint destination contexts; trip purpose; weekday commuting/frequency. Also replace the existing work-at-home story with the geographic divergence and expose municipality-level comparable transit change. The audit gives calculations and caveats; derive them in code.

Use one metric registry and shared estimate/chart presentation. Each chart needs a takeaway, date, universe/denominator, comparable basis, uncertainty/availability note, accessible table and source trail. Values must agree across map, profile, ranking, narrative and export. Provide readable mobile and keyboard behavior, shared links, and useful map failure states. Do not silently omit communities with unknown values from discovery.

Analytical rules:

- Suppression is not zero. No observed components means no numeric aggregate. Incomplete denominators are not ordinary denominators. Never recover suppressed cells by subtraction.
- Expanded counts are estimates, not sample sizes. A 1,000-trip visual floor is not a reliability or disclosure test. Do not invent standard errors, significance or confidence intervals.
- Trips by Durham households, trips originating in Durham, trips by residents of a selected municipality, and all inbound trips are different populations.
- Separate full 2022 and harmonized comparison bases. Use metric/cycle/geography rules; maintain gaps for unavailable data and label percentage-point changes correctly.
- Marginal tables cannot establish joint demographic behaviour. Do not infer income × age × vehicle access relationships from municipal percentages.
- Desire lines do not reveal roads taken, route demand, feasible mode shift, travel time or emissions. Current GTFS cannot explain historical service unless a historical snapshot is available.
- Keep source-specific reconciliation differences documented; do not force outputs from different extracts to agree.
- Current operational ridership belongs in a separate dated layer from TTS resident mode shares.

Use the existing four authenticated extracts under the authorization already recorded in `docs/data-permissions.md`; do not ask the owner to reapprove that settled use. Keep raw extracts and credentials private, and never query iDRS at runtime. Check additional-extract scope only when needed. Do not send email or other messages to providers without explicit instruction. If fresh data is unavailable, finish the authorized existing-data work and leave exact query/import specifications and explicit limitations.

Add meaningful regressions for calculations, assertions and user actions. Use small public/synthetic fixtures for portable tests and local private-extract integrations when available. Never commit raw authenticated matrices as fixtures. Test the production static export at 320/390/768/1440 px as appropriate, keyboard/touch, normal/reduced motion, selector synchronization, deep links and history. Make lint, typecheck, tests, artifact validation and build pass; report anything that remains blocked with its exact missing dependency.

The local deployment convention is port 3310. Do not change it. The task is implementation and verification; do not publish/deploy, send messages, or expand publication permissions without an applicable instruction.

Finish with a concise report of corrected issues, new insights delivered, validation results, changed-file links, and any remaining acquisition gaps. Update the implementation plan with actual completion status so the next session can continue without rediscovering the audit.
