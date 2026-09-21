/**
 * ETL: raw DMG CSVs → normalized records.
 *
 * Output: data/processed/normalized.json (full fidelity, all geographies/years)
 * plus public/data/geographies.json (geography registry for the site).
 *
 * Invariants enforced here (see docs/data-inventory.md):
 *  - "*" is suppressed, never zero; "N/A" is not_available; "" is missing.
 *  - 2022 trip records are flagged not_comparable with earlier cycles
 *    (trips collected for persons 5+ vs 11+; walking captured more fully).
 *  - Every record carries its source id and raw label for provenance.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { FILE_SPECS, dedupeRecords, readFile, type GeographyEntry, type NormalizedRecord } from "./lib/read-files.ts";

const ROOT = resolve(import.meta.dirname, "..");

const allRecords: NormalizedRecord[] = [];
const geoById = new Map<string, GeographyEntry>();
let unresolvedTotal = 0;

for (const spec of FILE_SPECS) {
  console.log(`normalizing ${spec.path} (${spec.year}) …`);
  const { records, geography, unresolved } = readFile(spec);
  if (unresolved.length > 0) {
    unresolvedTotal += unresolved.length;
    console.error(`  ✗ ${unresolved.length} unresolved labels in ${spec.path}:`);
    for (const label of unresolved) console.error(`     "${label}"`);
  }
  allRecords.push(...records);
  for (const geo of geography) {
    const existing = geoById.get(geo.id);
    if (existing) {
      if (existing.name !== geo.name || existing.type !== geo.type)
        throw new Error(`Geography conflict for ${geo.id}: ${existing.name}/${geo.name}`);
      existing.surveyYears.push(spec.year);
    } else {
      geoById.set(geo.id, geo);
    }
  }
  console.log(`  ${records.length / geography.length} metrics × ${geography.length} geographies = ${records.length} records`);
}

if (unresolvedTotal > 0) {
  console.error(`\nnormalize: FAILED — ${unresolvedTotal} labels could not be classified.`);
  process.exit(1);
}

// Ward files repeat the region column alongside the municipal file; keep one
// record per key (the municipal file is read first) and cross-check values.
const { records: recordsOut, mismatches: regionCrosscheckFailures } = dedupeRecords(allRecords);
if (regionCrosscheckFailures > 0) {
  console.error(`\nnormalize: FAILED — ${regionCrosscheckFailures} region cross-check mismatches between municipal and ward files.`);
  process.exit(1);
}

// Sanity: every ward belongs to a known municipality.
for (const geo of geoById.values()) {
  if (geo.type === "ward" && !geoById.has(geo.municipality!)) {
    throw new Error(`Ward ${geo.id} has no parent municipality record`);
  }
}

mkdirSync(resolve(ROOT, "data/processed"), { recursive: true });
mkdirSync(resolve(ROOT, "public/data"), { recursive: true });

const geographies = [...geoById.values()].map((g) => ({
  ...g,
  surveyYears: [...new Set(g.surveyYears)].sort((a, b) => a - b),
}));

writeFileSync(
  resolve(ROOT, "data/processed/normalized.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), records: recordsOut, geographies }),
);
writeFileSync(
  resolve(ROOT, "public/data/geographies.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), geographies }),
);

console.log(`\nnormalize: ${recordsOut.length} records across ${geographies.length} geographies`);
console.log("  → data/processed/normalized.json, public/data/geographies.json");
