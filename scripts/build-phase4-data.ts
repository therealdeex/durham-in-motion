/**
 * Phase 4 ETL: turn the Phase 3 normalized extracts into the two story
 * datasets consumed by /stories/day and /stories/transit.
 *
 *  public/data/story-day.json     — the travel day in 30-minute bins:
 *    volume curve + purpose/mode composition (Query F, Durham households),
 *    boundary exchange (Queries G/H, geography-based), and municipality-level
 *    map frames (raw G/H extracts re-aggregated; the phase 3 normalized file
 *    collapses geography, so the per-municipality time flows are rebuilt here).
 *
 *  public/data/story-transit.json — the transit journey: access composition
 *    per GO station (N), station-to-station network with survey support
 *    (O + O-unexp), link complexity (P + P-unexp), and station catchments
 *    (raw N re-aggregated: station × origin municipality).
 *
 * Raw extracts are read, never republished; outputs are aggregated displays
 * within the documented authorization scope (docs/data-permissions.md).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseMatrixBlocks,
  parseTripletBlocks,
  readExtract,
  slotOfDay,
  muniIdOfLabel,
} from "./lib/phase3.ts";
import { MUNI_PD_CODE, MUNI_NAMES, MUNI_IDS } from "./lib/od.ts";

const OUT_DIR = resolve(import.meta.dirname, "..", "public/data");
const PHASE3 = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "..", "data/processed/phase3/normalized.json"), "utf8"),
) as {
  day: {
    durhamResidents: { slot: number; label: string; trips: number; surveyRecords: number; byMode: Record<string, number>; byPurpose: Record<string, number> }[];
    departing: { slot: number; total: number; internal: number; outbound: number }[];
    arriving: { slot: number; total: number; internal: number; inbound: number }[];
  };
  transit: {
    accessTypes: string[];
    goTrips: number;
    boardingsByStation: Record<string, number>;
    accessByStation: Record<string, Record<string, number>>;
    stationOd: { from: string; to: string; trips: number; surveyRecords: number }[];
    linksByAccessGo: Record<string, Record<string, number>>;
    linksByAccessNonGo: Record<string, Record<string, number>>;
    accessByOriginPd: Record<string, Record<string, number>>;
  };
  destPurposeFlows: { internal: Record<string, number> };
};

// ---------------------------------------------------------------------------
// Shared time conventions
// ---------------------------------------------------------------------------

/** Chosen after comparing 15/30/60-minute bins against the day curve: 30
 *  minutes keeps readable motion between the curated beats while even the
 *  off-peak bins keep double-digit survey-record support (see the bin support
 *  audit printed by this script). Documented in docs/phase4-build.md. */
const BIN_MINUTES = 30;
const DAY_START_MINUTES = 4 * 60;
const DAY_MINUTES = 24 * 60;
const BIN_COUNT = DAY_MINUTES / BIN_MINUTES;
/** Display floor for one 30-minute map frame: strong corridors stay visible
 *  through the day, noise stays hidden. Readability choice — totals never
 *  change (same convention as the site-wide 1,000-trip daily floor). */
const MAP_DISPLAY_FLOOR = 300;

const binOf = (t: number) => Math.floor(slotOfDay(t) / BIN_MINUTES);

/** Public 12-hour label; TTS hours ≥ 24 become intuitive post-midnight times. */
export function publicTimeLabel(minutesSinceFour: number): string {
  const total = DAY_START_MINUTES + minutesSinceFour;
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mer = h24 < 12 ? "a.m." : "p.m.";
  return `${h12}:${String(m).padStart(2, "0")} ${mer}`;
}

