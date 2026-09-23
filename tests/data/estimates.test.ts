/**
 * Status-aware estimate arithmetic (scripts/lib/estimates.ts) and the
 * work-at-home divergence predicates (lib/wah-story.ts).
 *
 * Synthetic fixtures only — no private-extract data. Covers the adversarial
 * missingness cases from docs/tts-audit-2026-09.md A01/A04: all-suppressed
 * aggregates, absent categories, unknown denominators, valid zero, zero
 * baselines, and mixed states.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sumEstimates,
  ratioEstimate,
  diffPp,
  pctChange,
  observed,
  type Estimate,
} from "../../scripts/lib/estimates.ts";
import {
  wahChanges,
  directionOf,
  directionCounts,
  multiple,
  regionSummary,
} from "../../lib/wah-story.ts";
import type { MunicipalityProfile } from "../../lib/types.ts";

const sup = (): Estimate => ({ value: null, status: "suppressed" });
const na = (): Estimate => ({ value: null, status: "not_available" });

// ---------------------------------------------------------------- sums ---

test("sum: all observed → observed total", () => {
  assert.deepEqual(sumEstimates([observed(10), observed(15)]), { value: 25, status: "observed" });
});

test("sum: an entirely suppressed category set never becomes numeric zero", () => {
  const s = sumEstimates([sup(), sup(), sup()]);
  assert.equal(s.value, null, "no numeric value from zero observed cells");
  assert.equal(s.status, "suppressed");
});

test("sum: mixed suppressed/observed is an observed subtotal (lower bound), not exact", () => {
  const s = sumEstimates([observed(100), sup()]);
  assert.deepEqual(s, { value: 100, status: "partial" });
});

test("sum: absent cells are structurally excluded, not partial", () => {
  // A cycle without rideshare: summing the remaining categories is complete.
  assert.deepEqual(sumEstimates([observed(3), null, observed(4)]), { value: 7, status: "observed" });
});

test("sum: all-absent cells are missing (no silent zero)", () => {
  assert.deepEqual(sumEstimates([null, null]), { value: null, status: "missing" });
});

test("sum: suppressed outranks not_available when nothing observed", () => {
  assert.equal(sumEstimates([na(), sup()]).status, "suppressed");
  assert.equal(sumEstimates([na(), na()]).status, "not_available");
});

test("sum: valid zero is preserved as observed", () => {
  assert.deepEqual(sumEstimates([observed(0), observed(0)]), { value: 0, status: "observed" });
});

// --------------------------------------------------------------- ratios ---

test("ratio: complete numerator and denominator → observed share", () => {
  assert.deepEqual(ratioEstimate(observed(25), observed(200)), { value: 0.125, status: "observed" });
});

test("ratio: suppressed numerator → suppressed, never zero", () => {
  assert.deepEqual(ratioEstimate(sup(), observed(200)), { value: null, status: "suppressed" });
});

test("ratio: partial numerator over complete denominator → lower-bound share", () => {
  const r = ratioEstimate({ value: 90, status: "partial" }, observed(200));
  assert.deepEqual(r, { value: 0.45, status: "partial" });
});

test("ratio: incomplete denominator is not an ordinary denominator — share withheld", () => {
  const r = ratioEstimate(observed(50), { value: 180, status: "partial" });
  assert.equal(r.value, null, "no numeric share from a partial denominator");
  assert.equal(r.status, "partial");
});

test("ratio: unknown/missing denominator → no share, state carried", () => {
  assert.deepEqual(ratioEstimate(observed(50), sup()), { value: null, status: "suppressed" });
  assert.deepEqual(ratioEstimate(observed(50), { value: null, status: "missing" }), { value: null, status: "missing" });
});

test("ratio: zero denominator → missing, never Infinity or NaN", () => {
  assert.deepEqual(ratioEstimate(observed(5), observed(0)), { value: null, status: "missing" });
});

// ------------------------------------------------------------ changes ---

test("diffPp: percentage points for shares, both endpoints required", () => {
  assert.deepEqual(diffPp(observed(0.178), observed(0.054)), { value: 0.124, status: "observed" });
  assert.equal(diffPp({ value: null, status: "suppressed" }, observed(0.05)).value, null);
  // A partial endpoint makes the difference partial.
  assert.equal(diffPp({ value: 0.2, status: "partial" }, observed(0.05)).status, "partial");
});

test("pctChange: requires a nonzero BASELINE (previous), not a nonzero current", () => {
  // Old bug: checking the current value allowed 0 → x to compute as +∞%.
  assert.equal(pctChange(observed(5), observed(0)).value, null, "zero baseline rejected");
  // Valid baseline → finite relative change.
  assert.deepEqual(pctChange(observed(150), observed(100)), { value: 0.5, status: "observed" });
  // Baseline fine but current missing → no change.
  assert.equal(pctChange(sup(), observed(100)).value, null);
});

test("observed rejects negative or non-finite values", () => {
  assert.throws(() => observed(-1));
  assert.throws(() => observed(Number.NaN));
  assert.throws(() => observed(Infinity));
});

// ----------------------------------------------- work-at-home predicates ---
// Fixture mirrors the audit's verified 2016/2022 endpoints (A01). The
// generated site data is additionally checked against these same numbers in
// the artifact tests.

const mun = (id: string, name: string, y16: number, y22: number): MunicipalityProfile =>
  ({
    geographyId: id,
    geographyName: name,
    prior2016: { workAtHomeShare: { value: y16, status: "observed" } },
    workAtHomeShare: { value: y22, status: "observed" },
  }) as unknown as MunicipalityProfile;

const FIXTURE = [
  mun("ajax", "Ajax", 0.054, 0.178),
  mun("uxbridge", "Uxbridge", 0.139, 0.120),
  mun("scugog", "Scugog", 0.124, 0.116),
  mun("oshawa", "Oshawa", 0.064, 0.124),
  mun("pickering", "Pickering", 0.069, 0.138),
  mun("whitby", "Whitby", 0.080, 0.158),
  mun("clarington", "Clarington", 0.067, 0.111),
  mun("brock", "Brock", 0.124, 0.160),
];

test("work-at-home predicates: Ajax more than tripled; Uxbridge and Scugog declined", () => {
  const changes = wahChanges(FIXTURE);
  const byId = new Map(changes.map((c) => [c.id, c]));
  const ajax = byId.get("ajax")!;
  assert.equal(directionOf(ajax.pp), "increase");
  assert.ok(multiple(ajax)! >= 3, `Ajax multiple ${multiple(ajax)}`);
  assert.ok(Math.abs(ajax.pp! - 0.124) < 1e-9, `Ajax pp ${ajax.pp}`);

  for (const id of ["uxbridge", "scugog"] as const) {
    const c = byId.get(id)!;
    assert.equal(directionOf(c.pp), "decline", `${id} should decline`);
    assert.ok(c.pp! < 0);
  }
});

test("work-at-home predicates: 'everywhere doubled' is false and detected", () => {
  const counts = directionCounts(wahChanges(FIXTURE));
  assert.equal(counts.increase, 6);
  assert.equal(counts.decline, 2);
  // The universal-doubling claim fails: not every municipality increased.
  assert.ok(counts.decline > 0);
});

test("work-at-home predicates: endpoints are carried, not reconstructed", () => {
  const c = wahChanges(FIXTURE)[0]!; // Ajax
  assert.equal(c.y2016.value, 0.054);
  assert.equal(c.y2022.value, 0.178);
  assert.ok(Math.abs(c.pp! - (c.y2022.value! - c.y2016.value!)) < 1e-12);
});

test("region summary computes 'nearly doubled' from values, never asserts it universally", () => {
  const r = regionSummary({ value: 0.072, status: "observed" }, { value: 0.141, status: "observed" });
  assert.ok(r.multiple! >= 1.8 && r.multiple! < 3);
  assert.ok(Math.abs(r.pp! - 0.069) < 1e-9);
});

test("unavailable endpoints yield unknown direction, not a fabricated change", () => {
  const broken = mun("x", "X", 0.1, 0.2);
  broken.prior2016.workAtHomeShare = { value: null, status: "partial" };
  const c = wahChanges([broken])[0]!;
  assert.equal(c.pp, null);
  assert.equal(directionOf(c.pp), "unknown");
});
