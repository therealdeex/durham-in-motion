# Design Notes

## Aesthetic

**Editorial civic data visualization** — closer to a Pudding/NYT explainer than a dashboard.
One coherent system across alternating treatments:

- **Paper sections** (warm off-white `#faf7f1`) for reading: Your Durham, methodology, explorer.
- **Night sections** (deep blue-black `#0f1418`, subtle teal/amber radial textures) for
  immersive moments: hero, big numbers, map, long view, the finding.
- Typography: **Fraunces** (display serif) for headlines and big numerals, **Inter** for
  body/data. Numbers never use fake precision — prose rounds ("1.44 million"), tooltips are exact.
- Data palette (Tailwind theme tokens in `app/globals.css`): steel blue (car driver), pale steel
  (car passenger), teal (transit), amber (walking), rust (cycling), violet (school bus), warm grey
  (other). Accent `#c2502e` for markers/warnings; amber doubles as the "active/region" hue on dark.
- The amber `#f5b043` is deliberately the most persistent colour: it marks "you are here" moments
  (active nav, selected region, the featured line in charts) across both light and dark sections.

## Motion

- Hero: one-time stroke-draw of the region outline + staggered label fade (CSS only).
- Mode grid: cells assemble on first view (staggered scale/opacity), then highlight on hover/focus.
- Map: metric fills transition via MapLibre paint transitions; selection is an amber outline.
- Charts: bars/lines settle on view; hover readouts replace tooltips on mobile.
- `prefers-reduced-motion`: all animation collapses to final states (CSS rule in globals.css +
  JS checks in CountUp/ModeShare). Every message survives without motion.

## Data-expression rules baked into components

- Suppressed ≠ zero: maps use a neutral dark grey fill labelled "suppressed" in the legend;
  profile cards omit the bar and add an explanatory note; slope/line charts skip the point.
- `≈` prefix marks *partial* shares (a small suppressed category is excluded from a larger total).
- Comparability: trip-based series never draw 2022 on a pre-2022 line; the break is annotated
  directly on the chart ("2022: method change").
- Every chart has an accessible table (`<details>`) or `sr-only` summary generated from the same data.

## Determinism

All narrative claims come from `lib/stories.ts` / sentence builders inside components — pure
functions of the curated JSON. No hand-written numbers in JSX; headlines in
`scripts/find-findings.ts` are computed, then phrased by hand once and re-verified on rebuild.
