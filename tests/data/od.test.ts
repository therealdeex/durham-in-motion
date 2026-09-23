/**
 * Golden values and invariants for the iDRS OD pipeline (scripts/lib/od.ts).
 * Headline numbers were validated against docs/idrs-data.md and the handoff
 * analysis; if one of these fails after a data refresh, the survey extracts
 * changed — investigate before shipping.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadOdDataset,
  getTotalTrips,
  getInternalTrips,
  getInternalShare,
  getDurhamToTorontoTrips,
  getTorontoToDurhamTrips,
  getMunicipalityPairFlows,
  getMunicipalityOriginProfile,
  getModeComposition,
  getComparable2022,
  getFull2022Modes,
  getModeContexts,
  MUNI_IDS,
  MODE_GROUP_ORDER,
} from "../../scripts/lib/od.ts";

const ds = loadOdDataset();

test("OD grand total matches the validated extract", () => {
  assert.equal(getTotalTrips(ds), 1_440_137);
  // Matrix is row/column consistent: grand total equals row sums and column sums.
  const rowSum = ds.matrix.values.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0);
  let colSum = 0;
  for (let j = 0; j < ds.matrix.colNames.length; j++) {
    for (let i = 0; i < ds.matrix.rowNames.length; i++) colSum += ds.matrix.values[i]![j]!;
  }
  assert.equal(rowSum, ds.matrix.total);
  assert.equal(colSum, ds.matrix.total);
});

test("internal share is 79.44% (1,144,111 of 1,440,137)", () => {
  assert.equal(getInternalTrips(ds), 1_144_111);
  assert.equal(Math.round(getInternalShare(ds) * 10000) / 10000, 0.7944);
});

test("Toronto flows match validated values", () => {
  assert.equal(getDurhamToTorontoTrips(ds), 77_303);
  assert.equal(getTorontoToDurhamTrips(ds), 76_336);
});

test("PD code map: Durham 17–24, Toronto 1–16, External 998", () => {
  assert.equal(ds.codeName.get(17), "Brock");
  assert.equal(ds.codeName.get(24), "Clarington");
  assert.equal(ds.codeName.get(998), "External");
  for (let c = 1; c <= 16; c++) {
    assert.match(ds.codeName.get(c) ?? "", new RegExp(`^PD ${c} of Toronto$`));
  }
});

test("top municipal pairs match validated values", () => {
  const pairs = getMunicipalityPairFlows(ds).sort((a, b) => b.totalTwoWay - a.totalTwoWay);
  const top = pairs[0]!;
  assert.equal(new Set([top.a, top.b]).has("whitby"), true);
  assert.equal(new Set([top.a, top.b]).has("oshawa"), true);
  assert.equal(Math.round(top.totalTwoWay), 84_070);
  // Pair invariants: directional halves sum to the two-way total; every pair is positive.
  for (const p of pairs) {
    assert.equal(Math.round(p.aToB + p.bToA), Math.round(p.totalTwoWay));
    assert.ok(p.aToB >= 0 && p.bToA >= 0);
  }
  assert.equal(pairs.length, 28);
});

test("municipality profiles reconcile with the matrix", () => {
  for (const id of MUNI_IDS) {
    const p = getMunicipalityOriginProfile(ds, id);
    // Orbit shares sum to 1.
    const total = p.orbitShares.same + p.orbitShares.durham + p.orbitShares.toronto + p.orbitShares.outside;
    assert.ok(Math.abs(total - 1) < 1e-9, `${id} orbit shares sum to ${total}`);
    // Region internal trips = sum of same + elsewhere-in-Durham across municipalities.
    assert.ok(p.originTrips > 0);
    assert.ok(p.topDestinations.length > 0);
    // Mode group shares sum to ~1 and never negative.
    const modeSum = MODE_GROUP_ORDER.reduce((s, g) => s + p.modeGroupShares[g]!, 0);
    assert.ok(Math.abs(modeSum - 1) < 1e-9, `${id} mode shares sum to ${modeSum}`);
  }
});

test("mode composition matches validated contexts", () => {
  const internal = getModeComposition(ds, { origin: "durham", destination: "durham" });
  assert.equal(Math.round(internal.total), 1_144_108); // 3 mode-not-stated trips vs matrix
  assert.equal(Math.round(internal.trips.drive! / internal.total * 1000) / 1000, 0.617);
  const tor = getModeComposition(ds, { origin: "durham", destination: "toronto" });
  assert.equal(Math.round(tor.trips.transit! / tor.total * 1000) / 1000, 0.153);

  // Non-overlapping contexts (internal, toToronto, toOutside — "same" is inside
  // "internal") reproduce the matrix's Durham-origin total within the 9-trip
  // mode-not-stated residue.
  const contexts = getModeContexts(ds);
  const byKey = new Map(contexts.map((c) => [c.key, c]));
  const nonOverlapping = ["internalDurham", "toToronto", "toOutside"].reduce((s, k) => s + byKey.get(k)!.trips, 0);
  const matrixDurhamOrigin = MUNI_IDS.reduce((s, id) => s + getMunicipalityOriginProfile(ds, id).originTrips, 0);
  assert.ok(Math.abs(nonOverlapping - matrixDurhamOrigin) <= 9);
  // Contexts agree with getModeComposition on the shared context.
  assert.equal(Math.round(byKey.get("toToronto")!.trips), Math.round(tor.total));
});

test("comparable 2022 and full 2022 mode totals", () => {
  const cmp = getComparable2022(ds);
  assert.equal(Math.round(cmp.total), 1_298_366);
  assert.equal(Math.round(cmp.groups.transit!), 50_343);
  assert.equal(Math.round((cmp.groups.transit! / cmp.total) * 10000) / 10000, 0.0388);
  const walk = cmp.groups.walk!;
  assert.equal(Math.round(walk), 67_089);

  const full = getFull2022Modes(ds);
  assert.equal(Math.round(full.modes.Walk!), 120_195); // full-basis walking ≠ comparable walking
  assert.ok(full.total > cmp.total);
});
