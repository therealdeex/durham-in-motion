/**
 * Downloads and verifies every PUBLIC source listed in scripts/lib/sources.ts.
 *
 * Acquisition modes (audit A09):
 *  - public sources are downloaded (or verified when already present);
 *  - manual/authenticated sources (the iDRS extracts) are NEVER fetched —
 *    their `url` is a landing page, not a data file. Their presence is
 *    inventoried with actionable import instructions instead.
 *
 * Acceptance: a download must look like the file type we expect (CSV rows or
 * a zip/shapefile binary) before it replaces or creates the archived file;
 * downloads land in a temp file first, so a failed validation leaves any
 * previous file untouched. Real byte counts are recorded.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, unlinkSync } from "node:fs";
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

/** Structural sanity check so a landing page or error body is never archived
 *  as data. Returns an error string, or null when acceptable. */
function validateDownload(path: string, url: string): string | null {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    return "unreadable";
  }
  if (buf.length < 100) return `suspiciously small (${buf.length} bytes)`;
  if (url.endsWith(".zip")) {
    // Zip local-file-header magic PK\x03\x04 (or empty/spanning variants).
    const magic = buf.subarray(0, 2).toString("latin1");
    if (magic !== "PK") return `not a zip file (starts "${buf.subarray(0, 8).toString("latin1").replace(/[^\x20-\x7e]/g, ".")}")`;
    return null;
  }
  const text = buf.toString("utf8");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const looksHtml = /^\s*<(?:!doctype|html)/i.test(text) || /<head>/i.test(text.slice(0, 2000));
  if (looksHtml) return "content is HTML, not a data file";
  if (commas < 2) return `first row has only ${commas} comma(s); expected a wide CSV header`;
  return null;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "durham-in-motion/0.1 (public data story; contact: repo issue tracker)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (/text\/html/i.test(contentType)) {
    throw new Error(`received HTML (${contentType}) — the direct file URL no longer resolves`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`Suspiciously small response (${buf.length} bytes) for ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.download`;
  writeFileSync(tmp, buf);
  const invalid = validateDownload(tmp, url);
  if (invalid) {
    unlinkSync(tmp);
    throw new Error(`download failed validation: ${invalid}`);
  }
  renameSync(tmp, dest); // accepted — replace only now
}

async function main(): Promise<void> {
  const previous = loadPrevious();
  const results: Record<string, ChecksumEntry> = { ...previous };
  let failures = 0;
  const missingManual: string[] = [];

  for (const src of SOURCES) {
    const abs = resolve(ROOT, src.rawPath);

    if (src.acquisition === "manual") {
      // Authenticated extract: inventory only. Never fetch its landing-page URL.
      if (existsSync(abs)) {
        const hash = sha256(abs);
        results[src.id] = {
          sha256: hash,
          bytes: statSync(abs).size,
          downloadedAt: previous[src.id]?.downloadedAt ?? "imported",
        };
        console.log(`◆ ${src.id} present (manual import, ${hash.slice(0, 12)}…)`);
      } else {
        missingManual.push(src.id);
        console.warn(`◇ ${src.id} MISSING — manual import required (see docs/idrs-data.md): expected at ${src.rawPath}`);
      }
      continue;
    }

    if (existsSync(abs)) {
      const hash = sha256(abs);
      const prior = previous[src.id];
      if (prior && prior.sha256 !== hash) {
        console.warn(`⚠  ${src.id}: file changed on disk since last run (${prior.sha256.slice(0, 10)} → ${hash.slice(0, 10)}) — refresh recorded`);
      }
      results[src.id] = {
        sha256: hash,
        bytes: statSync(abs).size,
        downloadedAt: prior?.sha256 === hash ? prior.downloadedAt : new Date().toISOString(),
      };
      console.log(`✓ ${src.id} present (${hash.slice(0, 12)}…)`);
      continue;
    }
    try {
      console.log(`↓ downloading ${src.id} …`);
      await download(src.url, abs);
      results[src.id] = {
        sha256: sha256(abs),
        bytes: statSync(abs).size,
        downloadedAt: new Date().toISOString(),
      };
      console.log(`✓ ${src.id} downloaded (${results[src.id]!.sha256.slice(0, 12)}…)`);
    } catch (err) {
      failures += 1;
      console.error(`✗ ${src.id} FAILED: ${(err as Error).message}`);
      console.error(`   Landing page: ${src.landingPage}`);
      console.error(`   Expected at:  ${abs}`);
    }
  }

  mkdirSync(dirname(CHECKSUMS_PATH), { recursive: true });
  writeFileSync(CHECKSUMS_PATH, JSON.stringify(results, null, 2) + "\n");

  if (missingManual.length > 0) {
    console.warn(
      `\n${missingManual.length} manual source(s) absent. The OD pipeline (data:od, data:od-findings) needs them;` +
        ` app builds keep working from committed curated JSON. Import per docs/idrs-data.md, then re-run.`,
    );
  }
  if (failures > 0) {
    console.error(`\n${failures} public source(s) could not be fetched. Add them manually to data/raw/ and re-run.`);
    process.exit(1);
  }
  console.log("\nAll public sources present and checksummed; manual imports inventoried.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
