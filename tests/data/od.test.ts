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
  getRegionTravelProfile,
  getLocalComposition,
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
    assert.ok(p.destinations.length > 0);
    // Mode group shares sum to ~1 and never negative.
    const modeSum = MODE_GROUP_ORDER.reduce((s, g) => s + p.modeGroupShares[g]!, 0);
    assert.ok(Math.abs(modeSum - 1) < 1e-9, `${id} mode shares sum to ${modeSum}`);
  }
});

test("A02: Toronto destinations are aggregated before ranking — Pickering has one Toronto entry with 20,682 trips", () => {
  const p = getMunicipalityOriginProfile(ds, "pickering");
  const torontoEntries = p.destinations.filter((d) => d.destinationId === "toronto");
  assert.equal(torontoEntries.length, 1, "exactly one aggregated Toronto destination");
  assert.equal(torontoEntries[0]!.trips, 20_682);
  // 12.15% before presentation rounding (site shows 12.2%).
  assert.ok(Math.abs(torontoEntries[0]!.trips / p.originTrips - 0.1215) < 0.0005);
  // Toronto's rank in the sorted distribution must reflect the aggregate,
  // not a single planning district (the old bug showed 3,973 trips / 2%).
  const torontoTrips = torontoEntries[0]!.trips;
  assert.ok(torontoTrips > 20_000, `aggregate, not one PD (${torontoTrips})`);
  assert.equal(Math.round(torontoTrips), 20_682);
});

test("A02: destination ids are unique across every municipality's full distribution", () => {
  for (const id of MUNI_IDS) {
    const p = getMunicipalityOriginProfile(ds, id);
    const ids = p.destinations.map((d) => d.destinationId);
    assert.equal(new Set(ids).size, ids.length, `${id} has duplicate destination ids`);
    // The four group sums reconcile to the origin total.
    const g = (grp: string) => p.destinations.filter((d) => d.group === grp).reduce((s, d) => s + d.trips, 0);
    assert.equal(g("same") + g("durham") + g("toronto") + g("outside"), p.originTrips);
  }
});

test("A03: local composition — the three-way partition of all Durham-household trips", () => {
  const c = getLocalComposition(ds);
  assert.equal(c.sameMunicipality, 819_579);
  assert.equal(c.betweenDurhamMunicipalities, 324_532);
  assert.equal(c.outsideInvolving, 296_026);
  assert.equal(c.totalTrips, 1_440_137);
  // Shares: 56.9% / 22.5% / 20.6% (audit-verified values).
  for (const [v, expected] of [
    [c.sameMunicipality / c.totalTrips, 0.569],
    [c.betweenDurhamMunicipalities / c.totalTrips, 0.225],
    [c.outsideInvolving / c.totalTrips, 0.206],
  ] as const) {
    assert.ok(Math.abs(v - expected) < 0.0005, `${v} vs ${expected}`);
  }
  // internal = same + cross.
  assert.equal(c.sameMunicipality + c.betweenDurhamMunicipalities, getInternalTrips(ds));
});

test("A03: region orbit is origin-scoped; Toronto exceeds all other outside destinations combined", () => {
  const r = getRegionTravelProfile(ds);
  const elsewhereOutside = r.elsewhereSurveyArea + r.beyondSurveyArea;
  assert.equal(r.toronto, 77_303);
  assert.equal(elsewhereOutside, 56_903);
  assert.ok(r.toronto > elsewhereOutside, "the previously reversed claim must now point the right way");
  // Shares of Durham-origin trips: 6.05% vs 4.45%.
  assert.ok(Math.abs(r.toronto / r.durhamOriginTrips - 0.0605) < 0.0005);
  assert.ok(Math.abs(elsewhereOutside / r.durhamOriginTrips - 0.0445) < 0.0005);
  assert.equal(
    r.sameMunicipality + r.elsewhereInDurham + r.toronto + r.elsewhereSurveyArea + r.beyondSurveyArea,
    r.durhamOriginTrips,
  );
});

test("mode composition matches validated contexts", () => {
  const internal = getModeComposition(ds, { origin: "durham", destination: "durham" });
  assert.equal(Math.round(internal.total), 1_144_108); // 3 mode-not-stated trips vs matrix
  assert.equal(Math.round(internal.trips.drive! / internal.total * 1000) / 1000, 0.617);
  const tor = getModeComposition(ds, { origin: "durham", destination: "toronto" });
  assert.equal(Math.round(tor.trips.transit! / tor.total * 1000) / 1000, 0.153);

  // The five disjoint contexts partition Durham-origin trips within the
  // 9-trip mode-not-stated residue; the combined context overlaps them and
  // must NOT be added to the same sum.
  const contexts = getModeContexts(ds);
  const byKey = new Map(contexts.map((c) => [c.key, c]));
  const disjoint = contexts.filter((c) => c.disjoint);
  assert.equal(disjoint.length, 5);
  const disjointSum = disjoint.reduce((s, c) => s + c.trips, 0);
  const matrixDurhamOrigin = MUNI_IDS.reduce((s, id) => s + getMunicipalityOriginProfile(ds, id).originTrips, 0);
  assert.ok(Math.abs(disjointSum - matrixDurhamOrigin) <= 9);
  // Combined context equals same + otherDurham.
  assert.equal(byKey.get("allInternalDurham")!.trips, byKey.get("sameMunicipality")!.trips + byKey.get("otherDurham")!.trips);
  // "outside" excludes external; the two are separate contexts.
  const elsewhere = byKey.get("elsewhereSurveyArea")!;
  const beyond = byKey.get("beyondSurveyArea")!;
  assert.ok(elsewhere.trips > 0 && beyond.trips > 0);
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
