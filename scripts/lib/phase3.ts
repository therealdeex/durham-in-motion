/**
 * Parsers, query manifest and build-time selectors for the Phase 3 iDRS
 * extracts (2022 TTS, acquired 2026-09-23).
 *
 * Phase 3 widens the lens beyond Durham households:
 *  - the ALL-households OD universe (19.47M weekday trips GGH-wide), so
 *    inbound/outbound travel can be described for everyone, not just
 *    Durham-resident households;
 *  - the travel day (start_time at native 5-minute resolution);
 *  - trip distance, age, household vehicles;
 *  - the Transit record set: GO stations, access type, route links.
 *
 * Query provenance: docs/phase3-data-audit.md. Authorization scope:
 * docs/data-permissions.md (derived, aggregated displays only; raw extracts
 * stay local under data/raw/idrs/phase3/, gitignored).
 *
 * Output formats handled (DMG iDRS `/idrs/pqxt/` responses):
 *  - JSON-encoded strings, sometimes doubly encoded by the save path — decodeIdrs;
 *  - matrix blocks: optional "Table: <label>" lines, then a ","-prefixed
 *    header row and `rowLabel,v1,v2,…` rows (parseMatrixBlocks);
 *  - triplet blocks: "TABLE    : var (label)" then whitespace-separated
 *    `code code total` rows (parseTripletBlocks).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { MUNI_NAMES, MUNI_PD_CODE, normalizeName } from "./od.ts";
import { parseCsvLine } from "./read-files.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
export const PHASE3_DIR = resolve(ROOT, "data/raw/idrs/phase3");
const PROCESSED_DIR = resolve(ROOT, "data/processed/phase3");

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/**
 * iDRS responds with a JSON-encoded string; the archive path may add a second
 * encoding. Unwrap every layer until the payload is the raw response text.
 */
export function decodeIdrs(source: string): string {
  let s = source;
  for (let i = 0; i < 3 && s.trimStart().startsWith('"'); i++) {
    try {
      s = JSON.parse(s) as string;
    } catch {
      break;
    }
  }
  return s;
}

export function readExtract(filename: string): string {
  return decodeIdrs(readFileSync(resolve(PHASE3_DIR, filename), "utf8"));
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export interface MatrixBlock {
  /** "Table:" label ('' for the preamble matrix of single-table files). */
  label: string;
  rowNames: string[];
  colNames: string[];
  /** values[i][j] = expanded trips (or record counts in unexpanded extracts). */
  values: number[][];
  total: number;
}

/**
 * Parse one or more comma-delimited matrix blocks. A block starts at a
 * "Table: <label>" line (or the file preamble for label '') and consists of a
 * ","-prefixed header row plus data rows, ended by a blank line or the next
 * "Table:".
 */
export function parseMatrixBlocks(text: string): MatrixBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: MatrixBlock[] = [];
  let current: { label: string; colNames: string[] | null; rowNames: string[]; values: number[][] } | null = null;

  const flush = () => {
    if (!current || current.colNames === null) return;
    const total = current.values.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0);
    blocks.push({ label: current.label, rowNames: current.rowNames, colNames: current.colNames, values: current.values, total });
  };

  for (const line of lines) {
    // Repeated survey preamble ("Trip 2022", "ROW : …", "COLUMN : …") between blocks.
    if (/^(Trip|Tran)\s+\d{4}\s*$/.test(line) || /^(ROW|COLUMN)\s*:/.test(line)) continue;
    const tableMatch = line.match(/^Table:\s*(.*?)\s*$/);
    if (tableMatch) {
      flush();
      current = { label: tableMatch[1]!, colNames: null, rowNames: [], values: [] };
      continue;
    }
    if (line.startsWith(",")) {
      if (!current) current = { label: "", colNames: null, rowNames: [], values: [] };
      current.colNames = parseCsvLine(line).slice(1).map(normalizeName);
      continue;
    }
    if (line.trim() === "" || !current || current.colNames === null) continue;
    const block = current;
    const colNames: string[] = current.colNames;
    const cells = parseCsvLine(line);
    const row = cells.slice(1, colNames.length + 1).map((c) => {
      const v = Number(c);
      if (!Number.isFinite(v)) throw new Error(`matrix block "${block.label}": non-numeric cell "${c}"`);
      return v;
    });
    if (row.length !== colNames.length) throw new Error(`matrix block "${block.label}": ragged row "${cells[0]}"`);
    current.rowNames.push(normalizeName(cells[0]!));
    current.values.push(row);
  }
  flush();
  if (blocks.length === 0) throw new Error("parseMatrixBlocks: no blocks found");
  return blocks;
}

