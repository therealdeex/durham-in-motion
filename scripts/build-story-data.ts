/**
 * Builds the curated public data files the site consumes:
 *   public/data/region-summary.json         — region profiles, all 8 cycles
 *   public/data/historical-trends.json      — named series for the Long View
 *   public/data/planning-districts-2022.json— 8 municipalities + rankings
 *   public/data/wards-2022.json             — ward profiles
 *
 * All values derive deterministically from data/processed/normalized.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { deriveProfile, groupByGeographyYear, type DerivedProfile, type Share } from "./lib/derive.ts";
import type { NormalizedRecord } from "./lib/read-files.ts";

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
  workAtHomeShare: shareOut(p.workAtHomeShare),
  workersWithUsualPlace: p.workersWithUsualPlace,
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
const seriesValue = (
  id: string,
  label: string,
  unit: string,
  comparability: "strong" | "caution" | "not_comparable",
  note: string,
  get: (p: DerivedProfile) => number | null | Share,
  years = ALL_YEARS,
) => ({
  id,
  label,
  unit,
  comparability,
  note,
  points: years.map((y) => {
    const v = get(profileOf(y, "durham"));
    const value = typeof v === "number" ? v : v?.value ?? null;
    const status = typeof v === "number" ? (value === null ? "missing" : "observed") : v?.status ?? "missing";
    return { year: y, value, status };
  }),
});

const historical = {
  generatedAt: new Date().toISOString(),
  methodologyBreak: {
    year: 2022,
    summary:
      "In 2022 the TTS collected trips for household members aged 5 and older (11 and older in earlier cycles) and captured walking trips more completely. Trip counts and mode shares from 2022 are not directly comparable with earlier cycles.",
  },
  series: [
    seriesValue("population", "Population (survey estimate)", "persons", "strong", "All household members, all cycles.", (p) => p.persons),
    seriesValue("households", "Households", "households", "strong", "", (p) => p.households),
    seriesValue("licensed_drivers", "Licensed drivers", "persons", "strong", "", (p) => p.drivers),
    seriesValue("avg_vehicles", "Vehicles per household", "vehicles", "strong", "'5 or more' counted as 5; means slightly low, applied uniformly.", (p) => p.avgVehiclesPerHousehold),
    seriesValue("zero_vehicle_share", "Households with no vehicle", "percent", "strong", "", (p) => p.zeroVehicleHouseholdShare),
    seriesValue("work_at_home", "Work at home (share of employed)", "percent", "strong", "1986 part-time-at-home suppressed.", (p) => p.workAtHomeShare),
    seriesValue("seniors_share", "Population 65+ (share)", "percent", "strong", "", (p) => p.seniorsShare),
    seriesValue("children_share", "Population 0–14 (share)", "percent", "strong", "", (p) => p.childrenShare),
    seriesValue("toronto_work_share", "Usual workplace in Toronto (share of workers)", "percent", "strong", "", (p) => p.torontoWorkShare),
    seriesValue("trips_total", "Weekday trips by residents", "trips", "caution", "Pre-2022 cycles only; 2022 trip counts are not comparable (ages 5+, fuller walking capture).", (p) => p.tripsTotal, ALL_YEARS.filter((y) => y < 2022)),
    seriesValue("transit_share", "Transit share of weekday trips", "percent", "caution", "Pre-2022 cycles only.", (p) => p.modeShares.transit, ALL_YEARS.filter((y) => y < 2022)),
    seriesValue("auto_driver_share", "Auto-driver share of weekday trips", "percent", "caution", "Pre-2022 cycles only.", (p) => p.modeShares.autoDriver, ALL_YEARS.filter((y) => y < 2022)),
    seriesValue("walk_share", "Walking share of weekday trips", "percent", "caution", "Pre-2022 cycles only; 2016 is the most comparable older cycle.", (p) => p.modeShares.walk, ALL_YEARS.filter((y) => y < 2022)),
    seriesValue("bike_share", "Cycling share of weekday trips", "percent", "caution", "Pre-2022 cycles only.", (p) => p.modeShares.bicycle, ALL_YEARS.filter((y) => y < 2022)),
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
  const regionValue = get(profileOf(2022, "durham"));
  return { rank: (gid: string) => rank(values, gid), regionValue };
};

const municipalities = munProfiles.map((p) => {
  const prev = munProfiles2016.get(p.geographyId)!;
  const pct = (a: number | null, b: number | null) => (a !== null && b !== null && a !== 0 ? (a - b) / b : null);
  const deltaPct = (get: (x: DerivedProfile) => number | null) => pct(get(p), get(prev));
  const pp = (get: (x: DerivedProfile) => Share) =>
    get(p).value !== null && get(prev).value !== null ? (get(p).value as number) - (get(prev).value as number) : null;
  return {
    ...profileOut(p),
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
writeFileSync(
  resolve(OUT, "wards-2022.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), region: region2022, wards }),
);

for (const f of ["region-summary.json", "historical-trends.json", "planning-districts-2022.json", "wards-2022.json"]) {
  const kb = readFileSync(resolve(OUT, f)).length / 1024;
  console.log(`story-data: ${f} (${kb.toFixed(0)} KB)`);
}
console.log("story-data: done");