const surveyLabelOf = (minutesSinceFour: number): string => {
  const total = DAY_START_MINUTES + minutesSinceFour;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const ZERO_PURPOSE = {
  "Home-Based Work": 0,
  "Home-based School": 0,
  "Home-based Discretionary": 0,
  "Non Home-based": 0,
} as Record<string, number>;

// ---------------------------------------------------------------------------
// Story 1 — A Day in Durham
// ---------------------------------------------------------------------------

interface DayBin {
  t: number;
  surveyLabel: string;
  publicLabel: string;
  trips: number;
  surveyRecords: number;
  byPurpose: Record<string, number>;
  byMode: Record<string, number>;
  inbound: number;
  outbound: number;
  /** map frame — municipality flows at this moment (G/H basis) */
  self: Record<string, number>;
  pairs: { a: string; b: string; v: number }[];
  outByMuni: Record<string, number>;
  inByMuni: Record<string, number>;
}

const bins: DayBin[] = Array.from({ length: BIN_COUNT }, (_, i) => ({
  t: i * BIN_MINUTES,
  surveyLabel: surveyLabelOf(i * BIN_MINUTES),
  publicLabel: publicTimeLabel(i * BIN_MINUTES),
  trips: 0,
  surveyRecords: 0,
  byPurpose: { ...ZERO_PURPOSE },
  byMode: {},
  inbound: 0,
  outbound: 0,
  self: Object.fromEntries(MUNI_IDS.map((m) => [m, 0])),
  pairs: [],
  outByMuni: Object.fromEntries(MUNI_IDS.map((m) => [m, 0])),
  inByMuni: Object.fromEntries(MUNI_IDS.map((m) => [m, 0])),
}));

const addPurpose = (bin: DayBin, purpose: string, v: number) => {
  if (!(purpose in bin.byPurpose)) throw new Error(`unknown purpose "${purpose}"`);
  bin.byPurpose[purpose]! += v;
};

// F + F-unexp: resident volume/purpose/mode per bin
for (const s of PHASE3.day.durhamResidents) {
  const bin = bins[Math.floor(s.slot / BIN_MINUTES)]!; // F slots are minutes since 04:00
  bin.trips += s.trips;
  bin.surveyRecords += s.surveyRecords;
  for (const [p, v] of Object.entries(s.byPurpose)) addPurpose(bin, p, v);
  for (const [m, v] of Object.entries(s.byMode)) bin.byMode[m] = (bin.byMode[m] ?? 0) + v;
}

// G/H aggregates: boundary exchange per bin
for (const r of PHASE3.day.departing) bins[Math.floor(r.slot / BIN_MINUTES)]!.outbound += r.total - r.internal;
for (const r of PHASE3.day.arriving) bins[Math.floor(r.slot / BIN_MINUTES)]!.inbound += r.total - r.internal;

// Raw G: trips STARTING in Durham (any household) — municipality map frames.
// Blocks are pd_dest; cells are start_time × pd_orig (Durham codes only).
const codeToId = new Map(Object.entries(MUNI_PD_CODE).map(([id, code]) => [code, id]));
const pairTotals = new Map<string, Map<number, number>>();
{
  const g = parseTripletBlocks(readExtract("tts2022_time_od_departing-durham.csv"));
  for (const b of g.blocks) {
    const dId = muniIdOfLabel(b.label);
    for (const c of b.cells) {
      const oId = codeToId.get(c.b);
      if (!oId) throw new Error(`G: non-Durham origin code ${c.b} inside origin-filtered extract`);
      const bin = bins[binOf(c.a)]!;
      if (dId === null) {
        bin.outByMuni[oId]! += c.trips;
      } else if (dId === oId) {
        bin.self[oId]! += c.trips;
      } else {
        const key = `${[oId, dId].sort().join("|")}`;
        if (!pairTotals.has(key)) pairTotals.set(key, new Map());
        const m = pairTotals.get(key)!;
        m.set(bin.t, (m.get(bin.t) ?? 0) + c.trips);
      }
    }
  }
}
// Raw H: trips ENDING in Durham (any household) — inbound per municipality.
{
  const h = parseTripletBlocks(readExtract("tts2022_time_od_arriving-durham.csv"));
  for (const b of h.blocks) {
    const dId = muniIdOfLabel(b.label);
    if (!dId) throw new Error(`H: non-Durham destination block "${b.label}" inside dest-filtered extract`);
    for (const c of b.cells) {
      if (codeToId.has(c.b)) continue; // Durham→Durham covered by G
      bins[binOf(c.a)]!.inByMuni[dId]! += c.trips;
    }
  }
}
// apply pair display floor per frame
for (const bin of bins) {
  bin.pairs = [...pairTotals.entries()]
    .map(([key, m]) => {
      const [a, b] = key.split("|") as [string, string];
      return { a, b, v: m.get(bin.t) ?? 0 };
    })
    .filter((p) => p.v >= MAP_DISPLAY_FLOOR)
    .sort((x, y) => y.v - x.v);
}

const dayMeta = {
  binMinutes: BIN_MINUTES,
  binCount: BIN_COUNT,
  dayStartSurveyHour: 4,
  timeConvention:
    "The TTS travel day runs 04:00–27:59 (times after midnight keep their survey value, e.g. 25:00 = 1:00 a.m.). Public labels convert to intuitive times; survey labels are preserved in methodology.",
  displayFloor: MAP_DISPLAY_FLOOR,
  basis: {
    curve: "Query F: weekday trips by members of Durham households (expanded), by reported trip-start minute.",
    curveSupport: "Query F-unexp: survey-record support per bin.",
    boundary: "Queries G/H: weekday trips starting (G) or ending (H) anywhere in Durham Region regardless of household residence — the balance of trips crossing the regional boundary.",
    map: "Municipality map frames are rebuilt from the raw G/H extracts (geography basis). Pair flows below the display floor are hidden from frames without ever changing totals.",
  },
  sources: ["F", "F-unexp", "G", "H"],
  provenance:
    "2022 TTS via DMG iDRS (authorized extracts, docs/phase3-data-audit.md). Expanded weekday estimates; survey records shown as support where available.",
  /** Day-total context (D2 detailed destination purposes, internal trips) used
   *  to qualify afternoon-composition copy without hourly attribution. */
  context: {
    internalPickupDropoff: PHASE3.destPurposeFlows.internal["Pick up a passenger"] ?? 0,
    internalDropoffPassenger: PHASE3.destPurposeFlows.internal["Drop off a passenger"] ?? 0,
  },
};

const storyDay = { meta: dayMeta, bins };

// ---------------------------------------------------------------------------
// Story 2 — The Transit Journey
// ---------------------------------------------------------------------------

const T = PHASE3.transit;

const ACCESS_LABELS = {
  walk: "Walk-access transit",
  drive: "Drive-access transit",
  passenger: "Drive-access transit- Passenger",
  cycle: "Bicycle-access transit",
  other: "Other-access transit",
} as const;
type AccessKey = keyof typeof ACCESS_LABELS;

const DURHAM_LINE_STATIONS = [
  { id: "pickering", name: "Pickering GO" },
  { id: "ajax", name: "Ajax GO" },
  { id: "whitby", name: "Whitby GO" },
  { id: "oshawa", name: "Oshawa GO" },
] as const;
const STATION_ID: Record<string, string> = {
  "Pickering GO Station": "pickering",
  "Ajax GO Station": "ajax",
  "Whitby GO Station": "whitby",
  "Oshawa GO Station": "oshawa",
  "Union GO Station": "union",
};

const accessOf = (station: string) => {
  const raw = T.accessByStation[station] ?? {};
  const access: Record<AccessKey, number> = Object.fromEntries(
    (Object.keys(ACCESS_LABELS) as AccessKey[]).map((k) => [k, raw[ACCESS_LABELS[k]] ?? 0]),
  ) as Record<AccessKey, number>;
  const boardings = Object.values(access).reduce((a, b) => a + b, 0);
  const car = access.drive + access.passenger;
  return {
    boardings,
    access,
    carShare: boardings ? car / boardings : 0,
    walkShare: boardings ? access.walk / boardings : 0,
  };
};

const stations = DURHAM_LINE_STATIONS.map(({ id, name }) => ({
  id,
  name,
  ...accessOf(`${name} Station`), // "Pickering GO" + " Station" = raw label
}));

// Union as a boarding station = Durham residents' return legs; profile kept
// for the network view (no access comparison — it is not a Durham station).
const unionBoardings = T.boardingsByStation["Union GO Station"] ?? 0;

// Alighting destinations (O): all Durham-resident GO journeys with a destination station
const destMap = new Map<string, number>();
const destSupport = new Map<string, number>();
for (const r of T.stationOd) {
  destMap.set(r.to, (destMap.get(r.to) ?? 0) + r.trips);
  destSupport.set(r.to, (destSupport.get(r.to) ?? 0) + r.surveyRecords);
}
const destinations = [...destMap.entries()]
  .map(([name, trips]) => ({
    name: name.replace(" GO Station", " GO"),
    stationId: STATION_ID[name] ?? null,
    trips,
    surveyRecords: destSupport.get(name) ?? 0,
  }))
  .sort((a, b) => b.trips - a.trips);

// System-wide access composition (P basis — every transit journey once)
const sumLinks = (byAccess: Record<string, Record<string, number>>, access: string) =>
  Object.values(byAccess[access] ?? {}).reduce((a, b) => a + b, 0);
const accessOverall = Object.fromEntries(
  (Object.keys(ACCESS_LABELS) as AccessKey[]).map((k) => [
    k,
    sumLinks(T.linksByAccessGo, ACCESS_LABELS[k]) + sumLinks(T.linksByAccessNonGo, ACCESS_LABELS[k]),
  ]),
);
const accessOverallTotal = Object.values(accessOverall).reduce((a, b) => a + b, 0);

// Link complexity with P-unexp support
const P_UNEXP = (() => {
  const blocks = parseMatrixBlocks(readExtract("tts2022_transit_route-count_access-type_go-station_unexpanded.csv"));
  const go: Record<string, number> = {};
  const nonGo: Record<string, number> = {};
  for (const block of blocks) {
    const isNonGo = block.label === "GO Rail not used";
    for (let i = 0; i < block.rowNames.length; i++) {
      const n = block.rowNames[i]!;
      for (let j = 0; j < block.colNames.length; j++) {
        const v = block.values[i]![j]!;
        if (v === 0) continue;
        const target = isNonGo ? nonGo : go;
        target[n] = (target[n] ?? 0) + v;
      }
    }
  }
  return { go, nonGo };
})();

const linkBucket = (n: string): "1" | "2" | "3+" => (n === "1" ? "1" : n === "2" ? "2" : "3+");
const bucketize = (byAccess: Record<string, Record<string, number>>) => {
  const out: Record<string, number> = { "1": 0, "2": 0, "3+": 0 };
  for (const rows of Object.values(byAccess)) {
    for (const [n, v] of Object.entries(rows)) out[linkBucket(n)]! += v;
  }
  return out;
};
const bucketizeUnexp = (rec: Record<string, number>) => {
  const out: Record<string, number> = { "1": 0, "2": 0, "3+": 0 };
  for (const [n, v] of Object.entries(rec)) out[linkBucket(n)]! += v;
  return out;
};

const links = {
  go: {
    total: Object.values(T.linksByAccessGo).reduce((a, r) => a + Object.values(r).reduce((x, v) => x + v, 0), 0),
    byBucket: bucketize(T.linksByAccessGo),
    support: bucketizeUnexp(P_UNEXP.go),
  },
  nonGo: {
    total: Object.values(T.linksByAccessNonGo).reduce((a, r) => a + Object.values(r).reduce((x, v) => x + v, 0), 0),
    byBucket: bucketize(T.linksByAccessNonGo),
    support: bucketizeUnexp(P_UNEXP.nonGo),
  },
  byAccessGo: T.linksByAccessGo,
  byAccessNonGo: T.linksByAccessNonGo,
  note: "n_route counts the number of transit links (routes) a journey is built from — not public-facing 'transfers'. A two-link journey usually implies one change, but the variable itself counts links.",
};

// Catchment: station × origin municipality (raw N re-aggregation, GO used only)
const catchment = (() => {
  const byStation = new Map<string, Record<string, number>>();
  const n = parseMatrixBlocks(readExtract("tts2022_go-boardings_access-type_origin-pd_durham-residents.csv"));
  for (const block of n) {
    const originId = muniIdOfLabel(block.label);
    if (!originId) continue; // Durham origins only
    for (let i = 0; i < block.rowNames.length; i++) {
      const station = block.rowNames[i]!;
      if (station === "GO Rail not used") continue;
      for (let j = 0; j < block.colNames.length; j++) {
        const v = block.values[i]![j]!;
        if (v === 0) continue;
        const id = STATION_ID[station] ?? null;
        if (!id || !DURHAM_LINE_STATIONS.some((s) => s.id === id)) continue; // Durham line stations only
        if (!byStation.has(id)) byStation.set(id, Object.fromEntries(MUNI_IDS.map((m) => [m, 0])));
        const origins = byStation.get(id)!;
        origins[originId] = (origins[originId] ?? 0) + v;
      }
    }
  }
  return DURHAM_LINE_STATIONS.map(({ id, name }) => ({
    id,
    name,
    origins: byStation.get(id) ?? Object.fromEntries(MUNI_IDS.map((m) => [m, 0])),
  }));
})();

const transitMeta = {
  basis: "2022 TTS Transit dataset via DMG iDRS: one record per transit journey by members of Durham households. 50,753 journeys total; 18,736 of them use GO Rail.",
  sources: ["N", "O", "O-unexp", "P", "P-unexp"],
  displayFloor: { stationPairs: 4 },
  stationPairsNote:
    "Station-to-station cells rest on few survey records (2,158 records across the whole matrix); pairs with fewer than 4 supporting records are hidden from displays. Rankings are safe; small cells are not.",
  accessNote:
    "Access classification is derived (tran_type). 'Drive' and 'Passenger (dropped off)' are kept separate; combined they are reported as 'arrive by car' — not 'park-and-ride', which the variable cannot distinguish.",
  provenance: "2022 TTS via DMG iDRS (authorized extracts, docs/phase3-data-audit.md). Expanded weekday estimates.",
};

const storyTransit = {
  meta: transitMeta,
  totals: { journeys: accessOverallTotal, goJourneys: T.goTrips, unionBoardings },
  accessOverall,
  stations,
  destinations,
  stationPairs: T.stationOd.map((r) => ({
    from: r.from.replace(" GO Station", " GO"),
    to: r.to.replace(" GO Station", " GO"),
    fromId: STATION_ID[r.from] ?? null,
    toId: STATION_ID[r.to] ?? null,
    trips: r.trips,
    surveyRecords: r.surveyRecords,
  })),
  links,
  catchment,
};

// ---------------------------------------------------------------------------
// Write + audit printout
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "story-day.json"), JSON.stringify(storyDay));
writeFileSync(resolve(OUT_DIR, "story-transit.json"), JSON.stringify(storyTransit));

