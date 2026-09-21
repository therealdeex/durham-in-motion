/**
 * Raw-file reader shared by normalize-data.ts and inspect-data.ts.
 * See normalize-data.ts for the normalization invariants.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseValue, type ValueStatus } from "./values.ts";
import { isNoteRow, resolveLabel, type MetricMeta } from "./labels.ts";
import { sourceIdFor } from "./sources.ts";

const ROOT = resolve(import.meta.dirname, "..", "..");

export interface NormalizedRecord extends MetricMeta {
  surveyYear: number;
  geographyId: string;
  geographyName: string;
  geographyType: "region" | "municipality" | "ward";
  value: number | null;
  status: ValueStatus;
  unit: "households" | "persons" | "trips";
  comparability: "strong" | "caution" | "not_comparable";
  sourceId: string;
  sourceLabel: string;
}

export interface GeographyEntry {
  id: string;
  name: string;
  type: "region" | "municipality" | "ward";
  municipality?: string;
  surveyYears: number[];
}

export interface FileSpec {
  year: number;
  /** Path relative to data/raw/. */
  path: string;
  geographyType: "municipality" | "ward";
}

export const MUNICIPALITIES: Record<string, string> = {
  brock: "Brock",
  uxbridge: "Uxbridge",
  scugog: "Scugog",
  pickering: "Pickering",
  ajax: "Ajax",
  whitby: "Whitby",
  oshawa: "Oshawa",
  clarington: "Clarington",
};

/** All Durham summary files, municipality + ward where published. */
export const FILE_SPECS: FileSpec[] = [
  ...[1986, 1991, 1996, 2001, 2006, 2011, 2016, 2022].flatMap<FileSpec>((year) => {
    const folder = year >= 2016 ? String(year) : "historical";
    const cas = year >= 2016 ? "Durham" : "durham";
    const specs: FileSpec[] = [
      { year, path: `${folder}/tts${year}_mun_${cas}.csv`, geographyType: "municipality" },
    ];
    if (year >= 2001) {
      specs.push({ year, path: `${folder}/tts${year}_ward_${cas}.csv`, geographyType: "ward" });
    }
    return specs;
  }),
];

/**
 * Parse a ward column header ("Ward 4 of Oshawa", "WARD 1 OF BROCK",
 * "Ward 15of Scugog" — a DMG typo where the ward number gained a leading 1).
 * Returns null when the column is not a ward.
 */
export function parseWardHeader(header: string): { municipality: string; wardNumber: number } | null {
  const h = header.replace(/\s+/g, " ").trim().toLowerCase();
  const m = h.match(/^ward (\d+) ?of (.+)$/);
  if (!m) return null;
  let digits = m[1];
  if (digits.length >= 2 && Number(digits) >= 10) {
    digits = digits.slice(1);
  }
  const municipality = m[2].trim();
  if (!MUNICIPALITIES[municipality]) {
    throw new Error(`Ward header references unknown municipality: "${header}"`);
  }
  return { municipality, wardNumber: Number(digits) };
}

/** Minimal CSV line parser (handles quoted commas; DMG files rarely use them). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Longitudinal comparability of a metric.
 *
 * Demographics (household/person counts): strong — definitions are stable
 * across 1986–2022, with documented exceptions (income bands changed in 2016;
 * townhouse dwelling not collected in 1986) handled as category-level cautions.
 *
 * Trips: 1986–2016 share a common collection basis (household members 11+)
 * → "caution". 2022 is "not_comparable" with all earlier cycles (persons 5+;
 * walking captured more completely), per the 2022 file header and Data Guide.
 */
export function comparabilityFor(meta: MetricMeta, year: number): NormalizedRecord["comparability"] {
  if (meta.domain === "trip" || meta.domain === "transit_detail") {
    return year >= 2022 ? "not_comparable" : "caution";
  }
  if (meta.metric === "income") return "caution";
  return "strong";
}

