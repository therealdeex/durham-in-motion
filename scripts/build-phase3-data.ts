/**
 * Phase 3 ETL: normalize the widened iDRS extracts into
 * data/processed/phase3/normalized.json and write the extraction manifest to
 * data/processed/phase3/extractions.json (handoff §1, §19).
 *
 * Raw extracts (data/raw/idrs/phase3/) are never modified or republished;
 * this step fails loudly if any of them is missing. Reconciliation totals are
 * asserted in tests/data/phase3.test.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGE_GROUPS,
  DISTANCE_BANDS,
  EXTRACTIONS,
  VEHICLE_GROUPS,
  ageGroupOf,
  distanceBandOf,
  extractionProvenance,
  muniIdOfLabel,
  parseMatrixBlocks,
  parseTripletBlocks,
  readExtract,
  relationshipOf,
  sideGroupOfLabel,
  slotOfDay,
  slotLabel,
  vehicleGroupOf,
} from "./lib/phase3.ts";
import { MUNI_NAMES, MUNI_PD_CODE, MODE_GROUP_ORDER, modeGroupOf } from "./lib/od.ts";

const OUT_DIR = resolve(import.meta.dirname, "..", "data/processed/phase3");

const zero = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

// ---------------------------------------------------------------------------
// Query A/B — all-households OD matrix
// ---------------------------------------------------------------------------

const allMatrix = parseMatrixBlocks(readExtract("tts2022_od_pd_all-households.csv"))[0]!;
const unexpMatrix = parseMatrixBlocks(readExtract("tts2022_od_pd_all-households_unexpanded.csv"))[0]!;

if (allMatrix.rowNames.length !== unexpMatrix.rowNames.length) {
  throw new Error("A/B mismatch: unexpanded matrix keys differ from expanded");
}

/** relationship × (origin group × destination group) and per-muni balances. */
const relTrips = zero(["internal_durham", "inbound_to_durham", "outbound_from_durham", "outside_durham"]);
const relSupport = zero(["internal_durham", "inbound_to_durham", "outbound_from_durham", "outside_durham"]);
/** Inbound/outbound per destination/origin Durham municipality. */
const muniInbound = zero(Object.keys(MUNI_NAMES) as (keyof typeof MUNI_NAMES)[]);
const muniInboundSupport = zero(Object.keys(MUNI_NAMES) as (keyof typeof MUNI_NAMES)[]);
const muniOutbound = zero(Object.keys(MUNI_NAMES) as (keyof typeof MUNI_NAMES)[]);
const muniOutboundExternal = zero(Object.keys(MUNI_NAMES) as (keyof typeof MUNI_NAMES)[]);

for (let i = 0; i < allMatrix.rowNames.length; i++) {
  const oGroup = sideGroupOfLabel(allMatrix.rowNames[i]!);
  const oMuni = muniIdOfLabel(allMatrix.rowNames[i]!);
  for (let j = 0; j < allMatrix.colNames.length; j++) {
    const v = allMatrix.values[i]![j]!;
    const s = unexpMatrix.values[i]![j]!;
    const dGroup = sideGroupOfLabel(allMatrix.colNames[j]!);
    const rel = relationshipOf(oGroup, dGroup);
    relTrips[rel]! += v;
    relSupport[rel]! += s;
    const dMuni = muniIdOfLabel(allMatrix.colNames[j]!);
    if (oMuni !== null && dMuni === null) {
      muniOutbound[oMuni as keyof typeof MUNI_NAMES]! += v;
      if (dGroup === "external") muniOutboundExternal[oMuni as keyof typeof MUNI_NAMES]! += v;
    }
    if (dMuni !== null && oMuni === null) {
      muniInbound[dMuni as keyof typeof MUNI_NAMES]! += v;
      muniInboundSupport[dMuni as keyof typeof MUNI_NAMES]! += s;
    }
  }
}

const odAll = {
  universe: allMatrix.total,
  universeSurveyRecords: unexpMatrix.total,
  relationships: relTrips,
  relationshipsSurveyRecords: relSupport,
  inboundOutboundRatio: relTrips.inbound_to_durham / relTrips.outbound_from_durham,
  byMunicipality: Object.fromEntries(
    (Object.keys(MUNI_NAMES) as (keyof typeof MUNI_NAMES)[]).map((m) => [
      m,
      {
        inbound: muniInbound[m]!,
        inboundSurveyRecords: muniInboundSupport[m]!,
        outboundAllExternal: muniOutbound[m]!,
        outboundBeyondSurveyArea: muniOutboundExternal[m]!,
        netFlow: muniInbound[m]! - muniOutbound[m]!,
      },
    ]),
  ),
};

