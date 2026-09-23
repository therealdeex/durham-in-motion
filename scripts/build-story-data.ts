/**
 * Builds the curated public data files the site consumes:
 *   public/data/region-summary.json         — region profiles, all 8 cycles
 *   public/data/historical-trends.json      — named series for the Long View
 *   public/data/planning-districts-2022.json— 8 municipalities + rankings
 *   public/data/wards-2022.json             — ward profiles
 *
 * All values derive deterministically from data/processed/normalized.json.
 * Historical comparisons carry both endpoints and their estimate states;
 * a percent change requires a nonzero *baseline* (2016), and share
 * differences are percentage points.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { deriveProfile, groupByGeographyYear, type DerivedProfile, type Share } from "./lib/derive.ts";
import type { NormalizedRecord } from "./lib/read-files.ts";
import { pctChange, diffPp, type Estimate } from "./lib/estimates.ts";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "public/data");

const { records, geographies } = JSON.parse(
  readFileSync(resolve(ROOT, "data/processed/normalized.json"), "utf8"),
) as { records: NormalizedRecord[]; geographies: { id: string; name: string; type: string; municipality?: string }[] };

const groups = groupByGeographyYear(records);
const profileOf = (year: number, geoId: string): DerivedProfile => {
  const recs = groups.get(`${year}|${geoId}`);
  if (!recs) throw new Error(`no records for ${geoId} ${year}`);
  return deriveProfile(recs);
};

const ALL_YEARS = [1986, 1991, 1996, 2001, 2006, 2011, 2016, 2022];
const MUN_IDS = ["brock", "uxbridge", "scugog", "pickering", "ajax", "whitby", "oshawa", "clarington"];

const shareOut = (s: Share) => ({ value: s.value, status: s.status });

const profileOut = (p: DerivedProfile) => ({
  geographyId: p.geographyId,
  geographyName: p.geographyName,
  geographyType: p.geographyType,
  municipality: p.municipality,
  surveyYear: p.surveyYear,
  tripComparability: p.tripComparability,
  tripBasisId: p.tripBasisId,
  households: p.households,
  persons: p.persons,
  drivers: p.drivers,
  avgVehiclesPerHousehold: p.avgVehiclesPerHousehold,
  avgPersonsPerHousehold: p.avgPersonsPerHousehold,
  zeroVehicleHouseholdShare: shareOut(p.zeroVehicleHouseholdShare),
  vehicleCounts: p.vehicleCounts,
  tripsTotal: p.tripsTotal,
  modes: p.modes,
  modeShares: Object.fromEntries(Object.entries(p.modeShares).map(([k, s]) => [k, shareOut(s)])),
  modeSuppressed: p.modeSuppressed,
  amPeakShare: shareOut(p.amPeakShare),
  purposes: p.purposes,
  employed: p.employed,
  employedPartial: p.employedPartial,
  workAtHomeShare: shareOut(p.workAtHomeShare),
  workersWithUsualPlace: p.workersWithUsualPlace,
  workersWithUsualPlacePartial: p.workersWithUsualPlacePartial,
  torontoWorkShare: shareOut(p.torontoWorkShare),
  durhamWorkShare: shareOut(p.durhamWorkShare),
  childrenShare: shareOut(p.childrenShare),
  seniorsShare: shareOut(p.seniorsShare),
  drivingAgeLicenceRate: shareOut(p.drivingAgeLicenceRate),
});

mkdirSync(OUT, { recursive: true });

// ---------- region-summary.json ----------
const regionProfiles = ALL_YEARS.map((y) => profileOut(profileOf(y, "durham")));
writeFileSync(
  resolve(OUT, "region-summary.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), profiles: regionProfiles }),
);

// ---------- historical-trends.json ----------
/**
 * Every series lists all eight cycles. Each point carries its own basis and
 * status: points on a different collection basis than the series anchor keep
 * their value but are flagged, so charts draw them as isolated markers —
 * never connected through a method change.
 */
