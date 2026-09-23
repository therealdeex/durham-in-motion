/**
 * Read-only release gate over the committed public artifacts (audit A09).
 *
 * Validates structure and semantic content of public/data/*.json — ignoring
 * generation timestamps, so an unchanged input regenerates equivalent content
 * and passes. Run after generation (data:all) or standalone (data:check) on a
 * clean checkout: it must pass before the site ships.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DATA = resolve(ROOT, "public/data");

const readJson = (f: string) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"));

let checks = 0;
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`✗ ${msg}`);
};
const ok = (msg: string) => {
  checks++;
  console.log(`✓ ${msg}`);
};
const check = (cond: boolean, msg: string) => {
  if (cond) ok(msg);
  else fail(msg);
};

// ---------- od-flows.json ----------
const od = readJson("od-flows.json");
check(od.totals.allTrips === 1_440_137, "od total trips = 1,440,137");
check(Math.round(od.totals.internalShare * 10000) / 10000 === 0.7944, "internal share = 79.44%");
check(od.totals.toToronto === 77_303, "Durham→Toronto = 77,303");
check(od.matrix.rowIds?.length === 8 && od.matrix.columnIds?.length === 11, "matrix has explicit 8×11 row/column ids");
check(
  od.matrix.values.length === 8 && od.matrix.values.every((r: number[]) => r.length === 11),
  "matrix values match declared shape (no fabricated rows)",
);
check(
  od.matrix.values.every((row: number[]) => row.every((v) => Number.isFinite(v) && v >= 0)),
  "matrix cells finite and nonnegative",
);
const pickering = od.profiles.find((p: { id: string }) => p.id === "pickering");
check(!!pickering, "Pickering profile present");
if (pickering) {
  const tor = pickering.destinations.filter((d: { destinationId: string }) => d.destinationId === "toronto");
  check(tor.length === 1 && tor[0].trips === 20_682, "Pickering→Toronto aggregated: one entry, 20,682 trips (A02)");
  const ids = pickering.destinations.map((d: { destinationId: string }) => d.destinationId);
  check(new Set(ids).size === ids.length, "Pickering destination ids unique");
}
for (const p of od.profiles) {
  const ids = p.destinations.map((d: { destinationId: string }) => d.destinationId);
  if (new Set(ids).size !== ids.length) fail(`${p.id}: duplicate destination ids`);
}
checks++;
check(od.display?.floor === 1000, "display floor consolidated in metadata (1,000 trips)");
check(od.localComposition?.totalTrips === 1_440_137, "local composition denominator = all Durham-household trips");
check(od.modeContexts.filter((c: { disjoint: boolean }) => c.disjoint).length === 5, "five disjoint destination contexts");
check(typeof od.provenance.populationScope === "string", "population scope labelled in provenance");

// ---------- planning-districts-2022.json ----------
const pd = readJson("planning-districts-2022.json");
check(pd.municipalities?.length === 8, "8 municipalities");
for (const m of pd.municipalities) {
  if (!m.prior2016 || m.prior2016.workAtHomeShare?.value === undefined) {
    fail(`${m.geographyId}: explicit 2016 endpoints missing`);
  }
  const pp = m.change2016to2022?.workAtHomeShare;
  if (m.prior2016?.workAtHomeShare?.value !== null && m.workAtHomeShare?.value !== null) {
    if (Math.abs(m.workAtHomeShare.value - m.prior2016.workAtHomeShare.value - pp) > 1e-9) {
      fail(`${m.geographyId}: pp change ≠ endpoint difference`);
    }
  }
}
checks++;
const ajax = pd.municipalities.find((m: { geographyId: string }) => m.geographyId === "ajax");
check(
  ajax && Math.abs(ajax.prior2016.workAtHomeShare.value - 0.0542) < 0.0005 && Math.abs(ajax.workAtHomeShare.value - 0.1778) < 0.0005,
  "Ajax work-at-home endpoints 5.4% → 17.8% (A01)",
);
const uxbridge = pd.municipalities.find((m: { geographyId: string }) => m.geographyId === "uxbridge");
check(
  uxbridge && uxbridge.workAtHomeShare.value < uxbridge.prior2016.workAtHomeShare.value,
  "Uxbridge work-at-home declined 2016→2022 (A01)",
);

// ---------- historical-trends.json ----------
const trends = readJson("historical-trends.json");
const tripsTotal = trends.series.find((s: { id: string }) => s.id === "trips_total");
check(!!tripsTotal && tripsTotal.points.length === 8, "trip series lists all 8 cycles");
if (tripsTotal) {
  const p1986 = tripsTotal.points.find((p: { year: number }) => p.year === 1986);
  const p2022 = tripsTotal.points.find((p: { year: number }) => p.year === 2022);
  const p2016 = tripsTotal.points.find((p: { year: number }) => p.year === 2016);
  check(p1986 && p1986.comparable === false, "1986 trip point marked non-comparable (6+ basis)");
  check(p2022 && p2022.comparable === false, "2022 trip point marked non-comparable (5+ basis)");
  check(p2016 && p2016.comparable === true, "2016 trip point on the 11+ anchor basis");
}
const wah = trends.series.find((s: { id: string }) => s.id === "work_at_home");
if (wah) {
  const p1986 = wah.points.find((p: { year: number }) => p.year === 1986);
  check(p1986 && p1986.value === null && p1986.status === "partial", "1986 work-at-home withheld (suppressed cell in numerator and denominator)");
} else fail("work_at_home series missing");

// ---------- region-summary.json / wards ----------
const wards = readJson("wards-2022.json");
check(wards.wards?.length === 34, `34 current wards (got ${wards.wards?.length})`);
const region = readJson("region-summary.json");
check(region.profiles?.length === 8, "region summary covers 8 cycles");

// ---------- insights ----------
const insightsFile = readJson("insights.json");
check(insightsFile.insights?.length >= 7, `at least 7 qualified insights (got ${insightsFile.insights?.length})`);
check(insightsFile.unavailable?.length >= 3, "documented unavailable analyses present");
for (const i of insightsFile.insights ?? []) {
  if (!i.universe || !i.denominatorNote || !i.basis || !Array.isArray(i.caveats) || !Array.isArray(i.sourceIds)) {
    fail(`${i.id}: missing universe/denominator/basis/caveats/sources`);
  }
}
checks++;

// ---------- manifest ----------
const manifest = readJson("manifest.json");
const manualMissing = manifest.sources.filter(
  (s: { acquisition?: string; availability?: string }) => s.acquisition === "manual" && s.availability === "missing",
);
check(manualMissing.length === 0, "no manual source recorded as plain 'missing' (must be inventories)");

// ---------- story-day.json (Phase 4) ----------
const dayStory = readJson("story-day.json");
check(dayStory.meta?.binMinutes === 30 && dayStory.bins?.length === 48, "day story: 48 × 30-minute bins");
check(dayStory.meta?.displayFloor === 300, "day story: map display floor 300 trips/bin");
check(
  dayStory.meta?.sources?.includes("F") && dayStory.meta?.sources?.includes("G") && dayStory.meta?.sources?.includes("H"),
  "day story: source ids F/G/H recorded",
);
if (dayStory.bins) {
  const hour = (h: number) =>
    dayStory.bins
      .filter((b: { t: number }) => b.t >= (h - 4) * 60 && b.t < (h - 4 + 1) * 60)
      .reduce((a: number, b: { trips: number }) => a + b.trips, 0);
  check(hour(8) === 156_056, "day story: 08:00 hour = 156,056 trips (F)");
  check(hour(15) === 161_115 && hour(15) > hour(8), "day story: 15:00 hour = 161,115 trips — the bigger surge (F)");
  const net = (h: number) =>
    dayStory.bins
      .filter((b: { t: number }) => b.t >= (h - 4) * 60 && b.t < (h - 4 + 1) * 60)
      .reduce((a: number, b: { inbound: number; outbound: number }) => a + b.inbound - b.outbound, 0);
  check(net(7) === -15_134 && net(17) === 10_474, "day story: boundary net −15,134 (07:00) → +10,474 (17:00) (G/H)");
  check(
    dayStory.bins.every((b: { pairs: { v: number }[] }) => b.pairs.every((p) => p.v >= (dayStory.meta.displayFloor ?? 0))),
    "day story: every map-frame pair above the display floor",
  );
  const support = dayStory.bins.reduce((a: number, b: { surveyRecords: number }) => a + b.surveyRecords, 0);
  check(support === 54_535, "day story: bin support sums to the F-unexp universe");
}

// ---------- story-transit.json (Phase 4) ----------
const transitStory = readJson("story-transit.json");
check(transitStory.totals?.journeys === 50_753, "transit story: 50,753 journeys (P)");
check(transitStory.totals?.goJourneys === 18_736, "transit story: 18,736 GO journeys (N)");
const stations: { id: string; boardings: number; carShare: number }[] = transitStory.stations ?? [];
check(
  stations.length === 4 && stations.every((s) => Number.isFinite(s.carShare)),
  "transit story: four Durham line stations with access profiles",
);
const oshawa = stations.find((s) => s.id === "oshawa");
check(
  !!oshawa && Math.abs(oshawa.carShare - 0.908) < 0.0005 && oshawa.boardings === 2_729,
  "transit story: Oshawa 2,729 boardings, 90.8% arrive by car (N)",
);
const union = (transitStory.destinations ?? []).find((d: { name: string }) => d.name === "Union GO");
const destTotal = (transitStory.destinations ?? []).reduce((a: number, d: { trips: number }) => a + d.trips, 0);
check(
  !!union && union.trips === 8_644 && Math.abs(union.trips / destTotal - 0.4614) < 0.0005,
  "transit story: Union alightings 8,644 = 46.1% (O)",
);

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${checks} semantic checks passed, ${failures} failed`);
if (failures > 0) process.exit(1);
