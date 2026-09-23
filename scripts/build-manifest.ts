/**
 * Builds public/data/manifest.json — the machine-readable provenance record
 * backing the Sources page. Joins source definitions with observed checksums.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { SOURCES } from "./lib/sources.ts";

const ROOT = resolve(import.meta.dirname, "..");
const CHECKSUMS_PATH = resolve(ROOT, "data/intermediate/checksums.json");
const OUT = resolve(ROOT, "public/data/manifest.json");

const checksums = existsSync(CHECKSUMS_PATH)
  ? JSON.parse(readFileSync(CHECKSUMS_PATH, "utf8"))
  : {};

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const sources = SOURCES.map((s) => {
  const abs = resolve(ROOT, s.rawPath);
  const observed = existsSync(abs) ? sha256(abs) : null;
  const prior = checksums[s.id] as { downloadedAt?: string } | undefined;
  return {
    id: s.id,
    title: s.title,
    organization: s.organization,
    surveyYear: s.surveyYear,
    geography: s.geography,
    url: s.url,
    landingPage: s.landingPage,
    licence: s.licence,
    licenceUrl: s.licenceUrl,
    acquisition: s.acquisition ?? "public",
    availability: observed ? "present" : s.acquisition === "manual" ? "manual-import-required" : "missing",
    downloadedAt: prior?.downloadedAt ?? null,
    sha256: observed,
    supplementaryOnly: s.supplementaryOnly ?? false,
    note: s.note ?? null,
  };
});

// Public sources must exist after data:fetch — a missing one is a pipeline
// failure. Manual (authenticated) imports are inventoried, not fetched;
// downstream OD steps fail with their own actionable message when absent.
const missingPublic = sources.filter((s) => !s.sha256 && s.acquisition === "public");
if (missingPublic.length > 0) {
  console.error(`manifest: ${missingPublic.length} public source file(s) missing: ${missingPublic.map((m) => m.id).join(", ")}`);
  process.exit(1);
}
const missingManual = sources.filter((s) => !s.sha256 && s.acquisition === "manual");
if (missingManual.length > 0) {
  console.warn(
    `manifest: ${missingManual.length} manual import(s) absent (${missingManual.map((m) => m.id).join(", ")}) — recorded as manual-import-required; OD steps will not run until imported (docs/idrs-data.md).`,
  );
}

mkdirSync(resolve(ROOT, "public/data"), { recursive: true });
const manifest = {
  generatedAt: new Date().toISOString(),
  project: "Durham in Motion",
  attribution:
    "Transportation Tomorrow Survey data: Data Management Group, University of Toronto. Additional historical data: Government of Ontario. Calculations and visualizations by Durham in Motion.",
  endorsement:
    "Durham in Motion is an independent project. It is not endorsed by, or affiliated with, the Data Management Group or the University of Toronto.",
  sources,
};
writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: wrote ${sources.length} sources → public/data/manifest.json`);
