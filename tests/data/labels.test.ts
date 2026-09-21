import { test } from "node:test";
import assert from "node:assert/strict";
import { isNoteRow, resolveLabel } from "../../scripts/lib/labels.ts";

test("note rows are recognized across file styles", () => {
  assert.equal(isNoteRow("2022 TTS.  All Trip totals are based on trips taken by persons 5 years old and older"), true);
  assert.equal(isNoteRow("No information is presented for categories that have less than 4 observations"), true);
  assert.equal(isNoteRow("Updated Mar 13 2019 : Number of transit trips made to the area with GO Bus"), true);
  assert.equal(isNoteRow("CATEGORY"), true);
  assert.equal(isNoteRow("Number of trips by residents by walk mode in 24-hours"), false);
});

test("trip labels resolve identically across wording eras", () => {
  const old = resolveLabel("Number of trips made to the area as auto driver in 24-hour");
  const new_ = resolveLabel("Number of trips to the area as auto driver in 24-hours");
  assert.deepEqual(old, { domain: "trip", metric: "auto_driver", direction: "to_area", period: "all_day" });
  assert.deepEqual(new_, { domain: "trip", metric: "auto_driver", direction: "to_area", period: "all_day" });
});

test("peak periods come from keywords, not clock text", () => {
  // 2022 AM labels contain the typo "8:59 pm" — still morning.
  const am = resolveLabel("Total number of trips made by residents during the morning peak period (6:00am to 8:59 pm)");
  assert.equal(am?.period, "am_peak");
  const pm2016 = resolveLabel("Number of trips by residents by paid rideshare mode during afternoon peak period (15:00 p.m. to 17:59 p.m.)");
  assert.equal(pm2016?.period, "pm_peak");
  assert.equal(pm2016?.metric, "rideshare");
});

test("2022 transit service typo resolves to TTC subway", () => {
  const a = resolveLabel("Number of Transit trips made to area usingTTCSubway/RT");
  const b = resolveLabel("Number of transit trips made by residents using TTS Subway/RT");
  assert.equal(a?.domain, "transit_detail");
  assert.equal(a?.category, "ttc_subway");
  assert.equal(b?.category, "ttc_subway");
});

test("older transit service labels use 'with'", () => {
  const x = resolveLabel("Number of transit trips made by residents with non-TTC local transit");
  assert.equal(x?.category, "local_transit");
  const routes = resolveLabel("Number of transit trips made to the area with 3 transit routes");
  assert.deepEqual(routes, { domain: "transit_detail", metric: "routes", category: "3", direction: "to_area" });
});

test("2022 access-mode labels (no 'made') resolve", () => {
  const x = resolveLabel("Number of transit trips by residents accessed by walk mode");
  assert.deepEqual(x, { domain: "transit_detail", metric: "access_mode", category: "walk", direction: "residents" });
});

test("DMG typos resolve", () => {
  assert.equal(resolveLabel("No of Persons who commuted to work 5 day last week")?.category, "5");
  assert.equal(resolveLabel("Number of shoppingtrips made to the area in 24hrs")?.category, "shopping");
  assert.equal(resolveLabel("Number of trips made fromthe area by walk mode in 24-hour")?.metric, "walk");
  assert.equal(resolveLabel("Number of persons with work in other occcupations")?.category, "other");
  assert.equal(resolveLabel("Number of persons who has no usual place")?.category, "no_usual_place");
  assert.equal(resolveLabel("Number of households with 0 student")?.category, "0");
});

test("linked trips and purposes resolve with direction", () => {
  const linked = resolveLabel("Number of linked trips made from the area in 24-hour");
  assert.deepEqual(linked, { domain: "trip", metric: "linked", direction: "from_area", period: "all_day" });
  const p = resolveLabel("Number of home-based work trips by residents in 24-hours");
  assert.equal(p?.category, "hbw");
  const ent = resolveLabel("Number of Entertainment trips made to the area in 24-hour");
  assert.equal(ent?.category, "shopping_entertainment_1986");
});

test("income bands normalize", () => {
  assert.equal(resolveLabel("Number of Households with income $100000 and $124999")?.category, "100000-124999");
  assert.equal(resolveLabel("Number of Households with income $15000 to $39999")?.category, "15000-39999");
  assert.equal(resolveLabel("Number of Households with income $125000 and above")?.category, "125000-above");
  assert.equal(resolveLabel("Number of Households with income Declined / don't know")?.category, "declined");
});
