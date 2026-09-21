/**
 * Invariants over the generated normalized dataset. These guard the rules the
 * project treats as non-negotiable (suppression handling, comparability
 * flags, provenance) and a few golden values read off the raw files.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const data = JSON.parse(
  readFileSync(resolve(ROOT, "data/processed/normalized.json"), "utf8"),
) as { records: Record<string, unknown>[]; geographies: { id: string; type: string; surveyYears: number[] }[] };

const records = data.records as {
  surveyYear: number;
  geographyId: string;
  domain: string;
  metric: string;
  category?: string;
  direction?: string;
  period?: string;
  value: number | null;
  status: string;
  comparability: string;
  sourceId: string;
  unit: string;
  sourceLabel: string;
}[];

const find = (pred: (r: typeof records[number]) => boolean) => records.find(pred);

test("all eight survey cycles present with region records", () => {
  for (const y of [1986, 1991, 1996, 2001, 2006, 2011, 2016, 2022]) {
    const rec = find((r) => r.surveyYear === y && r.geographyId === "durham" && r.domain === "household" && r.metric === "total");
    assert.ok(rec, `missing region households for ${y}`);
    assert.equal(rec!.status, "observed");
  }
});

test("golden values spot-checked against raw files", () => {
  const hh = (y: number) => find((r) => r.surveyYear === y && r.geographyId === "durham" && r.domain === "household" && r.metric === "total")!.value;
  assert.equal(hh(1986), 106046);
  assert.equal(hh(2022), 247055);
  const trips2022 = find((r) => r.surveyYear === 2022 && r.geographyId === "durham" && r.metric === "total" && r.direction === "residents" && r.period === "all_day")!.value;
  assert.equal(trips2022, 1440149);
  const persons1986 = find((r) => r.surveyYear === 1986 && r.geographyId === "durham" && r.metric === "total" && r.domain === "person")!.value;
  assert.equal(persons1986, 317886);
});

test("suppressed cells never carry a numeric value", () => {
  const bad = records.filter((r) => r.status === "suppressed" && r.value !== null);
  assert.deepEqual(bad, []);
  const suppressed = records.filter((r) => r.status === "suppressed");
  assert.ok(suppressed.length > 1000, "expected a realistic number of suppressed cells");
});

test("2022 trip records are not_comparable; earlier ones caution", () => {
  for (const r of records) {
    if (r.domain !== "trip" && r.domain !== "transit_detail") continue;
    if (r.surveyYear === 2022) {
      assert.equal(r.comparability, "not_comparable", `2022 trip record flagged comparable: ${r.metric}`);
    } else {
      assert.equal(r.comparability, "caution");
    }
  }
});

test("demographics are strong-comparability", () => {
  for (const r of records) {
    if (r.domain === "household" && r.metric !== "income") {
      assert.equal(r.comparability, "strong");
    }
    if (r.domain === "person") {
      assert.equal(r.comparability, "strong");
    }
  }
});

test("every record carries provenance", () => {
  for (const r of records) {
    assert.match(r.sourceId, /^tts-\d{4}-durham-(pd|ward)$/, `bad sourceId ${r.sourceId}`);
    assert.ok(typeof r.sourceLabel === "string" && r.sourceLabel.length > 0);
  }
});

test("region records are unique per metric key (ward-file duplication removed)", () => {
  const seen = new Set<string>();
  for (const r of records) {
    if (r.geographyId !== "durham") continue;
    const key = [r.surveyYear, r.domain, r.metric, r.category ?? "", r.direction ?? "", r.period ?? ""].join("|");
    assert.ok(!seen.has(key), `duplicate region record ${key}`);
    seen.add(key);
  }
});

test("geography registry: region, 8 municipalities, wards with parents", () => {
  const types = new Map(data.geographies.map((g) => [g.id, g]));
  assert.equal(types.get("durham")?.type, "region");
  let municipalities = 0;
  for (const id of ["brock", "uxbridge", "scugog", "pickering", "ajax", "whitby", "oshawa", "clarington"]) {
    assert.equal(types.get(id)?.type, "municipality", `${id} should be a municipality`);
    municipalities++;
  }
  assert.equal(municipalities, 8);
  for (const g of data.geographies) {
    if (g.type === "ward") {
      assert.ok(types.has(g.id.replace(/-ward-\d+$/, "")), `ward ${g.id} has no parent`);
      assert.ok(Math.min(...g.surveyYears) >= 2001, `ward ${g.id} years look wrong: ${g.surveyYears}`);
    }
  }
});