// ---------------------------------------------------------------------------
// Queries C/D/D2 — mode and purpose flows for ALL households
// ---------------------------------------------------------------------------

/** Sum a triplet-block dataset (numeric PD codes) into flow-direction × category trips. */
function flowsByCategory(
  filename: string,
  classify: (label: string) => string,
): { inbound: Record<string, number>; outbound: Record<string, number>; internal: Record<string, number>; total: number } {
  const { blocks, total } = parseTripletBlocks(readExtract(filename));
  const out = { inbound: {} as Record<string, number>, outbound: {} as Record<string, number>, internal: {} as Record<string, number>, total };
  for (const b of blocks) {
    const cat = classify(b.label);
    for (const c of b.cells) {
      const oGroup = sideGroupOfLabel(pdLabelOfCode(c.a));
      const dGroup = sideGroupOfLabel(pdLabelOfCode(c.b));
      const rel = relationshipOf(oGroup, dGroup);
      if (rel === "inbound_to_durham") out.inbound[cat] = (out.inbound[cat] ?? 0) + c.trips;
      else if (rel === "outbound_from_durham") out.outbound[cat] = (out.outbound[cat] ?? 0) + c.trips;
      else if (rel === "internal_durham") out.internal[cat] = (out.internal[cat] ?? 0) + c.trips;
    }
  }
  return out;
}

/** Same aggregation for matrix-block datasets (PD-name rows/columns). */
function flowsByCategoryMatrix(
  filename: string,
  classify: (label: string) => string,
): { inbound: Record<string, number>; outbound: Record<string, number>; internal: Record<string, number>; total: number } {
  const blocks = parseMatrixBlocks(readExtract(filename));
  const out = { inbound: {} as Record<string, number>, outbound: {} as Record<string, number>, internal: {} as Record<string, number>, total: 0 };
  for (const b of blocks) {
    const cat = classify(b.label);
    for (let i = 0; i < b.rowNames.length; i++) {
      const oGroup = sideGroupOfLabel(b.rowNames[i]!);
      for (let j = 0; j < b.colNames.length; j++) {
        const v = b.values[i]![j]!;
        if (v === 0) continue;
        const dGroup = sideGroupOfLabel(b.colNames[j]!);
        const rel = relationshipOf(oGroup, dGroup);
        if (rel === "inbound_to_durham") out.inbound[cat] = (out.inbound[cat] ?? 0) + v;
        else if (rel === "outbound_from_durham") out.outbound[cat] = (out.outbound[cat] ?? 0) + v;
        else if (rel === "internal_durham") out.internal[cat] = (out.internal[cat] ?? 0) + v;
      }
    }
  }
  out.total = Object.values(out.inbound).reduce((a, b) => a + b, 0)
    + Object.values(out.outbound).reduce((a, b) => a + b, 0)
    + Object.values(out.internal).reduce((a, b) => a + b, 0);
  return out;
}

/** Numeric PD code → iDRS label, using the anchor rules (Toronto codes 1–16,
 *  Durham 17–24, 998 External). Other codes stay numeric — their group
 *  ("elsewhere") is all the aggregation needs. */
const PD_CODE_TO_MUNI = new Map(Object.entries(MUNI_PD_CODE).map(([id, code]) => [code, MUNI_NAMES[id as keyof typeof MUNI_NAMES]!]));
const pdLabelOfCode = (code: number): string => {
  if (code === 998) return "External";
  if (code >= 1 && code <= 16) return `PD ${code} of Toronto`;
  return PD_CODE_TO_MUNI.get(code) ?? `PD ${code}`;
};

const modeFlows = flowsByCategory("tts2022_od_municipality_all-households_by-mode.csv", modeGroupOf);
const purposeFlows = flowsByCategoryMatrix("tts2022_od_municipality_all-households_by-purpose.csv", (l) => l);
const destPurposeFlows = flowsByCategory("tts2022_od_municipality_all-households_by-destination-purpose.csv", (l) => l);

// ---------------------------------------------------------------------------
// Query E — purpose geography for Durham households
// ---------------------------------------------------------------------------

const eBlocks = parseMatrixBlocks(readExtract("tts2022_od_pd_durham-residents_by-purpose.csv"));
const residentPurposeFlows = eBlocks.map((b) => {
  let same = 0;
  let crossDurham = 0;
  let toronto = 0;
  let elsewhere = 0;
  for (let i = 0; i < b.rowNames.length; i++) {
    const oMuni = muniIdOfLabel(b.rowNames[i]!);
    for (let j = 0; j < b.colNames.length; j++) {
      const v = b.values[i]![j]!;
      const dMuni = muniIdOfLabel(b.colNames[j]!);
      if (oMuni !== null && dMuni !== null) {
        if (oMuni === dMuni) same += v;
        else crossDurham += v;
      } else if (oMuni !== null && sideGroupOfLabel(b.colNames[j]!) === "toronto") toronto += v;
      else if (oMuni !== null) elsewhere += v;
    }
  }
  return { purpose: b.label, durhamOrigin: { same, crossDurham, toronto, elsewhere }, blockTotal: b.total };
});