const seriesValue = (
  id: string,
  label: string,
  unit: string,
  comparability: "strong" | "caution",
  note: string,
  get: (p: DerivedProfile) => number | null | Share,
  opts: { tripBasis?: boolean } = {},
) => {
  const anchorBasis = "trips-age-11plus";
  return {
    id,
    label,
    unit,
    comparability,
    note,
    anchorBasis: opts.tripBasis ? anchorBasis : "demographics",
    points: ALL_YEARS.map((y) => {
      const p = profileOf(y, "durham");
      const v = get(p);
      const value = typeof v === "number" ? v : v?.value ?? null;
      const status = typeof v === "number" ? (value === null ? "missing" : "observed") : v?.status ?? "missing";
      const basisId = opts.tripBasis ? p.tripBasisId : "demographics";
      return { year: y, value, status, basisId, comparable: !opts.tripBasis || basisId === anchorBasis };
    }),
  };
};

const historical = {
  generatedAt: new Date().toISOString(),
  methodologyBreak: {
    year: 2022,
    summary:
      "In 2022 the TTS collected trips for household members aged 5 and older (11 and older in 1991–2016; 6 and older in 1986) and captured walking trips more completely. 2022 trip counts and mode shares are not directly comparable with earlier cycles; 1986's 6+ basis also differs from the 1991–2016 series.",
  },
  series: [
    seriesValue("population", "Population (survey estimate)", "persons", "strong", "All household members, all cycles.", (p) => p.persons),
    seriesValue("households", "Households", "households", "strong", "", (p) => p.households),
    seriesValue("licensed_drivers", "Licensed drivers", "persons", "strong", "", (p) => p.drivers),
    seriesValue("avg_vehicles", "Vehicles per household", "vehicles", "strong", "'5 or more' counted as 5; means slightly low, and the bias need not be identical across communities.", (p) => p.avgVehiclesPerHousehold),
    seriesValue("zero_vehicle_share", "Households with no vehicle", "percent", "strong", "Share of households.", (p) => p.zeroVehicleHouseholdShare),
    seriesValue("work_at_home", "Work at home (share of employed)", "percent", "strong", "1986 not computable: the part-time-at-home cell is suppressed, affecting numerator and denominator.", (p) => p.workAtHomeShare),
    seriesValue("seniors_share", "Population 65+ (share)", "percent", "strong", "Share of all residents; approximate where an older-age cell is suppressed.", (p) => p.seniorsShare),
    seriesValue("children_share", "Population 0–14 (share)", "percent", "strong", "Share of all residents.", (p) => p.childrenShare),
    seriesValue("toronto_work_share", "Usual workplace in Toronto (share of employed)", "percent", "strong", "Employed residents whose usual workplace is in Toronto. (The stricter usual-workplace denominator is never complete — small area cells are suppressed — so employed residents is the denominator.)", (p) => p.torontoWorkShare),
    seriesValue("trips_total", "Weekday trips by residents", "trips", "caution", "1986 (ages 6+) and 2022 (ages 5+) points are drawn from different collection bases and are never connected to the 1991–2016 line.", (p) => p.tripsTotal, { tripBasis: true }),
    seriesValue("transit_share", "Transit share of weekday trips", "percent", "caution", "1991–2016 line only; 1986 and 2022 points are different-basis markers.", (p) => p.modeShares.transit, { tripBasis: true }),
    seriesValue("auto_driver_share", "Auto-driver share of weekday trips", "percent", "caution", "1991–2016 line only; 1986 and 2022 points are different-basis markers.", (p) => p.modeShares.autoDriver, { tripBasis: true }),
    seriesValue("walk_share", "Walking share of weekday trips", "percent", "caution", "1991–2016 line only; 2016 is the most comparable older cycle.", (p) => p.modeShares.walk, { tripBasis: true }),
    seriesValue("bike_share", "Cycling share of weekday trips", "percent", "caution", "1991–2016 line only.", (p) => p.modeShares.bicycle, { tripBasis: true }),
  ],
};
writeFileSync(resolve(OUT, "historical-trends.json"), JSON.stringify(historical));

// ---------- planning-districts-2022.json ----------
const munProfiles = MUN_IDS.map((id) => profileOf(2022, id));
const munProfiles2016 = new Map(MUN_IDS.map((id) => [id, profileOf(2016, id)]));