// --- audit printout (bin support rationale + headline reconciliation) ---
const hourTrips = (h: number) => {
  const start = (h - 4) * 60;
  return bins.filter((b) => b.t >= start && b.t < start + 60).reduce((a, b) => a + b.trips, 0);
};
const hourNet = (h: number) => {
  const start = (h - 4) * 60;
  return bins
    .filter((b) => b.t >= start && b.t < start + 60)
    .reduce((a, b) => a + (b.inbound - b.outbound), 0);
};
const minSupport = Math.min(...bins.map((b) => b.surveyRecords));
const nightBins = bins.filter((b) => b.t >= 20 * 60 || b.t < 7 * 60);
const minNightSupport = Math.min(...nightBins.map((b) => b.surveyRecords));
const unionShare = destMap.get("Union GO Station")! / [...destMap.values()].reduce((a, b) => a + b, 0);

console.log("phase4: story-day.json");
console.log(`  bins=${BIN_COUNT} × ${BIN_MINUTES}min  curveTotal=${bins.reduce((a, b) => a + b.trips, 0).toLocaleString("en-CA")}`);
console.log(`  hour 08 trips=${hourTrips(8)}  hour 15 trips=${hourTrips(15)}  net07=${hourNet(7)}  net17=${hourNet(17)}`);
console.log(`  bin support: min=${minSupport}  min(night/evening bins)=${minNightSupport}  displayFloor=${MAP_DISPLAY_FLOOR}`);
console.log(`  frame pairs shown at 15:00=${bins[22]!.pairs.length}  at 04:00=${bins[0]!.pairs.length}`);
console.log("phase4: story-transit.json");
console.log(`  journeys=${accessOverallTotal.toLocaleString("en-CA")} go=${T.goTrips.toLocaleString("en-CA")} unionBoardings=${unionBoardings}`);
console.log(`  union alighting share=${(unionShare * 100).toFixed(2)}%  destinations=${destinations.length}`);
for (const s of stations) {
  console.log(`  ${s.name}: boardings=${s.boardings} car=${(s.carShare * 100).toFixed(1)}% walk=${(s.walkShare * 100).toFixed(1)}%`);
}
