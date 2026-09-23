/**
 * Golden values and parser invariants for the Phase 3 iDRS pipeline
 * (scripts/lib/phase3.ts + scripts/build-phase3-data.ts, handoff §1–§21).
 *
 * Fixture-based parser tests run anywhere; the golden-value tests read the
 * committed data/processed/phase3/normalized.json, which is a deterministic
 * function of the raw extracts under data/raw/idrs/phase3/. If one of these
 * fails after a data refresh, the survey extracts changed — investigate
 * before shipping.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeIdrs, parseMatrixBlocks, parseTripletBlocks, AGE_GROUPS } from "../../scripts/lib/phase3.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const NORMALIZED = resolve(ROOT, "data/processed/phase3/normalized.json");
const EXTRACTIONS = resolve(ROOT, "data/processed/phase3/extractions.json");

// ---------------------------------------------------------------------------
// Parser invariants (synthetic fixtures)
// ---------------------------------------------------------------------------

test("decodeIdrs unwraps single and double JSON string encoding", () => {
  const text = "Trip 2022 \nTable: X\n\n,a,b\nx,1,2\n";
  assert.equal(decodeIdrs(JSON.stringify(text)), text);
  assert.equal(decodeIdrs(JSON.stringify(JSON.stringify(text))), text);
  assert.equal(decodeIdrs(text), text);
});

test("parseMatrixBlocks handles multi-block output with repeated survey preambles", () => {
  const text = [
    "Trip 2022 ",
    "Table: Home-Based Work",
    ",m1,m2",
    "PD 1 of Toronto,10,20",
    "Brock,5,6",
    "",
    "Trip 2022 ",
    "Table: Home-based School",
    ",m1,m2",
    "PD 1 of Toronto,1,2",
    "Brock,3,4",
    "",
  ].join("\n");
  const blocks = parseMatrixBlocks(text);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.label, "Home-Based Work");
  assert.equal(blocks[0]!.total, 41);
  assert.equal(blocks[1]!.label, "Home-based School");
  assert.equal(blocks[1]!.values[1]![0], 3);
});

test("parseTripletBlocks sums sparse code cells", () => {
  const text = [
    "Trip 2022",
    "ROW : start_time",
    "COLUMN : pd_orig",
    "",
    "TABLE    : pd_dest (Brock)",
    "",
    "  start_time     pd_orig      total",
    "         400          17         57",
    "         405          23         48",
    "",
  ].join("\n");
  const { blocks, total } = parseTripletBlocks(text);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.label, "Brock");
  assert.equal(blocks[0]!.cells.length, 2);
  assert.equal(total, 105);
});

// ---------------------------------------------------------------------------
// Golden values (require the committed normalized.json)
// ---------------------------------------------------------------------------

if (!existsSync(NORMALIZED)) {
  test("phase3 golden values", () => {
    assert.fail("data/processed/phase3/normalized.json missing — run npm run data:phase3 after importing the raw extracts");
  });
} else {
  const ds = JSON.parse(readFileSync(NORMALIZED, "utf8"));

  test("all-households universe and survey-record support (A/B)", () => {
    assert.equal(ds.odAll.universe, 19_470_494);
    assert.equal(ds.odAll.universeSurveyRecords, 759_736);
  });

  test("Durham relationship totals (A)", () => {
    assert.equal(ds.odAll.relationships.internal_durham, 1_157_095);
    assert.equal(ds.odAll.relationships.inbound_to_durham, 202_000);
    assert.equal(ds.odAll.relationships.outbound_from_durham, 205_153);
    // near-balance is the story; pin the ratio to 3 decimals
    assert.ok(Math.abs(ds.odAll.inboundOutboundRatio - 0.985) < 0.0005);
  });

  test("mode flows reconcile with the A matrix within dimension residue (C)", () => {
    const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    const inbound = total(ds.modeFlows.inbound);
    const outbound = total(ds.modeFlows.outbound);
    assert.ok(Math.abs(inbound - ds.odAll.relationships.inbound_to_durham) <= 30, `inbound residue ${inbound - ds.odAll.relationships.inbound_to_durham}`);
    assert.ok(Math.abs(outbound - ds.odAll.relationships.outbound_from_durham) <= 30, `outbound residue ${outbound - ds.odAll.relationships.outbound_from_durham}`);
  });

  test("daily pulse totals reconcile with Durham-resident trips (F)", () => {
    const dayTotal = ds.day.durhamResidents.reduce((s: number, x: { trips: number }) => s + x.trips, 0);
    // resident trip universe is 1,440,14x; time dimension carries a small residue
    assert.ok(dayTotal > 1_440_100 && dayTotal < 1_440_200, `day total ${dayTotal}`);
    const records = ds.day.durhamResidents.reduce((s: number, x: { surveyRecords: number }) => s + x.surveyRecords, 0);
    assert.equal(records, 54_535);
  });

  test("transit journey totals (P/N/O)", () => {
    const sumLinks = (o: Record<string, Record<string, number>>) =>
      Object.values(o).reduce((a, r) => a + Object.values(r).reduce((x, v) => x + v, 0), 0);
    assert.equal(sumLinks(ds.transit.linksByAccess), 50_753);
    assert.equal(sumLinks(ds.transit.linksByAccessGo), 18_735);
    assert.equal(sumLinks(ds.transit.linksByAccessNonGo), 32_018);
    assert.equal(ds.transit.goTrips, 18_736);
    // station OD: top cell is Union → Whitby (the return leg dominates volume)
    assert.equal(ds.transit.stationOd[0].from, "Union GO Station");
    assert.equal(ds.transit.stationOd[0].to, "Whitby GO Station");
    assert.equal(ds.transit.stationOd[0].trips, 2_573);
    assert.equal(ds.transit.stationOd[0].surveyRecords, 146);
  });

  test("age × mode groups partition the resident universe (K)", () => {
    assert.equal(Object.keys(ds.ageByMode.groups).length, AGE_GROUPS.length);
    const groups = ds.ageByMode.groups as Record<string, Record<string, number>>;
    const total = Object.values(groups).reduce((a, r) => a + Object.values(r).reduce((x, v) => x + v, 0), 0);
    assert.equal(total, 1_440_148);
    // children cannot drive: the 5–14 drive share is exactly 0
    assert.equal(groups["5–14"].drive ?? 0, 0);
  });

  test("extraction manifest is complete and checksummed", () => {
    const manifest = JSON.parse(readFileSync(EXTRACTIONS, "utf8"));
    assert.equal(manifest.extractions.length, 22);
    for (const e of manifest.extractions) {
      assert.match(e.sha256, /^[0-9a-f]{64}$/);
      assert.equal(e.surveyYear, 2022);
    }
  });
}
