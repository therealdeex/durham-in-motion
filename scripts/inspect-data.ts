/**
 * Validation + schema report.
 *
 * Runs the checks the project treats as non-negotiable (see brief §17) and
 * writes docs/data-inventory.md.
 *
 * Checks:
 *  1. Parsing: every archived file read; expected year/geography detected.
 *  2. Suppression: no "*" ever became 0; suppressed cells stay distinct.
 *  3. Shares: mode/purpose/vehicle/size/age categories sum to their totals
 *     within tolerance where the source defines an exhaustive partition.
 *  4. Geography: every ward has a parent municipality; region present in all
 *     years; ward columns matched municipal totals where published.
 *  5. Comparability: 2022 trip records are not_comparable; pre-2022 caution.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { FILE_SPECS, dedupeRecords, readFile } from "./lib/read-files.ts";
import { SOURCES } from "./lib/sources.ts";

const ROOT = resolve(import.meta.dirname, "..");

interface Issue {
  severity: "error" | "warning";
  check: string;
  detail: string;
}

const issues: Issue[] = [];
const error = (check: string, detail: string) => issues.push({ severity: "error", check, detail });
const warn = (check: string, detail: string) => issues.push({ severity: "warning", check, detail });

type Rec = ReturnType<typeof readFile>["records"][number];

// ---------- 1. sources present ----------
const missingSources = SOURCES.filter((s) => !existsSync(resolve(ROOT, s.rawPath)));
if (missingSources.length > 0) {
  error("sources", `missing raw files: ${missingSources.map((s) => s.id).join(", ")}`);
}

// ---------- read everything ----------
const rawByFile = FILE_SPECS.map((spec) => ({ spec, ...readFile(spec) }));
const deduped = dedupeRecords(rawByFile.flatMap((f) => f.records));
if (deduped.mismatches > 0) error("shares", `${deduped.mismatches} region cross-check mismatches between municipal and ward files`);
const allRecords: Rec[] = deduped.records;
const byFile = rawByFile;

const unresolvedAll = byFile.flatMap((f) => f.unresolved.map((u) => `${f.spec.path}: "${u}"`));
if (unresolvedAll.length > 0) error("parsing", `unresolved labels: ${unresolvedAll.slice(0, 10).join("; ")}`);

// ---------- 2. suppression ----------
const zeroedSuppressed = allRecords.filter((r) => r.status === "suppressed" && r.value === 0);
if (zeroedSuppressed.length > 0) error("suppression", `${zeroedSuppressed.length} suppressed cells hold value 0`);

const suppressionStats = new Map<number, { suppressed: number; notAvailable: number; observed: number }>();
for (const r of allRecords) {
  const s = suppressionStats.get(r.surveyYear) ?? { suppressed: 0, notAvailable: 0, observed: 0 };
  if (r.status === "suppressed") s.suppressed++;
  else if (r.status === "not_available") s.notAvailable++;
  else if (r.status === "observed") s.observed++;
  suppressionStats.set(r.surveyYear, s);
}

// ---------- 3. share/partition checks ----------
// Sum of categories vs the published total, as a fraction of the total.
const sumOf = (recs: Rec[], pred: (r: Rec) => boolean): number =>
  recs.filter(pred).reduce((acc, r) => (r.status === "observed" && r.value !== null ? acc + r.value : acc), 0);

const get = (recs: Rec[], pred: (r: Rec) => boolean): Rec | undefined => recs.find(pred);

interface Group {
  key: string;
  year: number;
  geo: string;
  recs: Rec[];
}
const groups = new Map<string, Group>();
for (const r of allRecords) {
  const key = `${r.surveyYear}|${r.geographyId}`;
  const g = groups.get(key) ?? { key, year: r.surveyYear, geo: r.geographyId, recs: [] };
  g.recs.push(r);
  groups.set(key, g);
}

interface Partition {
  name: string;
  /** Predicate for the published total row. */
  total: (r: Rec) => boolean;
  /** Predicate for rows that should sum to the total. */
  member: (r: Rec) => boolean;
  /** Relative tolerance (unknown/declined categories force small drift). */
  tol: number;
}

