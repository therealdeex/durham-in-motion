/**
 * Golden-value assertions over the generated insights artifact
 * (public/data/insights.json). Values were independently verified in the
 * 2026-09 audit; if one fails after a data refresh, the inputs changed —
 * investigate before shipping.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const data = JSON.parse(readFileSync(resolve(ROOT, "public/data/insights.json"), "utf8")) as {
  insights: Record<string, any>[];
  unavailable: unknown[];
};
const byId = new Map(data.insights.map((i) => [i.id, i]));

test("local-vs-cross reproduces the audit's three-way composition", () => {
  const i = byId.get("local-vs-cross")!;
  assert.equal(i.values.sameMunicipality.trips, 819_579);
  assert.equal(i.values.betweenMunicipalities.trips, 324_532);
  assert.equal(i.values.outsideInvolving.trips, 296_026);
  assert.equal(i.values.totalTrips, 1_440_137);
  for (const [v, expected] of [
    [i.values.sameMunicipality.share, 0.569],
    [i.values.betweenMunicipalities.share, 0.225],
    [i.values.outsideInvolving.share, 0.206],
  ] as const) {
    assert.ok(Math.abs(v - expected) < 0.0005, `${v} vs ${expected}`);
  }
});

test("intermunicipal concentration: top-3 share uses the intermunicipal denominator", () => {
  const i = byId.get("intermunicipal-concentration")!;
  assert.equal(i.values.topPairs[0].totalTwoWay + i.values.topPairs[1].totalTwoWay + i.values.topPairs[2].totalTwoWay, 175_079);
  assert.ok(Math.abs(i.values.top3Share - 0.539) < 0.0005);
  assert.equal(i.values.intermunicipalTotal, 324_532);
});

test("mode-by-destination: disjoint contexts; drive/walk contrast", () => {
  const i = byId.get("mode-by-destination")!;
  const ctx = new Map<string, any>(i.values.contexts.map((c: any) => [c.key as string, c]));
  const same = ctx.get("sameMunicipality")!.shares;
  const cross = ctx.get("otherDurham")!.shares;
  const tor = ctx.get("toToronto")!.shares;
  assert.ok(Math.abs(same.drive - 0.560) < 0.0005, `same drive ${same.drive}`);
  assert.ok(Math.abs(same.walk - 0.144) < 0.0005, `same walk ${same.walk}`);
  assert.ok(Math.abs(cross.drive - 0.761) < 0.0005, `cross drive ${cross.drive}`);
  assert.ok(Math.abs(cross.walk - 0.003) < 0.0005, `cross walk ${cross.walk}`);
  assert.ok(tor.transit > same.transit * 3, "Toronto transit share is several times the same-municipality share");
});

test("purpose composition keeps published definitions and the reconciliation residual", () => {
  const i = byId.get("purpose-composition")!;
  const cats = new Map<string, any>(i.values.categories.map((c: any) => [c.key as string, c]));
  assert.ok(Math.abs(cats.get("hbw").share - 0.240) < 0.0005, `hbw ${cats.get("hbw").share}`);
  assert.ok(Math.abs(cats.get("hbd").share - 0.470) < 0.0005, `hbd ${cats.get("hbd").share}`);
  assert.ok(Math.abs(cats.get("hbs").share - 0.148) < 0.0005, `hbs ${cats.get("hbs").share}`);
  assert.ok(Math.abs(cats.get("nhb").share - 0.142) < 0.0005, `nhb ${cats.get("nhb").share}`);
  // Published categories sum two trips above the total — documented, not forced.
  assert.equal(i.values.reconciliationResidualTrips, 2);
});

test("weekday commuting: Wednesday vs Friday; multiresponse kept separate from frequency", () => {
  const i = byId.get("weekday-commuting")!;
  assert.equal(i.values.busiestDay.day, "Wednesday");
  assert.equal(i.values.busiestDay.persons, 186_836);
  assert.equal(i.values.quietestDay.day, "Friday");
  assert.equal(i.values.quietestDay.persons, 157_391);
  assert.equal(i.values.busiestMinusQuietest, 29_445);
  assert.ok(Math.abs(i.values.relativeDifference - 0.187) < 0.0005);
  const f = i.values.frequency;
  assert.equal(f.oneToFourDays, 128_168);
  assert.equal(f.knownZeroToFive, 263_835);
  assert.ok(Math.abs(f.oneToFourShare - 0.486) < 0.0005);
  assert.equal(f.exclusivelyHomeOrUnemployed, 422_549);
  assert.equal(f.unknown, 5_508);
});

test("work-at-home divergence: endpoints and directions match the audit", () => {
  const i = byId.get("work-at-home-divergence")!;
  const munis = new Map<string, any>(i.values.municipalities.map((m: any) => [m.id as string, m]));
  assert.ok(Math.abs(munis.get("ajax").share2016 - 0.054) < 0.0005);
  assert.ok(Math.abs(munis.get("ajax").share2022 - 0.178) < 0.0005);
  assert.ok(munis.get("uxbridge").pp! < 0, "Uxbridge declined");
  assert.ok(munis.get("scugog").pp! < 0, "Scugog declined");
  assert.ok(munis.get("ajax").pp! > 0.12, "Ajax gained more than 12 pp");
  const declined = [...i.values.municipalities].filter((m: any) => m.pp !== null && m.pp < 0);
  assert.equal(declined.length, 2);
});

test("comparable municipal transit: computable municipalities fell; region 6.4% → 3.9%", () => {
  const i = byId.get("comparable-transit-municipal")!;
  for (const m of i.values.municipalities) {
    if (m.pp !== null) {
      assert.ok(m.pp < 0, `${m.id} comparable transit share should fall (${m.pp})`);
      assert.ok(m.share2016 > m.share2022Comparable);
    } else {
      // Brock: 2016 GO-rail/joint cells suppressed → explicitly not computable.
      assert.equal(m.status2016, "not computable from 2016 published cells (suppressed transit component)");
      assert.equal(m.id, "brock");
    }
  }
  const computable = i.values.municipalities.filter((m: any) => m.pp !== null);
  assert.equal(computable.length, 7);
  const r = i.values.region;
  assert.ok(Math.abs(r.share2016 - 0.064) < 0.0005, `region 2016 ${r.share2016}`);
  assert.ok(Math.abs(r.share2022Comparable - 0.039) < 0.0005, `region 2022c ${r.share2022Comparable}`);
  assert.ok(Math.abs(r.tripsChange - 0.015) < 0.0005, `comparable trips change ${r.tripsChange}`);
  assert.equal(typeof r.transit2022Comparable, "number");
});

test("demographic context: 65+ 13.3→15.5%, households +8.4%, vehicles 1.83→1.81", () => {
  const i = byId.get("demographic-context")!;
  const v = i.values;
  assert.ok(Math.abs(v.seniorsShare2016 - 0.133) < 0.0005);
  assert.ok(Math.abs(v.seniorsShare2022 - 0.155) < 0.0005);
  assert.ok(Math.abs(v.householdsChange - 0.084) < 0.0005);
  assert.ok(Math.abs(v.vehiclesPerHousehold2016 - 1.83) < 0.005, `veh 2016 ${v.vehiclesPerHousehold2016}`);
  assert.ok(Math.abs(v.vehiclesPerHousehold2022 - 1.81) < 0.005, `veh 2022 ${v.vehiclesPerHousehold2022}`);
});

test("every insight names universe, denominator, basis, caveats and sources", () => {
  for (const i of data.insights) {
    assert.ok(typeof i.universe === "string" && i.universe.length > 10, `${i.id} universe`);
    assert.ok(typeof i.denominatorNote === "string" && i.denominatorNote.length > 10, `${i.id} denominator`);
    assert.ok(typeof i.basis === "string" && i.basis.length > 5, `${i.id} basis`);
    assert.ok(Array.isArray(i.caveats) && i.caveats.length > 0, `${i.id} caveats`);
    assert.ok(Array.isArray(i.sourceIds) && i.sourceIds.length > 0, `${i.id} sources`);
  }
  // Unavailable analyses are documented, not silently missing.
  assert.ok(data.unavailable.length >= 3);
});

test("no insight asserts statistical significance or constructed intervals", () => {
  const blob = JSON.stringify(data);
  // Disclaimers ("no statistical significance is claimed") are fine; asserted
  // claims and fabricated intervals are not.
  assert.ok(!/statistically significant|significant(ly)? (increase|decrease|difference|higher|lower|more|less)|95% confidence|p-value|margin of error/i.test(blob));
});
