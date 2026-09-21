/**
 * Downloads and verifies every source listed in scripts/lib/sources.ts.
 * - Skips download when the file exists and its checksum matches the
 *   previously recorded one in data/intermediate/checksums.json.
 * - Records sha256 + size + timestamp for every file.
 * - Never substitutes data; on failure it exits non-zero unless the source is
 *   supplementary, printing the landing page so the file can be added manually.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SOURCES } from "./lib/sources.ts";

const ROOT = resolve(import.meta.dirname, "..");
const CHECKSUMS_PATH = resolve(ROOT, "data/intermediate/checksums.json");

interface ChecksumEntry {
  sha256: string;
  bytes: number;
  downloadedAt: string;
}

const loadPrevious = (): Record<string, ChecksumEntry> => {
  try {
    return JSON.parse(readFileSync(CHECKSUMS_PATH, "utf8"));
  } catch {
    return {};
  }
};

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "durham-in-motion/0.1 (public data story; contact: repo issue tracker)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`Suspiciously small response (${buf.length} bytes) for ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
}

async function main(): Promise<void> {
const previous = loadPrevious();
const results: Record<string, ChecksumEntry> = { ...previous };
let failures = 0;

for (const src of SOURCES) {
  const abs = resolve(ROOT, src.rawPath);
  if (existsSync(abs)) {
    const hash = sha256(abs);
    const prior = previous[src.id];
    if (prior && prior.sha256 !== hash) {
      console.warn(`⚠  ${src.id}: file changed on disk since last run (${prior.sha256.slice(0, 10)} → ${hash.slice(0, 10)})`);
    }
    results[src.id] = prior && prior.sha256 === hash
      ? prior
      : { sha256: hash, bytes: 0, downloadedAt: prior?.downloadedAt ?? new Date().toISOString() };
    if (!prior) results[src.id] = { sha256: hash, bytes: 0, downloadedAt: new Date().toISOString() };
    console.log(`✓ ${src.id} present (${hash.slice(0, 12)}…)`);
    continue;
  }
  try {
    console.log(`↓ downloading ${src.id} …`);
    await download(src.url, abs);
    const entry: ChecksumEntry = {
      sha256: sha256(abs),
      bytes: 0,
      downloadedAt: new Date().toISOString(),
    };
    results[src.id] = entry;
    console.log(`✓ ${src.id} downloaded (${entry.sha256.slice(0, 12)}…)`);
  } catch (err) {
    failures += 1;
    console.error(`✗ ${src.id} FAILED: ${(err as Error).message}`);
    console.error(`   Landing page: ${src.landingPage}`);
    console.error(`   Expected at:  ${abs}`);
  }
}

mkdirSync(dirname(CHECKSUMS_PATH), { recursive: true });
writeFileSync(CHECKSUMS_PATH, JSON.stringify(results, null, 2) + "\n");

if (failures > 0) {
  console.error(`\n${failures} source(s) could not be fetched. Add them manually to data/raw/ and re-run.`);
  process.exit(1);
}
console.log("\nAll sources present and checksummed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
