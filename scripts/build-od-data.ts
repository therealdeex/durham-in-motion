/**
 * Builds public/data/od-flows.json — the curated origin–destination dataset
 * the story chapters consume — from the four authenticated iDRS extracts.
 * Also prints the headline numbers for eyeball verification (golden values
 * are asserted in tests/data/od.test.ts).
 *
 * Aggregation happens here, at build time: the browser never sees a raw
 * 100×103 matrix, only municipality-level flows, profiles and mode contexts.
 *
 * Population-scope labels (docs/tts-audit-2026-09.md A02/A03):
 *  - "trips by Durham households" — all trips by members of Durham
 *    households, wherever they start (matrix total);
 *  - "trips originating in <municipality>" — the origin-profile scope;
 *  - destinationTrips is Durham-household trips ENDING in a municipality
 *    (including trips that started there) — never "all inbound visitors".
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadOdDataset,
  getTotalTrips,
  getInternalTrips,
  getInternalShare,
  getDurhamToTorontoTrips,
  getTorontoToDurhamTrips,
  getMunicipalityPairFlows,
  getMunicipalityOriginProfile,
  getMunicipalityDestinationProfile,
  getModeContexts,
  getRegionTravelProfile,
  getLocalComposition,
  getComparable2022,
  getFull2022Modes,
  MUNI_IDS,
  MUNI_NAMES,
  MODE_GROUP_ORDER,
  MODE_GROUP_LABEL,
  groupLabel,
} from "./lib/od.ts";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "public/data/od-flows.json");

const ds = loadOdDataset();

const total = getTotalTrips(ds);
const internal = getInternalTrips(ds);
const toToronto = getDurhamToTorontoTrips(ds);
const fromToronto = getTorontoToDurhamTrips(ds);

// Flows from Durham origins, by destination group (for region-level orbit).
const profiles = MUNI_IDS.map((id) => getMunicipalityOriginProfile(ds, id));
const destinationProfiles = MUNI_IDS.map((id) => getMunicipalityDestinationProfile(ds, id));
const regionProfile = getRegionTravelProfile(ds);
const pairs = getMunicipalityPairFlows(ds).sort((a, b) => b.totalTwoWay - a.totalTwoWay);

const durhamOriginSum = profiles.reduce((s, p) => s + p.originTrips, 0);

// Public practitioner matrix: ONLY the eight Durham origin rows — the extract
// does not license zero rows for origins it does not cover. Explicit row and
// column ids; every documented row is populated. Audit A03: the old 11×11
// allocation fabricated zero rows for non-Durham origins.
const matrixOut = (() => {
  const rows = MUNI_IDS;
  const cols = [...MUNI_IDS, "toronto", "outside", "external"];
  const isMuni = new Set(MUNI_IDS);
  const nameGroup = (name: string): string | null => {
    if (MUNI_IDS.some((id) => MUNI_NAMES[id] === name)) return MUNI_IDS.find((id) => MUNI_NAMES[id] === name)!;
    if (/^PD \d+ of Toronto$/.test(name)) return "toronto";
    if (name === "External") return "external";
    return "outside";
  };
  const agg = rows.map(() => cols.map(() => 0));
  for (let i = 0; i < ds.matrix.rowNames.length; i++) {
    const r = nameGroup(ds.matrix.rowNames[i]!);
    if (!r || !isMuni.has(r)) continue;
    for (let j = 0; j < ds.matrix.colNames.length; j++) {
      const c = nameGroup(ds.matrix.colNames[j]!);
      if (!c) continue;
      agg[rows.indexOf(r)]![cols.indexOf(c)]! += ds.matrix.values[i]![j]!;
    }
  }
  return {
    rowIds: rows,
    columnIds: cols,
    rowLabels: rows.map((r) => MUNI_NAMES[r]!),
    columnLabels: cols.map((c) =>
      isMuni.has(c) ? MUNI_NAMES[c]! : c === "toronto" ? "Toronto" : c === "outside" ? "Elsewhere in survey area" : "Beyond survey area",
    ),
    values: agg,
  };
})();

const comparable = getComparable2022(ds);
const full2022 = getFull2022Modes(ds);

const displayFloor = 1000;

const file = {
  generatedAt: new Date().toISOString(),
  provenance: {
    sourceType: "DMG iDRS",
    surveyYear: 2022,
    dataset: "Trip",
    expansionApplied: true,
    filters: ["Regional municipality of household = Durham"],
    rows: "Planning district of origin",
    columns: "Planning district of destination",
    modeBy: "Primary travel mode",
    comparableExtractFilter: ["Regional municipality of household = Durham", "Exclude for comparisons with 2016 or earlier TTS = 0"],
    queryDate: "2026-09-23",
    authorization: "Authorized for public use within the scope recorded in docs/data-permissions.md",
    note: "Origin–destination lines show where trips begin and end, not the roads or transit routes used.",
    populationScope:
      "All OD figures are weekday trips by members of Durham households (household region = Durham), 2022 TTS, expanded. They are not trips by residents of any one municipality unless the field says so, and never count visitors from outside Durham.",
  },
  modeGroups: Object.fromEntries(MODE_GROUP_ORDER.map((g) => [g, MODE_GROUP_LABEL[g]])),
  totals: {
    allTrips: total,
    internalTrips: internal,
    internalShare: internal / total,
    toToronto,
    fromToronto,
    /** Durham-origin trips to destinations outside Durham and Toronto
     * (surveyed area + beyond it). */
    toOutside: durhamOriginSum - internal - toToronto,
    durhamOriginTrips: durhamOriginSum,
  },
  pairs,
  regionProfile,
  /** Mutually exclusive composition of ALL Durham-household trips. */
  localComposition: getLocalComposition(ds),
  profiles: profiles.map((p) => ({
    ...p,
    // Complete aggregated distribution for lists, arcs and predicates.
    destinations: p.destinations.map((f) => ({
      destinationId: f.destinationId,
      destinationName: f.destinationName,
      group: f.group,
      groupLabel: groupLabel[f.group],
      trips: f.trips,
      share: f.trips / p.originTrips,
    })),
    // Convenience display slice (already sorted by trips).
    topDestinations: p.destinations.slice(0, 8).map((f) => ({
      destinationId: f.destinationId,
      destinationName: f.destinationName,
      group: f.group,
      groupLabel: groupLabel[f.group],
      trips: f.trips,
      share: f.trips / p.originTrips,
    })),
  })),
  destinationProfiles,
  modeContexts: getModeContexts(ds),
  comparable2022: comparable,
  full2022Modes: full2022,
  display: {
    /** Editorial display floor for OD lines/lists (expanded trips). Applied
     * to what is *shown* only; every total, share and ranking uses the
     * complete distribution. This is a readability choice — NOT a disclosure
     * rule and NOT a sample-reliability test. */
    floor: displayFloor,
    appliesTo: ["destination lists", "connection maps"],
    note: "Destinations or corridors below the floor are hidden from lists and maps; the hidden count is shown where useful.",
  },
  matrix: matrixOut,
};