export interface ReadResult {
  records: NormalizedRecord[];
  geography: GeographyEntry[];
  /** Raw (unresolved) labels for data rows — used by coverage checks. */
  labels: string[];
  /** Labels that resolved to no canonical metric — should be empty. */
  unresolved: string[];
  headerRow: string[];
}

/**
 * Ward files repeat the region column already covered by the municipal file.
 * Collapse to one record per key (the municipal-file copy wins; it is read
 * first) while cross-checking the duplicated values agree.
 */
export function dedupeRecords(records: NormalizedRecord[]): { records: NormalizedRecord[]; mismatches: number } {
  const key = (r: NormalizedRecord) =>
    [r.surveyYear, r.geographyId, r.domain, r.metric, r.category ?? "", r.direction ?? "", r.period ?? ""].join("|");
  const out = new Map<string, NormalizedRecord>();
  let mismatches = 0;
  for (const r of records) {
    const k = key(r);
    const existing = out.get(k);
    if (!existing) {
      out.set(k, r);
    } else if (existing.value !== r.value) {
      mismatches++;
    }
  }
  return { records: [...out.values()], mismatches };
}

export function readFile(spec: FileSpec): ReadResult {
  const abs = resolve(ROOT, "data/raw", spec.path);
  const text = readFileSync(abs, "utf8");
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    rows.push(parseCsvLine(line));
  }

  const headerIdx = rows.findIndex((r) => r.length > 1 && /durham/i.test(r[1] ?? ""));
  if (headerIdx === -1) throw new Error(`No header row found in ${spec.path}`);
  const headers = rows[headerIdx];

  const geoCols: { index: number; geo: GeographyEntry }[] = [];
  for (let i = 1; i < headers.length; i++) {
    const header = (headers[i] ?? "").replace(/\s+/g, " ").trim();
    if (header === "") continue;
    if (/^region of durham$/i.test(header)) {
      geoCols.push({ index: i, geo: { id: "durham", name: "Durham Region", type: "region", surveyYears: [] } });
      continue;
    }
    if (spec.geographyType === "ward") {
      const ward = parseWardHeader(header);
      if (ward) {
        geoCols.push({
          index: i,
          geo: {
            id: `${ward.municipality}-ward-${ward.wardNumber}`,
            name: `${MUNICIPALITIES[ward.municipality]} Ward ${ward.wardNumber}`,
            type: "ward",
            municipality: ward.municipality,
            surveyYears: [],
          },
        });
        continue;
      }
    }
    const municipality = header.toLowerCase();
    if (MUNICIPALITIES[municipality]) {
      geoCols.push({
        index: i,
        geo: {
          id: municipality,
          name: MUNICIPALITIES[municipality],
          type: "municipality",
          surveyYears: [],
        },
      });
      continue;
    }
    throw new Error(`Unrecognized geography column "${header}" in ${spec.path}`);
  }

  const sourceId = sourceIdFor(spec.year, spec.geographyType);
  const records: NormalizedRecord[] = [];
  const labels: string[] = [];
  const unresolved: string[] = [];

  for (const row of rows.slice(headerIdx + 1)) {
    const label = (row[0] ?? "").trim();
    if (label === "") continue;
    const meta = resolveLabel(label);
    if (!meta) {
      if (!isNoteRow(label)) unresolved.push(label);
      continue;
    }
    labels.push(label);

    const unit: NormalizedRecord["unit"] =
      meta.domain === "household" ? "households" : meta.domain === "person" ? "persons" : "trips";
    const comparability = comparabilityFor(meta, spec.year);

    for (const { index, geo } of geoCols) {
      const parsed = parseValue(row[index]);
      records.push({
        ...meta,
        surveyYear: spec.year,
        geographyId: geo.id,
        geographyName: geo.name,
        geographyType: geo.type,
        value: parsed.value,
        status: parsed.status,
        unit,
        comparability,
        sourceId,
        sourceLabel: label,
      });
      geo.surveyYears.push(spec.year);
    }
  }

  return { records, geography: geoCols.map((c) => c.geo), labels, unresolved, headerRow: headers };
}
