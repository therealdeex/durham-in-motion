/**
 * Phase 3 — Planning District boundaries → web GeoJSON.
 *
 * Source: DMG 2022 TTS planning-district shapefile (NAD83 / UTM 17N),
 * archived at data/raw/geography/tts2022_pd_shapefile.zip.
 * Steps (mapshaper):
 *   1. keep Durham's eight planning districts (Reg_name = "Region of Durham")
 *   2. simplify with Visvalingam (simplified boundaries only ship to the
 *      browser; the full-resolution shapefile stays in data/raw/geography)
 *   3. reproject to WGS84
 *   4. emit GeoJSON with stable slugs matching geographies.json
 * Also emits a dissolved Durham outline used by the hero animation.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MUNICIPALITIES } from "./lib/read-files.ts";

const ROOT = resolve(import.meta.dirname, "..");
const ZIP = resolve(ROOT, "data/raw/geography/tts2022_pd_shapefile.zip");
const WORK = resolve(ROOT, "data/intermediate/pd-shapefile");
const SHP = resolve(WORK, "tts2022_pd.shp");
const TMP = resolve(ROOT, "data/intermediate");

if (!existsSync(ZIP)) {
  console.error(`geography: ${ZIP} missing — run npm run data:fetch first.`);
  process.exit(1);
}
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
execFileSync("unzip", ["-o", "-q", ZIP, "-d", WORK]);
if (!existsSync(SHP)) throw new Error(`geography: ${SHP} not found inside archive`);

const slugOf = (pdName: string) => pdName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

mkdirSync(TMP, { recursive: true });
mkdirSync(resolve(ROOT, "public/data"), { recursive: true });

const run = (args: string[]) =>
  execFileSync("npx", ["mapshaper", SHP, ...args], { stdio: ["ignore", "pipe", "inherit"] }).toString();

// Municipality polygons, simplified for display.
run([
  "-filter", "Reg_name == 'Region of Durham'",
  "-rename-fields", "name=PD_name",
  "-simplify", "10%", "keep-shapes", "method=visvalingam",
  "-clean",
  "-proj", "wgs84",
  "-o", `${TMP}/durham-pd.geojson`, "precision=0.000001", "format=geojson",
]);

// Dissolved outline for the hero / intro visuals. Aggressive simplification
// is fine — it is a background gesture, not an analytical boundary.
run([
  "-filter", "Reg_name == 'Region of Durham'",
  "-dissolve",
  "-simplify", "3%", "method=visvalingam",
  "-clean",
  "-proj", "wgs84",
  "-o", `${TMP}/durham-outline.geojson`, "precision=0.0001", "format=geojson",
]);

interface FeatureCollection {
  type: string;
  features?: {
    type: "Feature";
    properties: { name?: string };
    geometry: GeoJSON.Geometry;
  }[];
  geometries?: GeoJSON.Geometry[];
}

const collection = JSON.parse(readFileSync(resolve(TMP, "durham-pd.geojson"), "utf8")) as FeatureCollection;

// Join to the geography registry: shapefile PD_name (e.g. "Pickering")
// matches the municipality column names used in the CSVs.
const features = (collection.features ?? []).map((f) => {
  const name = f.properties.name ?? "";
  const id = slugOf(name);
  if (!MUNICIPALITIES[id]) throw new Error(`geography: shapefile PD "${name}" does not match a municipality`);
  return { ...f, properties: { id, name: MUNICIPALITIES[id] } };
});

const ids = features.map((f) => f.properties.id).sort();
const expected = Object.keys(MUNICIPALITIES).sort();
if (ids.join(",") !== expected.join(",")) {
  throw new Error(`geography: expected municipalities ${expected.join(",")} but got ${ids.join(",")}`);
}

writeFileSync(
  resolve(ROOT, "public/data/planning-districts.geojson"),
  JSON.stringify({ type: "FeatureCollection", features }),
);

// Dissolve emits a bare GeometryCollection; normalize to one Feature so any
// GeoJSON consumer can render it directly.
const outlineRaw = JSON.parse(readFileSync(resolve(TMP, "durham-outline.geojson"), "utf8")) as FeatureCollection;
let outlineGeometry: GeoJSON.Geometry;
if (outlineRaw.type === "GeometryCollection" && outlineRaw.geometries?.length === 1) {
  outlineGeometry = outlineRaw.geometries[0];
} else if (outlineRaw.type === "FeatureCollection" && outlineRaw.features?.length === 1) {
  outlineGeometry = outlineRaw.features[0].geometry;
} else {
  throw new Error(`geography: unexpected outline structure (${outlineRaw.type})`);
}
const outline = {
  type: "Feature",
  properties: { id: "durham", name: "Durham Region" },
  geometry: outlineGeometry,
};
writeFileSync(resolve(ROOT, "public/data/durham-outline.geojson"), JSON.stringify(outline));

rmSync(resolve(TMP, "durham-pd.geojson"));
rmSync(resolve(TMP, "durham-outline.geojson"));
rmSync(WORK, { recursive: true, force: true });

console.log(`geography: ${features.length} planning districts → public/data/planning-districts.geojson`);
console.log("          outline → public/data/durham-outline.geojson");
