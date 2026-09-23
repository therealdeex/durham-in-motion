/**
 * Phase 5 — programmatic findings scan.
 *
 * Scans normalized data for the strongest defensible story candidates:
 * historical changes, geographic extremes, and gaps. Output:
 *   public/data/story-candidates.json  (numbers behind editorial copy)
 *   docs/findings.md                   (human-readable scan)
 *
 * Rules: no suppressed denominators, no category with a suppressed region
 * total, no cross-methodology trip comparisons, minimum sizes enforced.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deriveProfile, groupByGeographyYear, type DerivedProfile } from "./lib/derive.ts";
import type { NormalizedRecord } from "./lib/read-files.ts";

const ROOT = resolve(import.meta.dirname, "..");

const { records } = JSON.parse(
  readFileSync(resolve(ROOT, "data/processed/normalized.json"), "utf8"),
) as { records: NormalizedRecord[] };

const groups = groupByGeographyYear(records);
const profiles = new Map<string, DerivedProfile>();
for (const [key, recs] of groups) profiles.set(key, deriveProfile(recs));

const YEAR = 2022;
const region = (year: number) => profiles.get(`${year}|durham`);
const mun2022 = [...profiles.values()].filter((p) => p.surveyYear === YEAR && p.geographyType === "municipality");

const fmtPct = (v: number | null) => (v === null ? "suppressed" : `${(v * 100).toFixed(1)}%`);
const fmtNum = (v: number | null) => (v === null ? "suppressed" : Math.round(v).toLocaleString("en-CA"));

interface Finding {
  id: string;
  headline: string;
  metric: string;
  place?: string;
  from?: string;
  to?: string;
  change?: string;
  value?: string;
  durham?: string;
  difference?: string;
  comparability: string;
  notes: string;
  ranking?: { place: string; value: string }[];
}

const findings: Finding[] = [];

// ---- 1. historical extremes (strong-comparability measures only) ----
const regionSeries = (get: (p: DerivedProfile) => number | null | { value: number | null }) =>
  [1986, 1991, 1996, 2001, 2006, 2011, 2016, 2022]
    .map((y) => ({ year: y, value: get(region(y)!) }))
    .map(({ year, value }) => ({ year, value: typeof value === "number" ? value : value?.value ?? null }));

const population = regionSeries((p) => p.persons);
const householdsSeries = regionSeries((p) => p.households);
const vehicles = regionSeries((p) => p.avgVehiclesPerHousehold);
const seniors = regionSeries((p) => p.seniorsShare.value);

const pctChange = (a: number, b: number) => `${(((b - a) / a) * 100).toFixed(0)}%`;

findings.push({
  id: "population-growth",
  headline: `Durham's surveyed population grew from ${fmtNum(population[0].value)} in 1986 to ${fmtNum(population[7].value)} in 2022 (${pctChange(population[0].value!, population[7].value!)}).`,
  metric: "persons_total",
  from: `1986: ${fmtNum(population[0].value)}`,
  to: `2022: ${fmtNum(population[7].value)}`,
  change: pctChange(population[0].value!, population[7].value!),
  comparability: "strong",
  notes: "Household survey population estimates, all ages.",
});

const wahSeries = [1986, 1991, 1996, 2001, 2006, 2011, 2016, 2022]
  .map((y) => ({ year: y, value: region(y)!.workAtHomeShare.value, status: region(y)!.workAtHomeShare.status }))
  .filter((x) => x.value !== null);
const wahFirst = wahSeries[0];
const wahLast = wahSeries[wahSeries.length - 1];
findings.push({
  id: "work-at-home",
  headline: `Working at home went from ${fmtPct(wahFirst.value)} of employed residents in ${wahFirst.year} to ${fmtPct(wahLast.value)} in ${wahLast.year}.`,
  metric: "work_at_home_share_of_employed",
  from: `${wahFirst.year}: ${fmtPct(wahFirst.value)}`,
  to: `${wahLast.year}: ${fmtPct(wahLast.value)}`,
  change: `+${((wahLast.value! - wahFirst.value!) * 100).toFixed(1)} pp`,
  comparability: "strong",
  notes: `Full-time + part-time usually-work-at-home as a share of employed persons. 1986 is not computable from the published cells (the part-time-at-home cell is suppressed, affecting numerator and denominator), so the series starts in ${wahFirst.year}. 2022 reflects post-2020 hybrid work.`,
});

const veh2022 = vehicles[7].value!;
findings.push({
  id: "vehicles-per-household",
  headline: `The average Durham household owned ${vehicles[0].value!.toFixed(2)} vehicles in 1986; in the 2022 survey it owned ${veh2022.toFixed(2)}.`,
  metric: "avg_vehicles_per_household",
  from: `1986: ${vehicles[0].value!.toFixed(2)}`,
  to: `2022: ${veh2022.toFixed(2)}`,
  change: `${veh2022 - vehicles[0].value! >= 0 ? "+" : ""}${(veh2022 - vehicles[0].value!).toFixed(2)}`,
  comparability: "strong",
  notes: "Top-coded '5 or more' counted as 5, so means are slightly low; the bias need not be identical across communities.",
});

// ---- 2. geographic extremes 2022 ----
const rankBy = (
  get: (p: DerivedProfile) => number | null | { value: number | null },
  label: string,
  id: string,
  notes: string,
  minHouseholds = 5000,
  format: (v: number) => string = fmtPct,
) => {
  const asValue = (v: number | null | { value: number | null }): number | null => {
    if (v === null) return null;
    return typeof v === "number" ? v : v.value;
  };
  const eligible = mun2022.filter((p) => (p.households ?? 0) >= minHouseholds);
  const sorted = eligible
    .map((p) => ({ place: p.geographyName, id: p.geographyId, value: asValue(get(p)) }))
    .filter((x): x is { place: string; id: string; value: number } => x.value !== null)
    .sort((a, b) => b.value - a.value);
  if (sorted.length < 2) return null;
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  return {
    id,
    headline: `${label}: highest ${hi.place} (${format(hi.value)}), lowest ${lo.place} (${format(lo.value)}).`,
    metric: id,
    value: `highest ${hi.place} ${format(hi.value)}`,
    durham: format(asValue(get(region(YEAR)!)) ?? 0),
    difference: `${format(hi.value)} vs ${format(lo.value)}`,
    comparability: "within-2022",
    notes,
    _sorted: sorted,
  } as Finding & { _sorted: { place: string; value: number }[] };
};

const gaps = [
  rankBy((p) => p.modeShares.transit, "Transit share of weekday trips", "transit_share", "Share of resident weekday trips by local transit + GO (2022)."),
  rankBy((p) => p.zeroVehicleHouseholdShare, "Households with no vehicle", "zero_vehicle_share", "Share of households reporting zero vehicles (2022)."),
  rankBy((p) => p.modeShares.walk, "Walking share of weekday trips", "walk_share", "Share of resident weekday trips on foot (2022)."),
  rankBy((p) => p.torontoWorkShare, "Workers commuting to Toronto", "toronto_commute_share", "Employed residents whose usual workplace is in Toronto, as a share of all employed residents (2022). The stricter usual-workplace denominator is never complete (suppressed area cells), so employed residents is the denominator."),
  rankBy((p) => p.avgVehiclesPerHousehold, "Vehicles per household", "vehicles_per_hh", "Mean vehicles per household (2022), top-coded at 5.", 5000, (v) => v.toFixed(2)),
];
for (const g of gaps) {
  if (!g) continue;
  const { _sorted, ...rest } = g;
  findings.push(rest);
  if (g.id === "transit_share" || g.id === "vehicles_per_hh") {
    const fmt = g.id === "vehicles_per_hh" ? (v: number) => v.toFixed(2) : fmtPct;
    (rest as unknown as { ranking: { place: string; value: string }[] }).ranking = _sorted.map((s) => ({ place: s.place, value: fmt(s.value) }));
  }
}

// ---- 3. 2022 mode mix ----
const r22 = region(2022)!;
findings.push({
  id: "mode-mix-2022",
  headline: `${fmtPct(r22.modeShares.autoDriver.value)} of weekday trips by Durham residents are made as the driver of a private car; ${fmtPct(r22.modeShares.autoDriver.value! + r22.modeShares.autoPassenger.value!)} are made by car, driving or riding.`,
  metric: "mode_shares_2022",
  value: `auto driver ${fmtPct(r22.modeShares.autoDriver.value)}, passenger ${fmtPct(r22.modeShares.autoPassenger.value)}, transit ${fmtPct(r22.modeShares.transit.value)}, walk ${fmtPct(r22.modeShares.walk.value)}, bike ${fmtPct(r22.modeShares.bicycle.value)}, school bus ${fmtPct(r22.modeShares.schoolBus.value)}, other ${fmtPct(r22.modeShares.otherMisc.value)}`,
  comparability: "2022-only",
  notes: "2022 methodology (persons 5+, fuller walking capture). Shares may not sum to 100% due to rounding.",
});

// ---- 4. historical transit trajectory (1991→2016, caution) ----
// 1986 collected trips at ages 6+ (Data Guide §1.5) — a different basis that
// is never joined to the 1991–2016 (11+) series.
const transitShare = [1991, 1996, 2001, 2006, 2011, 2016].map((y) => ({
  year: y,
  value: region(y)!.modeShares.transit.value,
}));
const t1991 = transitShare[0].value!;
const t2016 = transitShare[transitShare.length - 1].value!;
findings.push({
  id: "transit-growth-pre2022",
  headline: `Transit's share of resident weekday trips moved from ${fmtPct(t1991)} in 1991 to ${fmtPct(t2016)} in 2016 (comparable 11+ cycles only).`,
  metric: "transit_share_1991_2016",
  from: `1991: ${fmtPct(t1991)}`,
  to: `2016: ${fmtPct(t2016)}`,
  comparability: "caution",
  notes: "1991–2016 only: 1986 collected trips at ages 6+ and 2022 at ages 5+ with fuller walking capture — both are excluded as different bases.",
});

// ---- 5. ward extremes (2022) ----
const ward2022 = [...profiles.values()].filter((p) => p.surveyYear === YEAR && p.geographyType === "ward" && (p.households ?? 0) >= 500);
const wardTransit = ward2022
  .map((p) => ({ place: p.geographyName, id: p.geographyId, value: p.modeShares.transit.value }))
  .filter((x): x is { place: string; id: string; value: number } => x.value !== null)
  .sort((a, b) => b.value - a.value);
if (wardTransit.length > 1) {
  findings.push({
    id: "ward-transit-extremes",
    headline: `Ward-level transit share ranges from ${fmtPct(wardTransit[0].value)} in ${wardTransit[0].place} to ${fmtPct(wardTransit[wardTransit.length - 1].value)} in ${wardTransit[wardTransit.length - 1].place}.`,
    metric: "transit_share_wards_2022",
    value: `highest ${wardTransit[0].place} ${fmtPct(wardTransit[0].value)}`,
    durham: fmtPct(r22.modeShares.transit.value),
    comparability: "within-2022",
    notes: "Wards with ≥500 surveyed households; suppressed shares excluded.",
    ranking: wardTransit.slice(0, 8).map((w) => ({ place: w.place, value: fmtPct(w.value) })),
  });
}

// ---- write outputs ----
writeFileSync(
  resolve(ROOT, "public/data/story-candidates.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2),
);

const md: string[] = [
  "# Findings scan",
  "",
  `Generated ${new Date().toISOString().slice(0, 10)} by \`npm run data:findings\`.`,
  "Every claim below is computed directly from the normalized records; the machine-readable version is `public/data/story-candidates.json`.",
  "",
];
for (const f of findings) {
  md.push(`## ${f.id}`);
  md.push(`- **Headline:** ${f.headline}`);
  md.push(`- **Metric:** ${f.metric} (comparability: ${f.comparability})`);
  for (const [k, v] of Object.entries(f)) {
    if (["id", "headline", "metric", "comparability", "ranking"].includes(k)) continue;
    if (v !== undefined) md.push(`- **${k}:** ${String(v)}`);
  }
  if ("ranking" in f && Array.isArray(f.ranking)) {
    md.push(`- **Ranking:** ${f.ranking.map((x) => `${x.place} ${x.value}`).join(" · ")}`);
  }
  md.push(`- **Notes:** ${f.notes}`);
  md.push("");
}
writeFileSync(resolve(ROOT, "docs/findings.md"), md.join("\n"));

console.log(`findings: ${findings.length} candidates → public/data/story-candidates.json, docs/findings.md`);
for (const f of findings) console.log(`  • ${f.headline}`);
