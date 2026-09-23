/**
 * Regression test for the "licensed drivers for every ten residents" note
 * (app/page.tsx ← lib/metrics.ts). The original inline formula —
 * Math.round((drivers/persons) * 10) / 10 — computed the per-resident rate
 * but labelled it "per ten residents", publishing 0.7 instead of 7.2 for
 * 2022 Durham. These tests pin the correct arithmetic against the live
 * 2022 figures and the null paths.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { driversPerTenResidents, licenceRateNote } from "../../lib/metrics.ts";

test("2022 Durham: 499,064 drivers / 691,893 residents → 7.2 per ten residents", () => {
  assert.equal(driversPerTenResidents(499_064, 691_893), 7.2);
});

test("the published note states the per-ten rate, never the per-resident rate", () => {
  const note = licenceRateNote({ drivers: 499_064, persons: 691_893 });
  assert.equal(note, "That is 7.2 licensed drivers for every ten residents — children included.");
  assert.ok(!note.includes("0.7 "), "regression: per-resident rate must not be labelled per ten");
});

test("rounds to one decimal on the per-ten scale", () => {
  assert.equal(driversPerTenResidents(1, 3), 3.3); // 3.333… drivers per ten
  assert.equal(driversPerTenResidents(5, 10), 5);
  assert.equal(driversPerTenResidents(72_189, 100_000), 7.2);
});

test("null inputs yield an empty note, matching the fact-card contract", () => {
  assert.equal(licenceRateNote({ drivers: null, persons: 691_893 }), "");
  assert.equal(licenceRateNote({ drivers: 499_064, persons: null }), "");
  assert.equal(licenceRateNote({ drivers: null, persons: null }), "");
});