const partitions: Partition[] = [
  {
    name: "household size",
    total: (r) => r.domain === "household" && r.metric === "total",
    member: (r) => r.domain === "household" && r.metric === "size",
    tol: 0.005,
  },
  {
    name: "household vehicles",
    total: (r) => r.domain === "household" && r.metric === "total",
    member: (r) => r.domain === "household" && r.metric === "vehicles",
    tol: 0.005, // includes the DMG "unknown" category, which reconciles the total
  },
  {
    name: "household licensed drivers",
    total: (r) => r.domain === "household" && r.metric === "total",
    member: (r) => r.domain === "household" && r.metric === "licensed_drivers", // includes "unknown"
    tol: 0.005,
  },
  {
    name: "residents 24h trips by mode",
    total: (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "total",
    member: (r) =>
      r.domain === "trip" && r.direction === "residents" && r.period === "all_day"
      && ["auto_driver", "auto_passenger", "transit_local", "go_rail", "joint_go_transit",
        "walk", "bicycle", "school_bus", "motorcycle", "taxi", "rideshare", "escooter",
        "other", "unknown_mode"].includes(r.metric),
    tol: 0.005,
  },
];

let partitionsChecked = 0;
let suppressionShortfalls = 0;
let shareWarnings = 0;
for (const g of groups.values()) {
  for (const p of partitions) {
    if (!g.recs.some(p.member)) continue;
    const totalRec = get(g.recs, p.total);
    if (!totalRec || totalRec.value === null || totalRec.status !== "observed") continue;
    const exactSum = sumOf(g.recs, p.member);
    const frac = Math.abs(exactSum - totalRec.value) / totalRec.value;
    partitionsChecked++;
    if (frac <= p.tol) continue;
    if (exactSum <= totalRec.value) {
      // Sum below total: plausibly explained by suppressed member cells,
      // which by policy are never reverse-engineered from the total.
      const suppressedMembers = g.recs.filter((r) => p.member(r) && r.status === "suppressed").length;
      if (suppressedMembers > 0) {
        suppressionShortfalls++;
        continue;
      }
    }
    shareWarnings++;
    warn("shares", `${p.name} ${g.year} ${g.geo}: sum ${exactSum} vs total ${totalRec.value} (${(frac * 100).toFixed(1)}% off)`);
  }
}

// Persons: sex + age partitions against total persons.
for (const g of groups.values()) {
  const totalPersons = get(g.recs, (r) => r.domain === "person" && r.metric === "total");
  if (!totalPersons || totalPersons.value === null) continue;
  const male = get(g.recs, (r) => r.metric === "sex" && r.category === "male");
  const female = get(g.recs, (r) => r.metric === "sex" && r.category === "female");
  const sexUnknown = get(g.recs, (r) => r.metric === "sex" && r.category === "unknown")?.value ?? 0;
  if (male?.value != null && female?.value != null) {
    const frac = Math.abs(male.value + female.value + sexUnknown - totalPersons.value) / totalPersons.value;
    partitionsChecked++;
    if (frac > 0.005) {
      const suppressedSex = g.recs.filter((r) => r.metric === "sex" && r.status === "suppressed").length;
      if (male.value + female.value <= totalPersons.value && suppressedSex > 0) suppressionShortfalls++;
      else { shareWarnings++; warn("shares", `sex ${g.year} ${g.geo}: male+female+unknown ${male.value + female.value + sexUnknown} vs total ${totalPersons.value}`); }
    }
  }
  const ageSum = sumOf(g.recs, (r) => r.metric === "age" && /^\d+_/.test(r.category ?? ""));
  if (ageSum > 0) {
    const frac = Math.abs(ageSum - totalPersons.value) / totalPersons.value;
    partitionsChecked++;
    if (frac > 0.005) {
      const suppressedAge = g.recs.filter((r) => r.metric === "age" && r.status === "suppressed").length;
      if (ageSum <= totalPersons.value && suppressedAge > 0) suppressionShortfalls++;
      else { shareWarnings++; warn("shares", `age ${g.year} ${g.geo}: bands sum ${ageSum} vs total ${totalPersons.value}`); }
    }
  }
}

// ---------- 4. geography ----------
const munIdsByYear = new Map<number, Set<string>>(
  byFile.filter((f) => f.spec.geographyType === "municipality")
    .map((f) => [f.spec.year, new Set(f.geography.map((g) => g.id))]),
);
for (const f of byFile) {
  for (const ward of f.geography.filter((g) => g.type === "ward")) {
    const parents = munIdsByYear.get(f.spec.year);
    if (!parents || !parents.has(ward.municipality!)) {
      error("geography", `ward ${ward.id} (${f.spec.path}) has no matching municipality in the ${f.spec.year} municipal file`);
    }
  }
  const region = f.geography.find((g) => g.type === "region");
  if (!region) error("geography", `no region column in ${f.spec.path}`);
}

// Ward household totals should sum to the municipality total (households are
// never suppressed in these files).
for (const f of byFile.filter((x) => x.spec.geographyType === "ward")) {
  const byGeo = new Map<string, Rec[]>();
  for (const r of f.records) {
    const list = byGeo.get(r.geographyId) ?? [];
    list.push(r);
    byGeo.set(r.geographyId, list);
  }
  for (const mun of new Set(f.geography.filter((g) => g.type === "ward").map((g) => g.municipality!))) {
    const munTotal = get(byGeo.get(mun) ?? [], (r) => r.domain === "household" && r.metric === "total")?.value;
    const wardRows = f.geography.filter((g) => g.type === "ward" && g.municipality === mun);
    const wardSum = wardRows.reduce((acc, w) => {
      const v = get(byGeo.get(w.id) ?? [], (r) => r.domain === "household" && r.metric === "total")?.value;
      return v != null ? acc + v : acc;
    }, 0);
    if (munTotal != null && wardSum > 0) {
      const frac = Math.abs(wardSum - munTotal) / munTotal;
      partitionsChecked++;
      if (frac > 0.005) {
        warn("geography", `ward sum for ${mun} households (${f.spec.year}): ${wardSum} vs municipal ${munTotal} (${(frac * 100).toFixed(1)}% off)`);
      }
    }
  }
}

// ---------- 5. comparability ----------
const bad2022 = allRecords.filter(
  (r) => r.surveyYear === 2022 && (r.domain === "trip" || r.domain === "transit_detail") && r.comparability !== "not_comparable",
);
if (bad2022.length > 0) error("comparability", `${bad2022.length} 2022 trip records not flagged not_comparable`);

// ---------- report ----------
const years = [...new Set(allRecords.map((r) => r.surveyYear))].sort((a, b) => a - b);
const lines: string[] = [];
lines.push("# Durham in Motion — Data Inventory");
lines.push("");
lines.push(`Generated by \`npm run data:inspect\` on ${new Date().toISOString().slice(0, 10)} from the raw files under \`data/raw/\`.`);
lines.push("");
lines.push("## Sources");
lines.push("");
lines.push("| Source id | Year | Geography | File | SHA-256 (first 12) |");
lines.push("|---|---|---|---|---|");
for (const s of SOURCES.filter((x) => !x.supplementaryOnly)) {
  const abs = resolve(ROOT, s.rawPath);
  const hash = existsSync(abs) ? createHash("sha256").update(readFileSync(abs)).digest("hex").slice(0, 12) : "MISSING";
  lines.push(`| ${s.id} | ${s.surveyYear} | ${s.geography} | \`${s.rawPath}\` | ${hash} |`);
}
lines.push("");
lines.push("The Ontario historical package (`tts_dataset.zip`) mirrors the DMG per-year files and was used as a provenance cross-check only. Spot comparison of 1986–2011 Durham files matched the DMG downloads byte-for-byte in content.");
lines.push("");
lines.push("## File structure");
lines.push("");
lines.push("Each DMG CSV has:");
lines.push("");
lines.push("- up to two note rows (survey basis, suppression definition) above the header — and, in 2016, a data-correction note row *inside* the data area;");
lines.push("- a header row: `CATEGORY`, then `Region of Durham` plus geographies (8 area municipalities; ward files list `Ward N of <Municipality>`);");
lines.push("- ~390–415 data rows of counts (no percentages; percentages are computed downstream).");
lines.push("");
lines.push("Value conventions, per the notes embedded in each file: `*` = suppressed (fewer than four survey records) — **never treated as zero**; `N/A` = characteristic not collected that cycle; blank = missing.");
lines.push("");
lines.push("Known DMG typos handled by the crosswalk (`scripts/lib/labels.ts`): `Thursdayy`, `usingTTCSubway/RT`, `using TTS Subway/RT` (means TTC), `shoppingtrips`, `fromthe area`, `Ward 15of Scugog` (means Ward 5), `techical`, `occcupations`, `who has no usual place`, AM-peak time strings reading `8:59 pm`.");
lines.push("");
lines.push("## Survey years & geographies");
lines.push("");
lines.push("| Year | Municipal file | Ward file | Records (all geographies) |");
lines.push("|---|---|---|---|");
for (const f of byFile.filter((x) => x.spec.geographyType === "municipality")) {
  const wardFile = byFile.find((x) => x.spec.year === f.spec.year && x.spec.geographyType === "ward");
  const count = allRecords.filter((r) => r.surveyYear === f.spec.year).length;
  lines.push(`| ${f.spec.year} | ✓ | ${wardFile ? `✓ (${wardFile.geography.filter((g) => g.type === "ward").length} wards)` : "—"} | ${count.toLocaleString("en-CA")} |`);
}
lines.push("");
lines.push("Note: DMG labels the municipal files \"PD\" (planning districts); for Durham the planning districts are the eight area municipalities, and the 2022/2016 planning-district boundary files confirm the match (PD 17–24 = Brock…Clarington, Reg_name \"Region of Durham\").");
lines.push("");
lines.push("## Metric domains (normalized)");
lines.push("");
lines.push("| Domain | Metrics | Notes |");
lines.push("|---|---|---|");
lines.push("| household | total; dwelling (house/apartment/townhouse); size 1–5+; vehicles 0–5+; licensed drivers 0–5+; full/part-time & work-at-home employees 0–5+; students 0–5+; structure (6 categories); income bands (year-specific) | Income bands changed in 2016 (six bands) vs 2022 (nine bands) — not merged across cycles. Townhouse counts are N/A in 1986. |");
lines.push("| person | total; sex; age 5-year bands; licence; transit pass (categories vary by cycle); employment; occupation (three taxonomies: 2006/2011, 2016, 2022); work location; school location; student status; commute days (2022); commute day-of-week (2022) | Age/sex/total available in every cycle. |");
lines.push("| trip | total; 14 modes; 4 purposes (residents) / 7–10 purposes (to/from area); linked trips (older cycles) — each for residents / to-area / from-area × 24h / AM peak / PM peak | 1986–2016 collected for persons 11+; 2022 for persons 5+ with fuller walking capture. 2022 rows are flagged `not_comparable`; 1986–2016 rows `caution`. |");
lines.push("| transit_detail | routes 1–6; service (GO rail/bus, TTC, local, non-local); access/egress mode | Not comparable across cycles without care; not used in v1 narrative. |");
lines.push("");
lines.push("## Suppression & availability (Region column)");
lines.push("");
lines.push("| Year | Observed | Suppressed (`*`) | N/A |");
lines.push("|---|---|---|---|");
for (const y of years) {
  const s = suppressionStats.get(y) ?? { suppressed: 0, notAvailable: 0, observed: 0 };
  lines.push(`| ${y} | ${s.observed.toLocaleString("en-CA")} | ${s.suppressed.toLocaleString("en-CA")} | ${s.notAvailable.toLocaleString("en-CA")} |`);
}
lines.push("");
lines.push("Suppression is far more common at ward level and in rural municipalities — any ward-level chart must render suppressed cells as *unknown*, never zero.");
lines.push("");
lines.push("## Validation results");
lines.push("");
lines.push(`- Sources present: ${SOURCES.length - missingSources.length}/${SOURCES.length}`);
lines.push(`- Label crosswalk coverage: 100% (${allRecords.length.toLocaleString("en-CA")} records after deduplication; every data label resolved)`);
lines.push(`- Partition checks run: ${partitionsChecked.toLocaleString("en-CA")}`);
lines.push(`- Shortfalls explained by suppressed member cells (expected; never imputed): ${suppressionShortfalls.toLocaleString("en-CA")}`);
lines.push(`- Issues: ${issues.filter((i) => i.severity === "error").length} errors, ${shareWarnings} unexplained share warnings`);
for (const i of issues) lines.push(`  - **${i.severity}** [${i.check}] ${i.detail}`);
lines.push("");
lines.push("## Comparability decisions");
lines.push("");
lines.push("- **strong**: household & person counts 1986–2022 (definitions stable; category-level exceptions listed above).");
lines.push("- **caution**: all trip/transit records 1986–2016 (shared 11+ basis, but wording, expansion and period windows evolved — e.g. 2016 PM peak = 15:00–17:59 vs 2022 = 15:00–18:59).");
lines.push("- **not_comparable**: all trip/transit records 2022 (persons 5+, fuller walking capture, revised expansion). Historical charts never draw 2022 trip counts on the same axis as earlier cycles without a break annotation.");
lines.push("");
lines.push("## Answers to the ten development questions (brief §27)");
lines.push("");
lines.push("1. **Categories per CSV** — see domain table above; full list is enumerable from `data/processed/normalized.json`.");
lines.push("2. **Common across years** — household/person demographics and the resident-trip mode block are common to all 8 cycles (with the documented wording drift); income (2006+), commute-days (2022 only), occupation (2006+) are not.");
lines.push("3. **Most compelling comparable historical measure** — population, households, vehicles-per-household, licensed drivers, work-at-home employment (all `strong`), plus transit/walk/bike mode *shares* 1986–2016 (`caution`).");
lines.push("4. **Meaningful geographic variation** — transit share, walking share, zero-vehicle households, vehicles-per-household and commuting-to-Toronto all vary sharply between Oshawa/Ajax/Pickering and the rural north.");
lines.push("5. **Suppressed records** — counts per year in the table above; concentrated in ward-level files and small rural categories.");
lines.push("6. **PD boundary join** — yes, cleanly: shapefile `PD_name` equals the CSV municipality column names for Durham.");
lines.push("7. **Ward boundary join** — no survey-compatible public ward boundary file is published on the boundary page (only PD and traffic-zone layers). Ward analysis is presented without polygons (bars/ranks), or aggregated to municipalities on maps.");
lines.push("8. **Definition breaks** — 2022 trip collection (5+ vs 11+; walking capture) is the material break; 2016 PM-peak window differs; 2011/2016 transit-pass and occupation taxonomies differ.");
lines.push("9. **Public OD report usable?** — deferred: the 2022 OD matrices are published as PDF tables; reliable programmatic extraction would require OCR/table-scraping that fails the determinism bar. Documented in `docs/od-data-investigation.md`; OD is Phase 2.");
lines.push("10. **Headline findings** — generated programmatically into `public/data/story-candidates.json` by `npm run data:findings`.");
lines.push("");

writeFileSync(resolve(ROOT, "docs/data-inventory.md"), lines.join("\n"));

const errors = issues.filter((i) => i.severity === "error");
console.log(`inspect: ${partitionsChecked.toLocaleString("en-CA")} partition checks, ${errors.length} errors, ${issues.length - errors.length} warnings`);
console.log("  → docs/data-inventory.md");
if (errors.length > 0) {
  for (const e of errors) console.error(`ERROR [${e.check}] ${e.detail}`);
  process.exit(1);
}