export interface TripletBlock {
  label: string;
  /** codeA × codeB cells, nonzero only. */
  cells: { a: number; b: number; trips: number }[];
}

/**
 * Parse "TABLE    : var (label)" blocks of `code code total` triplets
 * (numeric codes, sparse — nonzero cells only).
 */
export function parseTripletBlocks(text: string): { blocks: TripletBlock[]; total: number } {
  const lines = text.split(/\r?\n/);
  const blocks: TripletBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i]!.match(/^TABLE\s*:\s*\S+\s*\((.*)\)\s*$/);
    if (!m) {
      i++;
      continue;
    }
    const label = m[1]!.trim();
    i++;
    // Skip blanks and the "a b total" header line.
    while (i < lines.length && lines[i]!.trim() === "") i++;
    if (/total\s*$/.test(lines[i] ?? "")) i++;
    const cells: TripletBlock["cells"] = [];
    for (; i < lines.length && lines[i]!.trim() !== ""; i++) {
      const t = lines[i]!.trim().split(/\s+/);
      if (t.length !== 3) throw new Error(`triplet block "${label}": unexpected line "${lines[i]}"`);
      const a = Number(t[0]);
      const b = Number(t[1]);
      const trips = Number(t[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(trips))
        throw new Error(`triplet block "${label}": unexpected line "${lines[i]}"`);
      cells.push({ a, b, trips });
    }
    blocks.push({ label, cells });
    i++;
  }
  if (blocks.length === 0) throw new Error("parseTripletBlocks: no blocks found");
  const total = blocks.reduce((s, b) => s + b.cells.reduce((a, c) => a + c.trips, 0), 0);
  return { blocks, total };
}

// ---------------------------------------------------------------------------
// Category systems
// ---------------------------------------------------------------------------

/** TTS planning-district label → Durham municipality id, or null. */
const MUNI_ID_BY_NAME = new Map(Object.entries(MUNI_NAMES).map(([id, name]) => [name, id]));
export const muniIdOfLabel = (name: string): string | null => MUNI_ID_BY_NAME.get(normalizeName(name)) ?? null;

export const isTorontoLabel = (name: string) => /^PD \d+ of Toronto$/.test(normalizeName(name));
export const isExternalLabel = (name: string) => normalizeName(name) === "External";

