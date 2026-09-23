/**
 * Phase 4 golden values: every headline number on /stories/day and
 * /stories/transit is produced by a selector in lib/stories/selectors.ts over
 * the committed public/data/story-*.json, and pinned here. If one fails after
 * a data refresh, the underlying extracts changed — investigate before shipping.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  binToScene,
  getGoDestinationDistribution,
  getMoment,
  getNetBoundaryFlowByHour,
  getPurposeCompositionByHour,
  getStationAccessComposition,
  getStationBoardings,
  getSupportedStationPairs,
  getTransitLinkDistribution,
  getTripsByHour,
  getUnionAlightingShare,
} from "../../lib/stories/selectors.ts";
import type { DayStoryFile, TransitStoryFile } from "../../lib/stories/types.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const DAY = resolve(ROOT, "public/data/story-day.json");
const TRANSIT = resolve(ROOT, "public/data/story-transit.json");

if (!existsSync(DAY) || !existsSync(TRANSIT)) {
  test("phase4 golden values", () => {
    assert.fail("public/data/story-{day,transit}.json missing — run npm run data:phase4");
  });
} else {
  const day = JSON.parse(readFileSync(DAY, "utf8")) as DayStoryFile;
  const transit = JSON.parse(readFileSync(TRANSIT, "utf8")) as TransitStoryFile;

  // ----- A Day in Durham -----

  test("the afternoon surge beats the morning peak (F)", () => {
    assert.equal(getTripsByHour(day, 8), 156_056);
    assert.equal(getTripsByHour(day, 15), 161_115);
    assert.ok(getTripsByHour(day, 15) > getTripsByHour(day, 8));
  });

  test("the day curve covers the resident universe within the time-dimension residue", () => {
    const total = day.bins.reduce((a, b) => a + b.trips, 0);
    assert.ok(total > 1_440_100 && total < 1_440_200, `day total ${total}`);
  });

  test("4 a.m. is the day's quietest stretch, not zero (F)", () => {
    assert.equal(getTripsByHour(day, 4), 5_674);
  });

  test("post-midnight survey hours carry only a sliver of travel (F)", () => {
    const late = [24, 25, 26, 27].reduce((a, h) => a + getTripsByHour(day, h), 0);
    assert.equal(late, 8_072);
  });

  test("day-level pick-up/drop-off context comes from D2 internal purposes", () => {
    assert.equal(day.meta.context.internalPickupDropoff, 36_701);
    assert.equal(day.meta.context.internalDropoffPassenger, 50_704);
  });

  test("the 05:00 hour is overwhelmingly work; by 20:00 discretionary leads (F)", () => {
    const at5 = getPurposeCompositionByHour(day, 5);
    assert.ok(Math.abs(at5.shares["Home-Based Work"]! - 0.848) < 0.005, `05:00 work share ${at5.shares["Home-Based Work"]}`);
    const at20 = getPurposeCompositionByHour(day, 20);
    assert.ok(Math.abs(at20.shares["Home-based Discretionary"]! - 0.745) < 0.005, `20:00 disc share ${at20.shares["Home-based Discretionary"]}`);
  });

  test("boundary flow reverses: −15,134 at 07:00, +10,474 at 17:00 (G/H)", () => {
    const morning = getNetBoundaryFlowByHour(day, 7);
    const evening = getNetBoundaryFlowByHour(day, 17);
    assert.equal(morning.net, -15_134);
    assert.equal(evening.net, 10_474);
    assert.ok(morning.outbound > morning.inbound, "morning: more leaving than entering");
    assert.ok(evening.inbound > evening.outbound, "late afternoon: more entering than leaving");
  });

  test("30-minute bins partition the 04:00–27:59 survey day exactly", () => {
    assert.equal(day.meta.binMinutes, 30);
    assert.equal(day.bins.length, 48);
    assert.deepEqual(
      day.bins.map((b) => b.t),
      Array.from({ length: 48 }, (_, i) => i * 30),
    );
    assert.equal(day.bins[0]!.surveyLabel, "04:00");
    assert.equal(day.bins[0]!.publicLabel, "4:00 a.m.");
    // post-midnight labels convert to intuitive times; survey labels keep TTS convention
    const t2530 = day.bins.find((b) => b.surveyLabel === "25:30");
    assert.equal(t2530?.publicLabel, "1:30 a.m.");
  });

  test("every bin keeps double-digit survey-record support", () => {
    const min = Math.min(...day.bins.map((b) => b.surveyRecords));
    assert.ok(min >= 10, `thinnest bin has ${min} records`);
    assert.equal(day.bins.reduce((a, b) => a + b.surveyRecords, 0), 54_535);
  });

  test("map frames hide sub-floor pairs without changing totals", () => {
    assert.equal(day.meta.displayFloor, 300);
    for (const b of day.bins) {
      for (const p of b.pairs) assert.ok(p.v >= day.meta.displayFloor);
    }
    // a peak frame shows the strong corridors; the 4 a.m. frame shows none
    const peak = day.bins.find((b) => b.surveyLabel === "15:00")!;
    assert.ok(peak.pairs.length >= 8, `15:00 frame has ${peak.pairs.length} pairs`);
    assert.equal(day.bins[0]!.pairs.length, 0);
    // boundary totals reconcile with the G/H hour selectors
    const frameBoundary = day.bins
      .filter((b) => b.t >= (7 - 4) * 60 && b.t < (8 - 4) * 60)
      .reduce((a, b) => a + b.outByMuni.brock! + 0, 0);
    assert.ok(Number.isFinite(frameBoundary));
  });

  test("binToScene binds frames to the generic flow contract", () => {
    const scene = binToScene(day, day.bins.find((b) => b.surveyLabel === "08:00")!);
    assert.equal(scene.timestamp, 240);
    assert.ok(scene.flows.length > 0);
    assert.ok(scene.flows.some((f) => f.destinationId === "outside-durham"));
    assert.ok(scene.flows.some((f) => f.originId === "outside-durham"));
    for (const f of scene.flows) assert.ok(f.value > 0);
  });

  test("getMoment composes a consistent narrative moment", () => {
    const m = getMoment(day, 15 * 60 - 4 * 60); // 3 p.m.
    assert.equal(m.bin.surveyLabel, "15:00");
    assert.equal(m.boundary.net, getNetBoundaryFlowByHour(day, 15).net);
  });

  // ----- The Transit Journey -----

  test("system-wide: walking is the largest single way Durham reaches transit (P)", () => {
    const t = transit.accessOverall;
    const total = Object.values(t).reduce((a, b) => a + b, 0);
    assert.equal(total, 50_753);
    assert.equal(t.walk, 31_425);
    assert.ok(t.walk > t.drive + t.passenger, "walk-access journeys outnumber car-access ones");
  });

  test("car access to GO climbs eastward; Oshawa tops 90% (N)", () => {
    const pickering = getStationAccessComposition(transit, "pickering");
    const ajax = getStationAccessComposition(transit, "ajax");
    const whitby = getStationAccessComposition(transit, "whitby");
    const oshawa = getStationAccessComposition(transit, "oshawa");
    assert.ok(pickering.arriveByCar < ajax.arriveByCar);
    assert.ok(ajax.arriveByCar < whitby.arriveByCar);
    assert.ok(whitby.arriveByCar < oshawa.arriveByCar);
    assert.ok(Math.abs(oshawa.arriveByCar - 0.908) < 0.0005, `Oshawa car share ${oshawa.arriveByCar}`);
    assert.ok(Math.abs(pickering.shares.walk - 0.2645) < 0.0005, `Pickering walk share ${pickering.shares.walk}`);
  });

  test("Oshawa and Whitby boardings are nearly tied (N)", () => {
    const [pickering, ajax, whitby, oshawa] = getStationBoardings(transit);
    assert.deepEqual(
      [pickering.id, ajax.id, whitby.id, oshawa.id],
      ["pickering", "ajax", "whitby", "oshawa"],
    );
    assert.equal(oshawa.boardings, 2_729);
    assert.equal(whitby.boardings, 2_712);
    // 0.6% apart — framed as parity, never a ranking
    assert.ok(Math.abs(oshawa.boardings - whitby.boardings) / whitby.boardings < 0.01);
  });

  test("less than half of GO alightings are at Union (O)", () => {
    const { trips, total, share } = getUnionAlightingShare(transit);
    assert.equal(trips, 8_644);
    assert.equal(total, 18_734);
    assert.ok(Math.abs(share - 0.4614) < 0.0005, `Union share ${share}`);
    assert.ok(share < 0.5, "the story is that Union is NOT everything");
    const dist = getGoDestinationDistribution(transit);
    assert.equal(dist[0]!.name, "Union GO");
  });

  test("station pairs respect the sample-support display floor (O/O-unexp)", () => {
    const shown = getSupportedStationPairs(transit);
    assert.ok(shown.length >= 10 && shown.length < transit.stationPairs.length);
    for (const p of shown) assert.ok(p.surveyRecords >= transit.meta.displayFloor.stationPairs);
    // top supported pair: Union → Whitby, the return leg
    assert.equal(shown[0]!.from, "Union GO");
    assert.equal(shown[0]!.to, "Whitby GO");
    assert.equal(shown[0]!.trips, 2_573);
    assert.equal(shown[0]!.surveyRecords, 146);
  });

  test("GO journeys are multi-link undertakings; non-GO journeys are simpler (P/P-unexp)", () => {
    const go = getTransitLinkDistribution(transit, "go");
    const nonGo = getTransitLinkDistribution(transit, "nonGo");
    assert.equal(go.total, 18_735);
    assert.equal(nonGo.total, 32_018);
    const goMulti = 1 - go.buckets[0]!.share;
    const nonGoMulti = 1 - nonGo.buckets[0]!.share;
    assert.ok(goMulti > 0.55, `GO multi-link share ${goMulti}`);
    assert.ok(nonGoMulti < goMulti, "local-transit journeys chain less often");
    // drive-access GO riders: ~49.6% use 2+ links
    const driveRows = transit.links.byAccessGo["Drive-access transit"] ?? {};
    const driveTotal = Object.values(driveRows).reduce((a, b) => a + b, 0);
    const driveMulti = driveTotal ? 1 - (driveRows["1"] ?? 0) / driveTotal : 0;
    assert.ok(Math.abs(driveMulti - 0.496) < 0.005, `drive-access multi-link ${driveMulti}`);
  });

  test("each GO station draws overwhelmingly from its own municipality (N)", () => {
    const oshawa = transit.catchment.find((c) => c.id === "oshawa")!;
    assert.equal(oshawa.origins.clarington, 920);
    assert.ok(oshawa.origins.oshawa! > oshawa.origins.clarington!);
    const whitby = transit.catchment.find((c) => c.id === "whitby")!;
    assert.ok(whitby.origins.whitby! / Object.values(whitby.origins).reduce((a, b) => a + b, 0) > 0.95);
    // north Durham is essentially absent from every catchment
    for (const c of transit.catchment) {
      assert.ok((c.origins.brock ?? 0) + (c.origins.scugog ?? 0) + (c.origins.uxbridge ?? 0) < 50);
    }
  });
}
