/**
 * Parsers, model and build-time selectors for the authenticated iDRS
 * origin–destination extracts (2022 TTS, Durham-household trips).
 *
 * Query provenance: docs/idrs-data.md. Authorization scope: docs/data-permissions.md.
 * Every headline number on the site is a deterministic function of the raw
 * extracts via this module — nothing editorial is hard-coded.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvLine } from "./read-files.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");
const IDRS_DIR = resolve(ROOT, "data/raw/idrs");

// ---------------------------------------------------------------------------
// Geography constants
// ---------------------------------------------------------------------------

/** Durham municipality id → TTS planning-district code (codes 17–24). */
export const MUNI_PD_CODE: Record<string, number> = {
  brock: 17,
  uxbridge: 18,
  scugog: 19,
  pickering: 20,
  ajax: 21,
  whitby: 22,
  oshawa: 23,
  clarington: 24,
};
export const MUNI_IDS = Object.keys(MUNI_PD_CODE);
export const MUNI_NAMES: Record<string, string> = {
  brock: "Brock",
  uxbridge: "Uxbridge",
  scugog: "Scugog",
  pickering: "Pickering",
  ajax: "Ajax",
  whitby: "Whitby",
  oshawa: "Oshawa",
  clarington: "Clarington",
};
export const TORONTO_CODES = new Set(
  Array.from({ length: 16 }, (_, i) => i + 1),
);
export const EXTERNAL_CODE = 998;

/** Coarse destination groups used across the story. */
export type DestGroup = "same" | "durham" | "toronto" | "outside";

export const groupLabel: Record<DestGroup, string> = {
  same: "within the same municipality",
  durham: "elsewhere in Durham",
  toronto: "Toronto",
  outside: "elsewhere outside Durham",
};

// ---------------------------------------------------------------------------
// Mode grouping (editorial layer over the 13 raw iDRS mode categories)
// ---------------------------------------------------------------------------

export type ModeGroup = "drive" | "ride" | "transit" | "walk" | "cycle" | "schoolBus" | "other";

export const MODE_GROUP_ORDER: ModeGroup[] = ["drive", "ride", "transit", "walk", "cycle", "schoolBus", "other"];

export const MODE_GROUP_LABEL: Record<ModeGroup, string> = {
  drive: "Drive",
  ride: "Ride",
  transit: "Transit",
  walk: "Walk",
  cycle: "Cycle",
  schoolBus: "School bus",
  other: "Other",
};

/** Raw iDRS mode_prime label → editorial group. Unknown labels throw (fail
 *  loudly if DMG adds categories) so residual trips are never silently dropped. */
const RAW_MODE_TO_GROUP: Record<string, ModeGroup> = {
  "Auto driver": "drive",
  "Auto passenger": "ride",
  "Transit excluding GO rail": "transit",
  "GO rail only": "transit",
  "Joint GO rail and local transit": "transit",
  Walk: "walk",
  Cycle: "cycle",
  "School bus": "schoolBus",
  "Taxi passenger": "other",
  "Paid rideshare": "other",
  Motorcycle: "other",
  "E-scooter": "other",
  Other: "other",
};

export const modeGroupOf = (rawMode: string): ModeGroup => {
  const g = RAW_MODE_TO_GROUP[rawMode.trim()];
  if (!g) throw new Error(`Unknown iDRS mode category: "${rawMode}" — extend RAW_MODE_TO_GROUP`);
  return g;
};

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/** DMG label quirks: stray trailing punctuation and padding. */
export const normalizeName = (name: string): string =>
  name.replace(/\s+/g, " ").trim().replace(/\)+$/, "").trim();

export interface OdMatrix {
  /** Origin labels, in file order (TTS planning-district names). */
  rowNames: string[];
  colNames: string[];
  /** values[i][j] = expanded weekday trips, rowNames[i] → colNames[j]. */
  values: number[][];
  total: number;
}

/**
 * Parse the unidimensional OD cross-tab (Save-As format: provenance preamble,
 * then a header row starting with "," and one row per origin).
 */
