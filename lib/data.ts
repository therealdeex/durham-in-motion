/**
 * Build-time data access. Server components read the curated JSON files
 * directly from public/data — no runtime parsing, no API round-trips.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  GeographyEntry,
  HistoricalTrends,
  Manifest,
  MunicipalitiesFile,
  Profile,
  RegionSummary,
  WardsFile,
} from "./types";

const ROOT = process.cwd();

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, "public/data", file), "utf8")) as T;
}

export const getRegionSummary = () => readJson<RegionSummary>("region-summary.json");
export const getHistoricalTrends = () => readJson<HistoricalTrends>("historical-trends.json");
export const getMunicipalities = () => readJson<MunicipalitiesFile>("planning-districts-2022.json");
export const getWards = () => readJson<WardsFile>("wards-2022.json");
export const getManifest = () => readJson<Manifest>("manifest.json");
export const getGeographies = () =>
  readJson<{ generatedAt: string; geographies: GeographyEntry[] }>("geographies.json");

export const regionProfile = (year: number): Profile => {
  const { profiles } = getRegionSummary();
  const p = profiles.find((x) => x.surveyYear === year);
  if (!p) throw new Error(`no region profile for ${year}`);
  return p;
};

/** Client-side fetch path for below-the-fold geometry (cached by the browser). */
export const GEOJSON_PATHS = {
  districts: "/data/planning-districts.geojson",
  outline: "/data/durham-outline.geojson",
} as const;