/** The travel day runs 04:00–27:59; `start_time` is HHMM in 5-minute steps. */
export const ttsTimeMinutes = (t: number): number => Math.floor(t / 100) * 60 + (t % 100);
/** Minutes since 04:00 (0–1439). */
export const slotOfDay = (t: number): number => ttsTimeMinutes(t) - 4 * 60;
/** "hh:mm" wall-clock label; hours ≥ 24 keep the survey convention (27:30). */
export const slotLabel = (t: number): string => {
  const m = ttsTimeMinutes(t);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/** Distance bands over reported straight-line whole km (handoff §10). */
export const DISTANCE_BANDS = ["<1 km", "1–2 km", "2–5 km", "5–10 km", "10–20 km", "20–40 km", "40+ km"] as const;
export type DistanceBand = (typeof DISTANCE_BANDS)[number];
export const distanceBandOf = (km: number): DistanceBand => {
  if (km < 1) return "<1 km";
  if (km < 2) return "1–2 km";
  if (km < 5) return "2–5 km";
  if (km < 10) return "5–10 km";
  if (km < 20) return "10–20 km";
  if (km < 40) return "20–40 km";
  return "40+ km";
};

/** Editorial age groups over the native five-year ranges (handoff §12). */
export const AGE_GROUPS = ["5–14", "15–24", "25–44", "45–64", "65–74", "75+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const ageGroupOf = (native: string): AgeGroup => {
  const m = native.match(/^(\d+) to (\d+)|^(\d+)\+/);
  if (!m) throw new Error(`Unrecognized age range label: "${native}"`);
  const lo = Number(m[1] ?? m[3]);
  if (lo <= 14) return "5–14";
  if (lo <= 24) return "15–24";
  if (lo <= 44) return "25–44";
  if (lo <= 64) return "45–64";
  if (lo <= 74) return "65–74";
  return "75+";
};

/** Household vehicles: native counts run 0–10; grouped 0/1/2/3+ (handoff §14). */
export const VEHICLE_GROUPS = ["0 vehicles", "1 vehicle", "2 vehicles", "3+ vehicles"] as const;
export type VehicleGroup = (typeof VEHICLE_GROUPS)[number];
export const vehicleGroupOf = (n: number): VehicleGroup => {
  if (n <= 0) return "0 vehicles";
  if (n === 1) return "1 vehicle";
  if (n === 2) return "2 vehicles";
  return "3+ vehicles";
};

// ---------------------------------------------------------------------------
// Extraction manifest (handoff §1 IdrsExtraction records)
// ---------------------------------------------------------------------------

export interface IdrsExtraction {
  id: string;
  dataset: "Trip" | "Transit";
  surveyYear: 2022;
  row?: string;
  column?: string;
  table?: string;
  filters: string[];
  expanded: boolean;
  sourceFilename: string;
  notes: string;
}

const DURHAM_HHLD = "region_hhld in Durham (2)";
const ORIG_DURHAM = "region_orig in Durham (2)";
const DEST_DURHAM = "region_dest in Durham (2)";

/** Query A–P manifest, in acquisition order. POST bodies are documented in
 *  docs/phase3-data-audit.md; every query POSTed to /idrs/pqxt/ with
 *  format=csv, arrYears=2022 and expansion per `expanded`. */
export const EXTRACTIONS: IdrsExtraction[] = [
  { id: "A", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", filters: [], expanded: true, sourceFilename: "tts2022_od_pd_all-households.csv", notes: "Full 2022 TTS OD universe, no household filter — the travel market interacting with Durham, not just Durham households." },
  { id: "B", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", filters: [], expanded: false, sourceFilename: "tts2022_od_pd_all-households_unexpanded.csv", notes: "Survey-record support for A and for every inbound/outbound headline (mirror-run rule)." },
  { id: "C", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", table: "mode_prime", filters: [], expanded: true, sourceFilename: "tts2022_od_municipality_all-households_by-mode.csv", notes: "Mode for everyone travelling through Durham. PD geography ≡ municipality geography (each Durham PD is a municipality; external PDs are municipalities too)." },
  { id: "D", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", table: "trip_purp", filters: [], expanded: true, sourceFilename: "tts2022_od_municipality_all-households_by-purpose.csv", notes: "Broad purpose (4 blocks: HBW / HB school / HB discretionary / NHB) for all households." },
  { id: "D2", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", table: "purp_dest2022", filters: [], expanded: true, sourceFilename: "tts2022_od_municipality_all-households_by-destination-purpose.csv", notes: "Detailed 2022 destination purpose (18 blocks) — unlocks WHY people come to Durham." },
  { id: "E", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", table: "trip_purp", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_od_pd_durham-residents_by-purpose.csv", notes: "Purpose geography for Durham households — feeds 'there isn't one Durham network'." },
  { id: "F", dataset: "Trip", surveyYear: 2022, row: "start_time", column: "mode_prime", table: "trip_purp", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_time_mode_purpose_durham-residents.csv", notes: "Regionwide temporal pulse at native 5-minute resolution; binned locally." },
  { id: "F-unexp", dataset: "Trip", surveyYear: 2022, row: "start_time", column: "mode_prime", table: "trip_purp", filters: [DURHAM_HHLD], expanded: false, sourceFilename: "tts2022_time_mode_purpose_durham-residents_unexpanded.csv", notes: "Survey-record support for daily-pulse headlines." },
  { id: "G", dataset: "Trip", surveyYear: 2022, row: "start_time", column: "pd_orig", table: "pd_dest", filters: [ORIG_DURHAM], expanded: true, sourceFilename: "tts2022_time_od_departing-durham.csv", notes: "Time-of-day OD for trips originating in Durham, regardless of household residence. With the origin filter, col pd_orig takes only the 8 Durham codes." },
  { id: "H", dataset: "Trip", surveyYear: 2022, row: "start_time", column: "pd_orig", table: "pd_dest", filters: [DEST_DURHAM], expanded: true, sourceFilename: "tts2022_time_od_arriving-durham.csv", notes: "Mirror of G for trips ending in Durham." },
  { id: "I", dataset: "Trip", surveyYear: 2022, row: "trip_km", column: "mode_prime", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_trip-distance_by-mode_durham-residents.csv", notes: "trip_km usable directly as row variable — reported straight-line whole km (0–6218); banded locally. Band membership uses reported integers, not routed distance." },
  { id: "J", dataset: "Trip", surveyYear: 2022, row: "trip_km", column: "trip_purp", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_trip-distance_by-purpose_durham-residents.csv", notes: "Distance × broad purpose." },
  { id: "K", dataset: "Trip", surveyYear: 2022, row: "age_range", column: "mode_prime", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_age_by-mode_durham-residents.csv", notes: "Native five-year age ranges preserved; editorial groups derived locally." },
  { id: "K-unexp", dataset: "Trip", surveyYear: 2022, row: "age_range", column: "mode_prime", filters: [DURHAM_HHLD], expanded: false, sourceFilename: "tts2022_age_by-mode_durham-residents_unexpanded.csv", notes: "Survey-record support for age/mode claims (rare modes)." },
  { id: "L", dataset: "Trip", surveyYear: 2022, row: "age_range", column: "trip_purp", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_age_by-purpose_durham-residents.csv", notes: "Daily life by age: purpose composition per age group." },
  { id: "M", dataset: "Trip", surveyYear: 2022, row: "n_vehicle", column: "mode_prime", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_household-vehicles_by-mode_durham-residents.csv", notes: "Vehicle availability is associated with travel behaviour; the cross-tab does not prove causation." },
  { id: "N", dataset: "Transit", surveyYear: 2022, row: "go_on", column: "tran_type", table: "pd_orig", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_go-boardings_access-type_origin-pd_durham-residents.csv", notes: "Station × access method × origin geography. Includes 'GO Rail not used' rows (local-transit-only journeys). iDRS strType for Transit is 'tran'." },
  { id: "O", dataset: "Transit", surveyYear: 2022, row: "go_on", column: "go_off", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_go_station_od_durham-residents.csv", notes: "GO station-to-station matrix for Durham households." },
  { id: "O-unexp", dataset: "Transit", surveyYear: 2022, row: "go_on", column: "go_off", filters: [DURHAM_HHLD], expanded: false, sourceFilename: "tts2022_go_station_od_durham-residents_unexpanded.csv", notes: "Survey-record support for station rankings and small cells." },
  { id: "P", dataset: "Transit", surveyYear: 2022, row: "n_route", column: "tran_type", table: "go_on", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_transit_route-count_access-type_go-station.csv", notes: "Journey complexity: n_route counts transit links, not public-facing transfers." },
  { id: "P-unexp", dataset: "Transit", surveyYear: 2022, row: "n_route", column: "tran_type", table: "go_on", filters: [DURHAM_HHLD], expanded: false, sourceFilename: "tts2022_transit_route-count_access-type_go-station_unexpanded.csv", notes: "Survey-record support for complexity claims." },
  { id: "E-recheck", dataset: "Trip", surveyYear: 2022, row: "pd_orig", column: "pd_dest", table: "mode_prime", filters: [DURHAM_HHLD], expanded: true, sourceFilename: "tts2022_od_pd_durham-residents_by-mode_recheck.csv", notes: "Validation extract: re-ran the Phase 2 by-mode OD query during POST-format capture; reconciles against data/raw/idrs/tts2022_od_pd_durham-residents_by-mode.csv." },
];

/** sha256 of the raw (still-encoded) file bytes, for the audit trail. */
export const sha256OfFile = (filename: string): string => {
  const buf = readFileSync(resolve(PHASE3_DIR, filename));
  return createHash("sha256").update(buf).digest("hex");
};

/** Bytes + mtime of each raw file, recorded at build time. */
export const extractionProvenance = () =>
  EXTRACTIONS.map((e) => {
    const path = resolve(PHASE3_DIR, e.sourceFilename);
    if (!existsSync(path)) throw new Error(`Missing phase 3 extract: ${e.sourceFilename} (expected ${PHASE3_DIR})`);
    const st = statSync(path);
    return { ...e, sha256: sha256OfFile(e.sourceFilename), bytes: st.size, acquiredAt: st.mtime.toISOString() };
  });

// ---------------------------------------------------------------------------
// Geography partition for the all-households matrix
// ---------------------------------------------------------------------------

export type SideGroup = "durham" | "toronto" | "elsewhere" | "external";
export const sideGroupOfLabel = (name: string): SideGroup => {
  if (muniIdOfLabel(name) !== null) return "durham";
  if (isTorontoLabel(name)) return "toronto";
  if (isExternalLabel(name)) return "external";
  return "elsewhere";
};

export type DurhamRelationship = "internal_durham" | "inbound_to_durham" | "outbound_from_durham" | "outside_durham";
export const relationshipOf = (o: SideGroup, d: SideGroup): DurhamRelationship => {
  if (o === "durham" && d === "durham") return "internal_durham";
  if (o !== "durham" && d === "durham") return "inbound_to_durham";
  if (o === "durham" && d !== "durham") return "outbound_from_durham";
  return "outside_durham";
};