export function parseOdMatrix(text: string): OdMatrix {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.startsWith(",") && /of Toronto/i.test(l));
  if (headerIdx === -1) throw new Error("OD matrix: header row not found");

  const colNames = parseCsvLine(lines[headerIdx]!).slice(1).map(normalizeName);
  const rowNames: string[] = [];
  const values: number[][] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (line.trim() === "") break;
    const cells = parseCsvLine(line);
    rowNames.push(normalizeName(cells[0]!));
    const row = cells.slice(1, colNames.length + 1).map((c) => {
      const v = Number(c);
      if (!Number.isFinite(v)) throw new Error(`OD matrix: non-numeric cell "${c}"`);
      return v;
    });
    if (row.length !== colNames.length) throw new Error(`OD matrix: ragged row "${cells[0]}"`);
    values.push(row);
  }
  if (rowNames.length === 0) throw new Error("OD matrix: no data rows");
  const total = values.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0);
  return { rowNames, colNames, values, total };
}

export interface OdByMode {
  /** One entry per raw mode block, in file order. */
  blocks: { mode: string; cells: { origin: number; dest: number; trips: number }[] }[];
  total: number;
}

/**
 * Parse the OD-by-mode extract (column format: `TABLE : mode_prime (...)`
 * blocks of `pd_orig pd_dest total` triplets, sparse — nonzero cells only).
 */
export function parseOdByMode(text: string): OdByMode {
  const lines = text.split(/\r?\n/);
  const blocks: OdByMode["blocks"] = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i]!.match(/^TABLE\s*:\s*mode_prime\s*\((.+)\)\s*$/);
    if (!m) {
      i++;
      continue;
    }
    const mode = m[1]!.trim();
    i++;
    // Skip blanks and the "pd_orig pd_dest total" header line.
    while (i < lines.length && lines[i]!.trim() === "") i++;
    if (!/pd_orig/.test(lines[i] ?? "")) throw new Error(`OD by-mode: missing header after TABLE for "${mode}"`);
    i++;
    const cells: OdByMode["blocks"][number]["cells"] = [];
    for (; i < lines.length && lines[i]!.trim() !== ""; i++) {
      const t = lines[i]!.trim().split(/\s+/);
      if (t.length !== 3) throw new Error(`OD by-mode: unexpected line "${lines[i]}"`);
      const origin = Number(t[0]);
      const dest = Number(t[1]);
      const trips = Number(t[2]);
      if (!Number.isFinite(origin) || !Number.isFinite(dest) || !Number.isFinite(trips))
        throw new Error(`OD by-mode: unexpected line "${lines[i]}"`);
      cells.push({ origin, dest, trips });
    }
    blocks.push({ mode, cells });
    i++;
  }
  if (blocks.length === 0) throw new Error("OD by-mode: no TABLE blocks found");
  const total = blocks.reduce((s, b) => s + b.cells.reduce((a, c) => a + c.trips, 0), 0);
  return { blocks, total };
}

/**
 * Parse a mode × municipality-of-household table (the two "mode_by-pd"
 * extracts). These files are JSON-encoded strings; the decoded CSV has a
 * header row starting with "," followed by `mode,muni,…` rows.
 */