// ---------------------------------------------------------------------------
// Queries F/G/H — the travel day
// ---------------------------------------------------------------------------

interface Slot {
  slot: number;
  label: string;
  trips: number;
  surveyRecords: number;
  byMode: Record<string, number>;
  byPurpose: Record<string, number>;
}

function buildDay(): { durhamResidents: Slot[]; departing: { slot: number; label: string; total: number; internal: number; outbound: number }[]; arriving: { slot: number; label: string; total: number; internal: number; inbound: number }[] } {
  const fExp = parseMatrixBlocks(readExtract("tts2022_time_mode_purpose_durham-residents.csv"));
  const fUnexp = parseMatrixBlocks(readExtract("tts2022_time_mode_purpose_durham-residents_unexpanded.csv"));

  const slotMap = new Map<number, Slot>();
  const ensure = (t: number): Slot => {
    const slot = slotOfDay(t);
    let s = slotMap.get(slot);
    if (!s) {
      s = { slot, label: slotLabel(t), trips: 0, surveyRecords: 0, byMode: {}, byPurpose: {} };
      slotMap.set(slot, s);
    }
    return s;
  };
  for (const block of fExp) {
    const purpose = block.label;
    for (let i = 0; i < block.rowNames.length; i++) {
      const t = Number(block.rowNames[i]);
      if (!Number.isFinite(t)) throw new Error(`F: non-numeric start_time "${block.rowNames[i]}"`);
      const s = ensure(t);
      for (let j = 0; j < block.colNames.length; j++) {
        const v = block.values[i]![j]!;
        if (v === 0) continue;
        s.trips += v;
        const mode = modeGroupOf(block.colNames[j]!);
        s.byMode[mode] = (s.byMode[mode] ?? 0) + v;
        s.byPurpose[purpose] = (s.byPurpose[purpose] ?? 0) + v;
      }
    }
  }
  for (const block of fUnexp) {
    for (let i = 0; i < block.rowNames.length; i++) {
      const t = Number(block.rowNames[i]);
      if (!Number.isFinite(t)) continue;
      const s = ensure(t);
      for (let j = 0; j < block.colNames.length; j++) s.surveyRecords += block.values[i]![j]!;
    }
  }

  const timeOd = (filename: string) =>
    parseTripletBlocks(readExtract(filename)).blocks.reduce((acc, block) => {
      // Block label = the TABLE dimension value (pd_dest NAME, e.g. "Brock");
      // cell b = the pd_orig code.
      const dGroup = sideGroupOfLabel(block.label);
      for (const c of block.cells) {
        const slot = slotOfDay(c.a);
        const oGroup = sideGroupOfLabel(pdLabelOfCode(c.b));
        let row = acc.get(slot);
        if (!row) {
          row = { slot, label: slotLabel(c.a), total: 0, internal: 0, outbound: 0, inbound: 0 };
          acc.set(slot, row);
        }
        row.total += c.trips;
        const rel = relationshipOf(oGroup, dGroup);
        if (rel === "internal_durham") row.internal += c.trips;
        if (rel === "outbound_from_durham") row.outbound += c.trips;
        if (rel === "inbound_to_durham") row.inbound += c.trips;
      }
      return acc;
    }, new Map<number, { slot: number; label: string; total: number; internal: number; outbound: number; inbound: number }>());

  const dep = timeOd("tts2022_time_od_departing-durham.csv");
  const arr = timeOd("tts2022_time_od_arriving-durham.csv");

  return {
    durhamResidents: [...slotMap.values()].sort((a, b) => a.slot - b.slot),
    departing: [...dep.values()].sort((a, b) => a.slot - b.slot).map(({ slot, label, total, internal, outbound }) => ({ slot, label, total, internal, outbound })),
    arriving: [...arr.values()].sort((a, b) => a.slot - b.slot).map(({ slot, label, total, internal, inbound }) => ({ slot, label, total, internal, inbound })),
  };
}

const day = buildDay();

// ---------------------------------------------------------------------------
// Queries I/J/K/L/M — distance, age, vehicles
// ---------------------------------------------------------------------------