writeFileSync(OUT, JSON.stringify(file));

const kb = readFileSync(OUT).length / 1024;
console.log(`od: wrote public/data/od-flows.json (${kb.toFixed(0)} KB)`);
console.log(`od: total=${total.toLocaleString("en-CA")} internal=${internal.toLocaleString("en-CA")} share=${((internal / total) * 100).toFixed(2)}%`);
console.log(`od: durham→toronto=${toToronto.toLocaleString("en-CA")} toronto→durham=${fromToronto.toLocaleString("en-CA")}`);
console.log(`od: region same=${regionProfile.sameMunicipality.toLocaleString("en-CA")} cross=${regionProfile.elsewhereInDurham.toLocaleString("en-CA")}`);
console.log(`od: localComposition ${JSON.stringify(getLocalComposition(ds))}`);
console.log(`od: comparable2022 total=${comparable.total.toLocaleString("en-CA")} transit=${(comparable.groups.transit ?? 0).toLocaleString("en-CA")} (${(((comparable.groups.transit ?? 0) / comparable.total) * 100).toFixed(2)}%)`);
console.log(`od: full2022 total=${full2022.total.toLocaleString("en-CA")}`);
console.log("od: top pairs", pairs.slice(0, 4).map((p) => `${MUNI_NAMES[p.a]!}↔${MUNI_NAMES[p.b]!}=${Math.round(p.totalTwoWay).toLocaleString("en-CA")}`).join("  "));