export function parseModeByPd(text: string): Record<string, Record<string, number>> {
  const csv = text.trimStart().startsWith('"') ? (JSON.parse(text) as string) : text;
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headerIdx = lines.findIndex((l) => !l.startsWith('"') && l.startsWith(","));
  if (headerIdx === -1) throw new Error("mode-by-pd: header row not found");
  const munis = parseCsvLine(lines[headerIdx]!).slice(1).map(normalizeName);
  const out: Record<string, Record<string, number>> = {};
  for (const line of lines.slice(headerIdx + 1)) {
    const cells = parseCsvLine(line);
    const mode = (cells[0] ?? "").trim();
    if (mode === "") continue;
    out[mode] = Object.fromEntries(
      munis.map((muni, j) => {
        const v = Number(cells[j + 1]);
        if (!Number.isFinite(v)) throw new Error(`mode-by-pd: non-numeric cell mode="${mode}" muni="${muni}"`);
        return [muni, v];
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Numeric-code → planning-district name map
// ---------------------------------------------------------------------------

/**
 * The by-mode extract uses numeric TTS planning-district codes; the
 * unidimensional matrix uses names. Recover the mapping by matching marginal
 * origin totals (they describe the same trips; the by-mode total is ~9 trips
 * short overall because mode-not-stated trips are absent from it).
 * Injective greedy match on smallest absolute difference, ties broken by
 * matrix row order. Codes that match nothing fall back to "PD <code>".
 */
export function buildCodeNameMap(matrix: OdMatrix, byMode: OdByMode): Map<number, string> {
  const codeTotal = new Map<number, number>();
  for (const b of byMode.blocks) {
    for (const c of b.cells) codeTotal.set(c.origin, (codeTotal.get(c.origin) ?? 0) + c.trips);
  }
  const rowTotal = matrix.rowNames.map((_, i) => matrix.values[i]!.reduce((a, b) => a + b, 0));

  // Toronto labels carry their code directly.
  const map = new Map<number, string>();
  const usedNames = new Set<string>();
  for (const [code, name] of codeNameAnchors(matrix)) {
    map.set(code, name);
    usedNames.add(name);
  }

  const candidates = [...codeTotal.entries()]
    .filter(([code]) => !map.has(code))
    .sort((a, b) => b[1] - a[1]);
  for (const [code, total] of candidates) {
    let bestName: string | null = null;
    let bestDiff = Infinity;
    let bestRow = Infinity;
    for (let i = 0; i < matrix.rowNames.length; i++) {
      const name = matrix.rowNames[i]!;
      if (usedNames.has(name)) continue;
      const diff = Math.abs(rowTotal[i]! - total);
      if (diff < bestDiff || (diff === bestDiff && i < bestRow)) {
        bestDiff = diff;
        bestName = name;
        bestRow = i;
      }
    }
    // Mode-not-stated residue: accept only near-exact matches.
    if (bestName !== null && bestDiff <= Math.max(9, total * 0.001)) {
      map.set(code, bestName);
      usedNames.add(bestName);
    }
  }
  return map;
}

/** Toronto rows/cols are labelled "PD n of Toronto" — the code is in the name. */
function codeNameAnchors(matrix: OdMatrix): [number, string][] {
  const anchors: [number, string][] = [];
  for (const name of matrix.rowNames) {
    const m = name.match(/^PD (\d+) of Toronto$/);
    if (m) anchors.push([Number(m[1]), name]);
  }
  return anchors;
}

/** Label for a PD code using the recovered map; falls back to "PD <code>". */
export const codeLabel = (codeName: Map<number, string>, code: number): string =>
  codeName.get(code) ?? `PD ${code}`;

// ---------------------------------------------------------------------------
// Dataset loading + selectors
// ---------------------------------------------------------------------------

export interface OdDataset {
  matrix: OdMatrix;
  byMode: OdByMode;
  modeByPdFull: Record<string, Record<string, number>>;
  modeByPdComparable: Record<string, Record<string, number>>;
  codeName: Map<number, string>;
}

export function loadOdDataset(): OdDataset {
  const read = (f: string) => readFileSync(resolve(IDRS_DIR, f), "utf8");
  const matrix = parseOdMatrix(read("tts2022_od_pd_durham-residents.csv"));
  const byMode = parseOdByMode(read("tts2022_od_pd_durham-residents_by-mode.csv"));
  const modeByPdFull = parseModeByPd(read("tts2022_mode_by-pd_durham-residents_full.csv"));
  const modeByPdComparable = parseModeByPd(read("tts2022_mode_by-pd_durham-residents_excl2016-0.csv"));
  const codeName = buildCodeNameMap(matrix, byMode);

  // Anchors must hold or every downstream grouping is wrong.
  for (const [id, code] of Object.entries(MUNI_PD_CODE)) {
    if (codeName.get(code) !== MUNI_NAMES[id]!)
      throw new Error(`PD code map broken: code ${code} should be ${MUNI_NAMES[id]}, got ${codeName.get(code)}`);
  }
  return { matrix, byMode, modeByPdFull, modeByPdComparable, codeName };
}

const isTorontoName = (name: string) => /^PD \d+ of Toronto$/.test(name);
const muniIdOfName = (name: string): string | null =>
  MUNI_IDS.find((id) => MUNI_NAMES[id] === name) ?? null;

/** Sum one matrix dimension: trips with origin in `rowFilter` and destination in `colFilter`. */
function sumCells(
  matrix: OdMatrix,
  rowFilter: (name: string) => boolean,
  colFilter: (name: string) => boolean,
): number {
  let sum = 0;
  for (let i = 0; i < matrix.rowNames.length; i++) {
    if (!rowFilter(matrix.rowNames[i]!)) continue;
    for (let j = 0; j < matrix.colNames.length; j++) {
      if (colFilter(matrix.colNames[j]!)) sum += matrix.values[i]![j]!;
    }
  }
  return sum;
}

const durhamOrigin = (name: string) => muniIdOfName(name) !== null;
const durhamDest = durhamOrigin;
const torontoDest = isTorontoName;

/** Total expanded weekday trips made by members of Durham households. */
export const getTotalTrips = (ds: OdDataset): number => ds.matrix.total;

/** Trips by Durham-household members that begin and end inside Durham. */
export const getInternalTrips = (ds: OdDataset): number => sumCells(ds.matrix, durhamOrigin, durhamDest);

/** Share of Durham-household trips that begin and end inside Durham. */
export const getInternalShare = (ds: OdDataset): number => getInternalTrips(ds) / getTotalTrips(ds);

/** Durham-origin trips with destination in Toronto (pd 1–16). */
export const getDurhamToTorontoTrips = (ds: OdDataset): number =>
  sumCells(ds.matrix, durhamOrigin, torontoDest);

/** Toronto-origin trips with destination in Durham (Durham residents heading home). */
export const getTorontoToDurhamTrips = (ds: OdDataset): number =>
  sumCells(ds.matrix, isTorontoName, durhamDest);

export interface MunicipalityPairFlow {
  a: string;
  b: string;
  aToB: number;
  bToA: number;
  totalTwoWay: number;
}

/** Two-way flows between the eight municipalities (a before b in MUNI_IDS order). */
export function getMunicipalityPairFlows(ds: OdDataset): MunicipalityPairFlow[] {
  const cell = (a: string, b: string): number => {
    const i = ds.matrix.rowNames.indexOf(MUNI_NAMES[a]!);
    const j = ds.matrix.colNames.indexOf(MUNI_NAMES[b]!);
    if (i === -1 || j === -1) throw new Error(`matrix cell missing for ${a}→${b}`);
    return ds.matrix.values[i]![j]!;
  };
  const pairs: MunicipalityPairFlow[] = [];
  for (let x = 0; x < MUNI_IDS.length; x++) {
    for (let y = x + 1; y < MUNI_IDS.length; y++) {
      const a = MUNI_IDS[x]!;
      const b = MUNI_IDS[y]!;
      const aToB = cell(a, b);
      const bToA = cell(b, a);
      pairs.push({ a, b, aToB, bToA, totalTwoWay: aToB + bToA });
    }
  }
  return pairs;
}

export interface DestinationFlow {
  /** Municipality id, "toronto", a PD code label, or "external". */
  destinationId: string;
  destinationName: string;
  group: DestGroup;
  trips: number;
}

function outboundFlows(ds: OdDataset, muniId: string): DestinationFlow[] {
  const i = ds.matrix.rowNames.indexOf(MUNI_NAMES[muniId]!);
  if (i === -1) throw new Error(`no matrix row for ${muniId}`);
  const flows: DestinationFlow[] = [];
  for (let j = 0; j < ds.matrix.colNames.length; j++) {
    const trips = ds.matrix.values[i]![j]!;
    if (trips <= 0) continue;
    const name = ds.matrix.colNames[j]!;
    const muni = muniIdOfName(name);
    if (muni === muniId) {
      flows.push({ destinationId: muniId, destinationName: MUNI_NAMES[muniId]!, group: "same", trips });
    } else if (muni) {
      flows.push({ destinationId: muni, destinationName: MUNI_NAMES[muni]!, group: "durham", trips });
    } else if (isTorontoName(name)) {
      flows.push({ destinationId: "toronto", destinationName: "Toronto", group: "toronto", trips });
    } else if (name === "External") {
      flows.push({ destinationId: "external", destinationName: "Beyond the surveyed area", group: "outside", trips });
    } else {
      flows.push({ destinationId: `pd-${name}`, destinationName: name, group: "outside", trips });
    }
  }
  return flows;
}

export interface MunicipalityTravelProfile {
  id: string;
  name: string;
  /** Expanded weekday trips originating in this municipality. */
  originTrips: number;
  /** Expanded weekday trips with destination in this municipality. */
  destinationTrips: number;
  sameMunicipality: number;
  elsewhereInDurham: number;
  toronto: number;
  /** Elsewhere in the surveyed area plus trips beyond it. */
  otherExternal: number;
  /** Shares of originTrips (fractions, 0–1). */
  orbitShares: Record<Exclude<DestGroup, "same">, number> & { same: number };
  /** Top outbound destinations, sorted by trips (full distribution available). */
  topDestinations: DestinationFlow[];
  /** Share of origin trips by editorial mode group (denominator: by-mode origin total). */
  modeGroupShares: Record<ModeGroup, number>;
  /** Origin trips by mode group, for tooltips. */
  modeGroupTrips: Record<ModeGroup, number>;
}

function modeGroupsFor(ds: OdDataset, filter: (origin: number, dest: number) => boolean): {
  trips: Record<ModeGroup, number>;
  total: number;
} {
  const trips = Object.fromEntries(MODE_GROUP_ORDER.map((g) => [g, 0])) as Record<ModeGroup, number>;
  let total = 0;
  for (const block of ds.byMode.blocks) {
    const group = modeGroupOf(block.mode);
    for (const c of block.cells) {
      if (!filter(c.origin, c.dest)) continue;
      trips[group]! += c.trips;
      total += c.trips;
    }
  }
  return { trips, total };
}

const muniOriginFilter = (muniId: string) => (origin: number) => origin === MUNI_PD_CODE[muniId];

export function getMunicipalityOriginProfile(ds: OdDataset, muniId: string): MunicipalityTravelProfile {
  if (!MUNI_PD_CODE[muniId]) throw new Error(`unknown municipality id: ${muniId}`);
  const flows = outboundFlows(ds, muniId);
  const sum = (g: DestGroup) => flows.filter((f) => f.group === g).reduce((a, f) => a + f.trips, 0);
  const same = sum("same");
  const durhamOther = sum("durham");
  const toronto = sum("toronto");
  const outside = sum("outside");
  const originTrips = same + durhamOther + toronto + outside;

  const byCode = new Map<number, number>();
  for (const f of flows) {
    if (f.group !== "outside" || f.destinationId === "external") continue;
    const code = codeForOutsideName(ds, f.destinationName);
    if (code !== null) byCode.set(code, (byCode.get(code) ?? 0) + f.trips);
  }

  const mode = modeGroupsFor(ds, (o) => muniOriginFilter(muniId)(o));
  const modeGroupShares = Object.fromEntries(
    MODE_GROUP_ORDER.map((g) => [g, mode.total > 0 ? mode.trips[g]! / mode.total : 0]),
  ) as Record<ModeGroup, number>;

  return {
    id: muniId,
    name: MUNI_NAMES[muniId]!,
    originTrips,
    destinationTrips: inboundTrips(ds, muniId),
    sameMunicipality: same,
    elsewhereInDurham: durhamOther,
    toronto,
    otherExternal: outside,
    orbitShares: {
      same: same / originTrips,
      durham: durhamOther / originTrips,
      toronto: toronto / originTrips,
      outside: outside / originTrips,
    },
    topDestinations: [...flows].sort((a, b) => b.trips - a.trips),
    modeGroupShares,
    modeGroupTrips: mode.trips,
  };
}

function codeForOutsideName(ds: OdDataset, name: string): number | null {
  if (name.startsWith("pd-")) return null;
  for (const [code, label] of ds.codeName) {
    if (label === name && !TORONTO_CODES.has(code) && !Object.values(MUNI_PD_CODE).includes(code)) return code;
  }
  return null;
}

function inboundTrips(ds: OdDataset, muniId: string): number {
  const j = ds.matrix.colNames.indexOf(MUNI_NAMES[muniId]!);
  if (j === -1) throw new Error(`no matrix column for ${muniId}`);
  let sum = 0;
  for (let i = 0; i < ds.matrix.rowNames.length; i++) sum += ds.matrix.values[i]![j]!;
  return sum;
}

export function getMunicipalityDestinationProfile(ds: OdDataset, muniId: string) {
  const j = ds.matrix.colNames.indexOf(MUNI_NAMES[muniId]!);
  if (j === -1) throw new Error(`no matrix column for ${muniId}`);
  let durham = 0;
  let toronto = 0;
  let outside = 0;
  for (let i = 0; i < ds.matrix.rowNames.length; i++) {
    const origin = ds.matrix.rowNames[i]!;
    const v = ds.matrix.values[i]![j]!;
    if (durhamOrigin(origin)) durham += v;
    else if (isTorontoName(origin)) toronto += v;
    else outside += v;
  }
  return { id: muniId, name: MUNI_NAMES[muniId]!, trips: durham + toronto + outside, fromDurham: durham, fromToronto: toronto, fromOutside: outside };
}

/**
 * Mode composition for one origin→destination context. origin/destination are
 * resolved as: municipality id | "toronto" | "durham" | "outside" | "external".
 */
export function getModeComposition(
  ds: OdDataset,
  opts: { origin: string; destination: string },
): { trips: Record<ModeGroup, number>; total: number } {
  const resolve = (side: string): { test: (code: number) => boolean } => {
    if (MUNI_PD_CODE[side]) return { test: (c) => c === MUNI_PD_CODE[side] };
    if (side === "durham") return { test: (c) => Object.values(MUNI_PD_CODE).includes(c) };
    if (side === "toronto") return { test: (c) => TORONTO_CODES.has(c) };
    if (side === "outside")
      return { test: (c) => !TORONTO_CODES.has(c) && !Object.values(MUNI_PD_CODE).includes(c) && c !== EXTERNAL_CODE };
    if (side === "external") return { test: (c) => c === EXTERNAL_CODE };
    throw new Error(`unknown OD side: ${side}`);
  };
  const o = resolve(opts.origin);
  const d = resolve(opts.destination);
  return modeGroupsFor(ds, (origin, dest) => o.test(origin) && d.test(dest));
}

export interface ModeContext {
  key: string;
  label: string;
  description: string;
  trips: number;
  groups: Record<ModeGroup, number>;
}

/** The four destination contexts for the mode-morph chapter. */
export function getModeContexts(ds: OdDataset): ModeContext[] {
  const build = (key: string, label: string, description: string, filter: (o: number, d: number) => boolean): ModeContext => {
    const { trips, total } = modeGroupsFor(ds, filter);
    return { key, label, description, trips: total, groups: trips };
  };
  const inDurham = (c: number) => Object.values(MUNI_PD_CODE).includes(c);
  return [
    build(
      "sameMunicipality",
      "Within the same municipality",
      "Trips that begin and end in the same Durham municipality",
      (o, d) => inDurham(o) && o === d,
    ),
    build(
      "internalDurham",
      "Around Durham",
      "Trips that begin and end somewhere in Durham Region",
      (o, d) => inDurham(o) && inDurham(d),
    ),
    build(
      "toToronto",
      "To Toronto",
      "Trips that begin in Durham and end in Toronto",
      (o, d) => inDurham(o) && TORONTO_CODES.has(d),
    ),
    build(
      "toOutside",
      "Beyond the region",
      "Trips that begin in Durham and end outside Durham and Toronto",
      (o, d) => inDurham(o) && !inDurham(d) && !TORONTO_CODES.has(d),
    ),
  ];
}

export interface Comparable2022 {
  total: number;
  modes: Record<string, number>;
  groups: Record<ModeGroup, number>;
}

/** 2016-comparable 2022 mode split (excl2016 = 0 filter). */
export function getComparable2022(ds: OdDataset): Comparable2022 {
  const groups = Object.fromEntries(MODE_GROUP_ORDER.map((g) => [g, 0])) as Record<ModeGroup, number>;
  let total = 0;
  for (const [mode, byMuni] of Object.entries(ds.modeByPdComparable)) {
    const group = modeGroupOf(mode);
    for (const v of Object.values(byMuni)) {
      groups[group]! += v;
      total += v;
    }
  }
  return { total, modes: mapSum(ds.modeByPdComparable), groups };
}

/** Full-basis 2022 mode split by municipality (validation + mode profiles). */
export function getFull2022Modes(ds: OdDataset): { total: number; modes: Record<string, number> } {
  const modes = mapSum(ds.modeByPdFull);
  return { total: Object.values(modes).reduce((a, b) => a + b, 0), modes };
}

function mapSum(byMode: Record<string, Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [mode, byMuni] of Object.entries(byMode)) {
    out[mode] = Object.values(byMuni).reduce((a, b) => a + b, 0);
  }
  return out;
}