function byBand(filename: string, classify: (label: string) => string) {
  const block = parseMatrixBlocks(readExtract(filename))[0]!;
  const bands: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  for (const band of DISTANCE_BANDS) bands[band] = {};
  let unbanded = 0;
  for (let i = 0; i < block.rowNames.length; i++) {
    const km = Number(block.rowNames[i]);
    if (!Number.isFinite(km)) throw new Error(`${filename}: non-numeric trip_km row "${block.rowNames[i]}"`);
    const band = distanceBandOf(km);
    for (let j = 0; j < block.colNames.length; j++) {
      const v = block.values[i]![j]!;
      if (v === 0) continue;
      const cat = classify(block.colNames[j]!);
      bands[band]![cat] = (bands[band]![cat] ?? 0) + v;
      totals[cat] = (totals[cat] ?? 0) + v;
      unbanded += v;
    }
  }
  return { bands, totals, grandTotal: unbanded };
}

const distanceByMode = byBand("tts2022_trip-distance_by-mode_durham-residents.csv", modeGroupOf);
const distanceByPurpose = byBand("tts2022_trip-distance_by-purpose_durham-residents.csv", (l) => l);

function byAge(filename: string, classify: (label: string) => string) {
  const block = parseMatrixBlocks(readExtract(filename))[0]!;
  const native: Record<string, Record<string, number>> = {};
  const groups: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  for (const g of AGE_GROUPS) groups[g] = {};
  let total = 0;
  for (let i = 0; i < block.rowNames.length; i++) {
    const label = block.rowNames[i]!;
    const g = ageGroupOf(label);
    native[label] = {};
    for (let j = 0; j < block.colNames.length; j++) {
      const v = block.values[i]![j]!;
      if (v === 0) continue;
      const cat = classify(block.colNames[j]!);
      native[label]![cat] = (native[label]![cat] ?? 0) + v;
      groups[g]![cat] = (groups[g]![cat] ?? 0) + v;
      totals[cat] = (totals[cat] ?? 0) + v;
      total += v;
    }
  }
  return { native, groups, totals, total };
}

const ageByMode = byAge("tts2022_age_by-mode_durham-residents.csv", modeGroupOf);
const ageByModeSupport = byAge("tts2022_age_by-mode_durham-residents_unexpanded.csv", modeGroupOf);
const ageByPurpose = byAge("tts2022_age_by-purpose_durham-residents.csv", (l) => l);

const vehiclesBlock = parseMatrixBlocks(readExtract("tts2022_household-vehicles_by-mode_durham-residents.csv"))[0]!;
const vehiclesByMode = (() => {
  const groups: Record<string, Record<string, number>> = {};
  for (const g of VEHICLE_GROUPS) groups[g] = {};
  let total = 0;
  for (let i = 0; i < vehiclesBlock.rowNames.length; i++) {
    const g = vehicleGroupOf(Number(vehiclesBlock.rowNames[i]));
    for (let j = 0; j < vehiclesBlock.colNames.length; j++) {
      const v = vehiclesBlock.values[i]![j]!;
      if (v === 0) continue;
      const mode = modeGroupOf(vehiclesBlock.colNames[j]!);
      groups[g]![mode] = (groups[g]![mode] ?? 0) + v;
      total += v;
    }
  }
  return { groups, total };
})();

// ---------------------------------------------------------------------------
// Queries N/O/P — transit journey
// ---------------------------------------------------------------------------

const goBoardings = parseMatrixBlocks(readExtract("tts2022_go-boardings_access-type_origin-pd_durham-residents.csv"));
const accessTypes = goBoardings[0]!.colNames;
const boardingsByStation: Record<string, number> = {};
const accessByStation: Record<string, Record<string, number>> = {};
const accessByOriginPd: Record<string, Record<string, number>> = {};
let goTrips = 0;
for (const block of goBoardings) {
  const originPd = block.label;
  for (let i = 0; i < block.rowNames.length; i++) {
    const station = block.rowNames[i]!;
    for (let j = 0; j < block.colNames.length; j++) {
      const v = block.values[i]![j]!;
      if (v === 0) continue;
      if (station !== "GO Rail not used") {
        boardingsByStation[station] = (boardingsByStation[station] ?? 0) + v;
        accessByStation[station] ??= {};
        accessByStation[station]![block.colNames[j]!] = (accessByStation[station]![block.colNames[j]!] ?? 0) + v;
        goTrips += v;
      }
      accessByOriginPd[originPd] ??= {};
      accessByOriginPd[originPd]![block.colNames[j]!] = (accessByOriginPd[originPd]![block.colNames[j]!] ?? 0) + v;
    }
  }
}