const rank = (values: { id: string; value: number | null }[], id: string): number | null => {
  const sorted = values.filter((v) => v.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const idx = sorted.findIndex((v) => v.id === id);
  return idx === -1 ? null : idx + 1;
};

const rankFields = (get: (p: DerivedProfile) => number | null | Share) => {
  const values = munProfiles.map((p) => ({ id: p.geographyId, value: typeof get(p) === "number" ? (get(p) as number) : (get(p) as Share)?.value ?? null }));
  return { rank: (gid: string) => rank(values, gid) };
};

const est = (v: number | null, status: string): Estimate => ({
  value: v,
  status: status === "observed" || status === "partial" ? (status as "observed" | "partial") : "missing",
});

const municipalities = munProfiles.map((p) => {
  const prev = munProfiles2016.get(p.geographyId)!;
  // Relative change needs a nonzero 2016 *baseline* (checked first, not the
  // current value); share changes are percentage points with carried states.
  const deltaPct = (get: (x: DerivedProfile) => number | null) =>
    pctChange(est(get(p), "observed"), est(get(prev), "observed")).value;
  const pp = (get: (x: DerivedProfile) => Share) =>
    diffPp(
      { value: get(p).value, status: get(p).status === "observed" ? "observed" : "partial" },
      { value: get(prev).value, status: get(prev).status === "observed" ? "observed" : "partial" },
    ).value;
  return {
    ...profileOut(p),
    // Explicit prior-year endpoints — never reconstruct them as
    // value − (change ?? 0). Statuses travel with the values.
    prior2016: {
      workAtHomeShare: shareOut(prev.workAtHomeShare),
      zeroVehicleHouseholdShare: shareOut(prev.zeroVehicleHouseholdShare),
      torontoWorkShare: shareOut(prev.torontoWorkShare),
      seniorsShare: shareOut(prev.seniorsShare),
      persons: prev.persons,
      households: prev.households,
      avgVehiclesPerHousehold: prev.avgVehiclesPerHousehold,
      modeShares: {
        autoDriver: shareOut(prev.modeShares.autoDriver),
        transit: shareOut(prev.modeShares.transit),
        walk: shareOut(prev.modeShares.walk),
      },
    },
    change2016to2022: {
      persons: deltaPct((x) => x.persons),
      households: deltaPct((x) => x.households),
      avgVehiclesPerHousehold: deltaPct((x) => x.avgVehiclesPerHousehold),
      zeroVehicleHouseholdShare: pp((x) => x.zeroVehicleHouseholdShare),
      workAtHomeShare: pp((x) => x.workAtHomeShare),
      torontoWorkShare: pp((x) => x.torontoWorkShare),
      seniorsShare: pp((x) => x.seniorsShare),
    },
    ranks: {
      transitShare: rankFields((x) => x.modeShares.transit).rank(p.geographyId),
      zeroVehicleShare: rankFields((x) => x.zeroVehicleHouseholdShare).rank(p.geographyId),
      walkShare: rankFields((x) => x.modeShares.walk).rank(p.geographyId),
      vehiclesPerHousehold: rankFields((x) => x.avgVehiclesPerHousehold).rank(p.geographyId),
      torontoWorkShare: rankFields((x) => x.torontoWorkShare).rank(p.geographyId),
    },
  };
});

const region2022 = profileOut(profileOf(2022, "durham"));
writeFileSync(
  resolve(OUT, "planning-districts-2022.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    region: region2022,
    municipalities,
  }),
);

// ---------- wards-2022.json ----------
const wardGeos = geographies.filter((g) => g.type === "ward");
const wardIds = wardGeos.map((g) => g.id);
const wardGroups = wardIds.map((id) => {
  const recs = groups.get(`2022|${id}`);
  return recs ? profileOut(deriveProfile(recs)) : null;
});
const wards = wardGroups.filter((x): x is NonNullable<typeof x> => x !== null);
writeFileSync(resolve(OUT, "wards-2022.json"), JSON.stringify({ generatedAt: new Date().toISOString(), region: region2022, wards }));

for (const f of ["region-summary.json", "historical-trends.json", "planning-districts-2022.json", "wards-2022.json"]) {
  const kb = readFileSync(resolve(OUT, f)).length / 1024;
  console.log(`story-data: ${f} (${kb.toFixed(0)} KB)`);
}
console.log("story-data: done");