const stationOd = (() => {
  const block = parseMatrixBlocks(readExtract("tts2022_go_station_od_durham-residents.csv"))[0]!;
  const unexp = parseMatrixBlocks(readExtract("tts2022_go_station_od_durham-residents_unexpanded.csv"))[0]!;
  const support = new Map<string, number>();
  for (let i = 0; i < unexp.rowNames.length; i++) {
    for (let j = 0; j < unexp.colNames.length; j++) {
      support.set(`${unexp.rowNames[i]}→${unexp.colNames[j]}`, unexp.values[i]![j]!);
    }
  }
  const od: { from: string; to: string; trips: number; surveyRecords: number }[] = [];
  for (let i = 0; i < block.rowNames.length; i++) {
    // "GO Rail not used" rows/cols are the local-transit-only journeys sharing
    // this matrix; they are not a station and are excluded from the ranking
    // (their 32,017 journeys are captured by linksByAccessNonGo).
    const from = block.rowNames[i]!;
    if (from === "GO Rail not used") continue;
    for (let j = 0; j < block.colNames.length; j++) {
      const to = block.colNames[j]!;
      if (to === "GO Rail not used") continue;
      const v = block.values[i]![j]!;
      if (v === 0) continue;
      od.push({ from, to, trips: v, surveyRecords: support.get(`${from}→${to}`) ?? 0 });
    }
  }
  return od.sort((a, b) => b.trips - a.trips);
})();

const routeCount = parseMatrixBlocks(readExtract("tts2022_transit_route-count_access-type_go-station.csv"));
const linksByAccess: Record<string, Record<string, number>> = {};
const linksByAccessGo: Record<string, Record<string, number>> = {};
const linksByAccessNonGo: Record<string, Record<string, number>> = {};
const addLinks = (target: Record<string, Record<string, number>>, access: string, nRoute: string, v: number) => {
  target[access] ??= {};
  target[access]![nRoute] = (target[access]![nRoute] ?? 0) + v;
};
for (const block of routeCount) {
  const isNonGo = block.label === "GO Rail not used";
  for (let i = 0; i < block.rowNames.length; i++) {
    for (let j = 0; j < block.colNames.length; j++) {
      const v = block.values[i]![j]!;
      if (v === 0) continue;
      addLinks(linksByAccess, block.colNames[j]!, block.rowNames[i]!, v);
      if (isNonGo) addLinks(linksByAccessNonGo, block.colNames[j]!, block.rowNames[i]!, v);
      else addLinks(linksByAccessGo, block.colNames[j]!, block.rowNames[i]!, v);
    }
  }
}

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------

const normalized = {
  generatedAt: new Date().toISOString(),
  populationScope: {
    allHouseholds: "Everyone in the 2022 TTS survey universe (all surveyed households GGH-wide), expanded weekday trips — not just Durham households.",
    durhamHouseholds: "Trips by members of Durham households (household region = Durham).",
    transit: "Transit records for Durham households — one record per transit journey.",
  },
  odAll,
  modeFlows,
  purposeFlows,
  destPurposeFlows,
  residentPurposeFlows,
  day,
  distanceByMode,
  distanceByPurpose,
  ageByMode,
  ageByModeSurveyRecords: ageByModeSupport.groups,
  ageByPurpose,
  vehiclesByMode,
  transit: {
    accessTypes,
    goTrips,
    boardingsByStation,
    accessByStation,
    accessByOriginPd,
    stationOd,
    linksByAccess,
    linksByAccessGo,
    linksByAccessNonGo,
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "normalized.json"), JSON.stringify(normalized));
writeFileSync(resolve(OUT_DIR, "extractions.json"), JSON.stringify({ generatedAt: new Date().toISOString(), extractions: extractionProvenance() }, null, 2));

console.log(`phase3: wrote data/processed/phase3/normalized.json`);
console.log(`phase3: universe=${odAll.universe.toLocaleString("en-CA")} records=${odAll.universeSurveyRecords.toLocaleString("en-CA")}`);
console.log(`phase3: internal=${relTrips.internal_durham.toLocaleString("en-CA")} inbound=${relTrips.inbound_to_durham.toLocaleString("en-CA")} outbound=${relTrips.outbound_from_durham.toLocaleString("en-CA")} ratio=${odAll.inboundOutboundRatio.toFixed(3)}`);
console.log(`phase3: goTrips=${goTrips.toLocaleString("en-CA")} stations=${Object.keys(boardingsByStation).length}`);
console.log(`phase3: day slots=${day.durhamResidents.length} departing=${day.departing.length} arriving=${day.arriving.length}`);
console.log(`phase3: extractions=${EXTRACTIONS.length}`);
