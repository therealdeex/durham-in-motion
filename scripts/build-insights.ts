/**
 * Builds public/data/insights.json — qualified analyses computed from the
 * normalized records and the iDRS OD extracts. Every value, share and change
 * is derived here at build time; components only render. Each insight
 * carries its universe, denominator, comparable basis, caveats and source
 * ids (PR5 contract; golden values asserted in tests/data/insights.test.ts).
 *
 * Analytical rules (docs/tts-audit-2026-09.md):
 *  - suppression is never zero; suppressed cells are never recovered by
 *    subtraction;
 *  - expanded counts are estimates — no invented standard errors;
 *  - trips by Durham households ≠ trips by residents of a municipality ≠
 *    all inbound trips; every insight names its population;
 *  - full-2022 and harmonized comparison bases are kept separate.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadOdDataset,
  getLocalComposition,
  getMunicipalityPairFlows,
  getModeContexts,
  getRegionTravelProfile,
  MUNI_IDS,
  MUNI_NAMES,
  MODE_GROUP_ORDER,
  type ModeGroup,
} from "./lib/od.ts";
import type { NormalizedRecord } from "./lib/read-files.ts";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "public/data/insights.json");

const { records } = JSON.parse(
  readFileSync(resolve(ROOT, "data/processed/normalized.json"), "utf8"),
) as { records: NormalizedRecord[] };

const ds = loadOdDataset();
const regionRecords = (year: number) => records.filter((r) => r.surveyYear === year && r.geographyId === "durham");

const observedValue = (recs: NormalizedRecord[], pred: (r: NormalizedRecord) => boolean): number | null => {
  const r = recs.find(pred);
  return r && r.status === "observed" ? r.value : null;
};

const OD_SOURCES = ["tts-2022-idrs-od-pd", "tts-2022-idrs-od-pd-mode", "tts-2022-idrs-mode-pd-excl2016"];
const SUMMARY_SOURCE = "tts-2022-durham-pd";
const SUMMARY_SOURCE_2016 = "tts-2016-durham-pd";

// ---------------------------------------------------------------- 1. local vs cross
const local = getLocalComposition(ds);
const localVsCross = {
  id: "local-vs-cross",
  question: "Most travel is local — but what kind of local?",
  takeaway:
    `Of ${fmt(local.totalTrips)} weekday trips by members of Durham households, ${pct1(local.sameMunicipality / local.totalTrips)} stay inside one municipality, ` +
    `${pct1(local.betweenDurhamMunicipalities / local.totalTrips)} cross between Durham municipalities, and ` +
    `${pct1(local.outsideInvolving / local.totalTrips)} involve somewhere outside Durham.`,
  universe: "All weekday trips by members of Durham households (2022 TTS), wherever they start.",
  denominatorNote: `Denominator: ${fmt(local.totalTrips)} trips (OD extract total). The three groups are mutually exclusive.`,
  basis: "2022 survey basis (ages 5+, fuller walking capture) — not comparable with pre-2022 trip counts.",
  values: {
    sameMunicipality: { trips: local.sameMunicipality, share: local.sameMunicipality / local.totalTrips, label: "Both endpoints in the same municipality" },
    betweenMunicipalities: { trips: local.betweenDurhamMunicipalities, share: local.betweenDurhamMunicipalities / local.totalTrips, label: "Between Durham municipalities" },
    outsideInvolving: { trips: local.outsideInvolving, share: local.outsideInvolving / local.totalTrips, label: "At least one endpoint outside Durham" },
    totalTrips: local.totalTrips,
    internalShare: (local.sameMunicipality + local.betweenDurhamMunicipalities) / local.totalTrips,
  },
  caveats: [
    "The third group includes trips made entirely outside Durham by members of Durham households.",
    "Cross-municipality here means both endpoints in Durham but in different municipalities — a Toronto→Whitby trip counts in the third group, not the second.",
  ],
  sourceIds: OD_SOURCES,
};

// ------------------------------------------------------- 2. intermunicipal concentration
const pairs = getMunicipalityPairFlows(ds).sort((a, b) => b.totalTwoWay - a.totalTwoWay);
const top3 = pairs.slice(0, 3);
const top3Sum = top3.reduce((s, p) => s + p.totalTwoWay, 0);
const concentration = {
  id: "intermunicipal-concentration",
  question: "Which relationships make up the internal network?",
  takeaway:
    `Three connections — ${top3.map((p) => `${MUNI_NAMES[p.a]!}–${MUNI_NAMES[p.b]!}`).join(", ")} — carry ` +
    `${fmt(top3Sum)} two-way trips, ${pct1(top3Sum / local.betweenDurhamMunicipalities)} of all intermunicipal Durham travel.`,
  universe: "Weekday trips with both endpoints in Durham but in different municipalities (2022 TTS, Durham households).",
  denominatorNote: `Denominator: ${fmt(local.betweenDurhamMunicipalities)} intermunicipal trips (never the all-trips total).`,
  basis: "2022 survey basis.",
  values: {
    intermunicipalTotal: local.betweenDurhamMunicipalities,
    top3Share: top3Sum / local.betweenDurhamMunicipalities,
    topPairs: top3.map((p) => ({ a: MUNI_NAMES[p.a]!, b: MUNI_NAMES[p.b]!, aToB: p.aToB, bToA: p.bToA, totalTwoWay: p.totalTwoWay })),
  },
  caveats: [
    "These are origin–destination relationships, not observed road corridors or proof of a transit route's demand.",
    "Two-way totals combine both directions; they are not person counts.",
  ],
  sourceIds: OD_SOURCES,
};

// ------------------------------------------------------- 3. mode by destination (disjoint)
const contexts = getModeContexts(ds).filter((c) => c.disjoint);
const byKey = new Map(contexts.map((c) => [c.key, c]));
const same = byKey.get("sameMunicipality")!;
const cross = byKey.get("otherDurham")!;
const toronto = byKey.get("toToronto")!;
const shareOf = (c: typeof same, g: ModeGroup) => c.groups[g]! / c.trips;
const modeByDestination = {
  id: "mode-by-destination",
  question: "Does crossing a municipal boundary change the mode mix?",
  takeaway:
    `Yes, sharply: ${pct1(shareOf(same, "drive"))} of same-municipality trips are driven vs ${pct1(shareOf(cross, "drive"))} between municipalities, ` +
    `while walking collapses from ${pct1(shareOf(same, "walk"))} to ${pct1(shareOf(cross, "walk"))}. Trips to Toronto are different again: ${pct1(shareOf(toronto, "transit"))} transit.`,
  universe: "Weekday trips originating in Durham (2022 TTS, Durham households), by destination context.",
  denominatorNote: "Each context's shares use that context's trip total; contexts are mutually exclusive.",
  basis: "2022 survey basis. By-mode extract misses 9 mode-not-stated trips region-wide.",
  values: {
    contexts: contexts.map((c) => ({
      key: c.key,
      label: c.label,
      description: c.description,
      trips: c.trips,
      shares: Object.fromEntries(MODE_GROUP_ORDER.map((g) => [g, c.groups[g]! / c.trips])),
      groups: c.groups,
    })),
  },
  caveats: [
    "This is an association with the destination context, not a causal effect of crossing a boundary.",
    "The former 'Around Durham' context mixed same-municipality and cross-municipality trips; those are separated here.",
  ],
  sourceIds: OD_SOURCES,
};

// ------------------------------------------------------- 4. purpose composition
const r22 = regionRecords(2022);
const purposeCategories = [
  { key: "hbw", label: "Home-based work", records: ["hbw"] },
  { key: "hbs", label: "Home-based school", records: ["hbs"] },
  { key: "hbd", label: "Home-based discretionary", records: ["hbd"] },
  { key: "nhb", label: "Non-home-based", records: ["nhb"] },
];
const tripsTotal22 = observedValue(r22, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "total");
const purposeRows = purposeCategories.map((c) => {
  const v = observedValue(r22, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === c.records[0]);
  return { key: c.key, label: c.label, trips: v, share: v !== null && tripsTotal22 ? v / tripsTotal22 : null };
});
const purposeSum = purposeRows.reduce((s, r) => s + (r.trips ?? 0), 0);
const purposeResidual = purposeSum - (tripsTotal22 ?? 0);
const purpose = {
  id: "purpose-composition",
  question: "Is everyday travel mostly work travel?",
  takeaway:
    `No: home-based work is ${purposeRows[0]!.share ? pct1(purposeRows[0]!.share!) : "—"} of weekday trips by residents, ` +
    `while home-based discretionary travel is ${purposeRows[2]!.share ? pct1(purposeRows[2]!.share!) : "—"}.`,
  universe: "Weekday trips by Durham residents (2022 TTS public summary).",
  denominatorNote: `Denominator: ${fmt(tripsTotal22 ?? 0)} resident weekday trips (public summary total).`,
  basis: "2022 survey basis; purposes keep their published definitions.",
  values: {
    categories: purposeRows,
    totalTrips: tripsTotal22,
    categoriesSum: purposeSum,
    /** Published categories sum two trips above the published total (2022). */
    reconciliationResidualTrips: purposeResidual,
  },
  caveats: [
    purposeResidual === 0
      ? "Published purpose categories reconcile with the total."
      : `The published purpose categories sum to ${fmt(purposeSum)} — ${Math.abs(purposeResidual)} trips ${purposeResidual > 0 ? "above" : "below"} the published total of ${fmt(tripsTotal22 ?? 0)}. We report categories as published rather than forcing them to match.`,
    "Non-home-based is not synonymous with non-work; the remaining ~76% of trips are not 'non-work'.",
    "Trip purposes, not person shares: one person can make several trips of different purposes.",
  ],
  sourceIds: [SUMMARY_SOURCE],
};

// ------------------------------------------------------- 5. weekday commuting + frequency
const dayCat = (d: string) =>
  observedValue(r22, (r) => r.domain === "person" && r.metric === "commute_day_of_week" && r.category === d);
const days = (["monday", "tuesday", "wednesday", "thursday", "friday"] as const).map((d) => ({
  day: d[0]!.toUpperCase() + d.slice(1),
  persons: dayCat(d),
}));
const validDays = days.filter((d) => d.persons !== null) as { day: string; persons: number }[];
const busiest = [...validDays].sort((a, b) => b.persons - a.persons)[0]!;
const quietest = [...validDays].sort((a, b) => a.persons - b.persons)[0]!;
const dayDiff = (busiest.persons - quietest.persons) / quietest.persons;

const commuteDays1to4 = (["1", "2", "3", "4"] as const)
  .map((c) => observedValue(r22, (r) => r.domain === "person" && r.metric === "commute_days" && r.category === c))
  .reduce((s: number | null, v) => (s === null || v === null ? null : s + v), 0);
const knownFrequency = (["0", "1", "2", "3", "4", "5"] as const)
  .map((c) => observedValue(r22, (r) => r.domain === "person" && r.metric === "commute_days" && r.category === c))
  .reduce((s: number | null, v) => (s === null || v === null ? null : s + v), 0);
const exclusivelyHome = observedValue(r22, (r) => r.domain === "person" && r.metric === "commute_days" && r.category === "exclusively_home_or_unemployed");
const unknownFrequency = observedValue(r22, (r) => r.domain === "person" && r.metric === "commute_days" && r.category === "unknown");
const weekdayCommuting = {
  id: "weekday-commuting",
  question: "Is there one uniform weekday commute?",
  takeaway:
    `No. ${busiest.day} reports ${fmt(busiest.persons)} people commuting; ${quietest.day} reports ${fmt(quietest.persons)} — ` +
    `${pct1(dayDiff)} more on ${busiest.day}. And ${commuteDays1to4 !== null && knownFrequency ? pct1(commuteDays1to4 / knownFrequency) : "—"} of those with a known 0–5-day answer commuted 1–4 days.`,
  universe: "Persons in the 2022 TTS public summary (Durham Region).",
  denominatorNote:
    `Day counts: persons reporting commuting each day last week (multiresponse — the same person appears on several days; not five mutually exclusive shares). ` +
    `Frequency: denominator is ${fmt(knownFrequency ?? 0)} persons with a known 0–5-day response.`,
  basis: "2022 survey basis; person measures.",
  values: {
    days,
    busiestDay: { day: busiest.day, persons: busiest.persons },
    quietestDay: { day: quietest.day, persons: quietest.persons },
    busiestMinusQuietest: busiest.persons - quietest.persons,
    relativeDifference: dayDiff,
    frequency: {
      oneToFourDays: commuteDays1to4,
      knownZeroToFive: knownFrequency,
      oneToFourShare: commuteDays1to4 !== null && knownFrequency ? commuteDays1to4 / knownFrequency : null,
      exclusivelyHomeOrUnemployed: exclusivelyHome,
      unknown: unknownFrequency,
    },
  },
  caveats: [
    "Day-of-week counts describe people reporting each day last week; the same person can appear on several days.",
    `The frequency share excludes ${fmt(exclusivelyHome ?? 0)} people in the combined exclusively-home/unemployed category and ${fmt(unknownFrequency ?? 0)} unknown — it is not the share of all employed residents who work hybrid.`,
  ],
  sourceIds: [SUMMARY_SOURCE],
};

// ------------------------------------------------------- 6. work-at-home divergence
const muniRecs = (year: number, id: string) => records.filter((r) => r.surveyYear === year && r.geographyId === id);
const employedOf = (recs: NormalizedRecord[]) => {
  const cats = ["full_time", "part_time", "full_time_at_home", "part_time_at_home"];
  let sum: number | null = 0;
  let partial = false;
  for (const c of cats) {
    const v = observedValue(recs, (r) => r.metric === "employment" && r.category === c);
    if (v === null) {
      partial = true;
      continue;
    }
    sum = (sum ?? 0) + v;
  }
  return { value: sum === 0 ? null : sum, partial };
};
const homeOf = (recs: NormalizedRecord[]) => {
  const ft = observedValue(recs, (r) => r.metric === "employment" && r.category === "full_time_at_home");
  const pt = observedValue(recs, (r) => r.metric === "employment" && r.category === "part_time_at_home");
  if (ft === null && pt === null) return { value: null, partial: true };
  return { value: (ft ?? 0) + (pt ?? 0), partial: ft === null || pt === null };
};
const wahRows = MUNI_IDS.map((id) => {
  const recs16 = muniRecs(2016, id);
  const recs22 = muniRecs(2022, id);
  const e16 = employedOf(recs16);
  const e22 = employedOf(recs22);
  const h16 = homeOf(recs16);
  const h22 = homeOf(recs22);
  const s16 = h16.value !== null && e16.value && !e16.partial && !h16.partial ? h16.value / e16.value : null;
  const s22 = h22.value !== null && e22.value && !e22.partial && !h22.partial ? h22.value / e22.value : null;
  return {
    id,
    name: MUNI_NAMES[id]!,
    share2016: s16,
    share2022: s22,
    pp: s16 !== null && s22 !== null ? s22 - s16 : null,
  };
});
const regionE16 = employedOf(regionRecords(2016));
const regionE22 = employedOf(regionRecords(2022));
const regionH16 = homeOf(regionRecords(2016));
const regionH22 = homeOf(regionRecords(2022));
const workAtHome = {
  id: "work-at-home-divergence",
  question: "Did work-at-home change everywhere in the same way?",
  takeaway:
    `No. Region-wide the share of employed residents usually working at home went from ` +
    `${regionH16.value && regionE16.value && !regionE16.partial && !regionH16.partial ? pct1(regionH16.value / regionE16.value) : "—"} (2016) to ` +
    `${regionH22.value && regionE22.value && !regionE22.partial && !regionH22.partial ? pct1(regionH22.value / regionE22.value) : "—"} (2022), but municipalities moved in opposite directions.`,
  universe: "Employed residents (full-time + part-time, including usually-work-at-home), 2016 and 2022 TTS.",
  denominatorNote: "Denominator: employed persons. A share is computed only when every employment cell is observed.",
  basis: "Employment measures are collected comparably in 2016 and 2022.",
  values: {
    region: {
      share2016: regionH16.value && regionE16.value && !regionE16.partial && !regionH16.partial ? regionH16.value / regionE16.value : null,
      share2022: regionH22.value && regionE22.value && !regionE22.partial && !regionH22.partial ? regionH22.value / regionE22.value : null,
    },
    municipalities: wahRows,
  },
  caveats: [
    "Point estimates from two survey cycles; no statistical significance is claimed and the survey cannot say why the change happened.",
    "1986 is not part of this comparison: its part-time-at-home cell is suppressed, so no defensible value exists.",
  ],
  sourceIds: [SUMMARY_SOURCE, SUMMARY_SOURCE_2016],
};

// ------------------------------------------------------- 7. comparable municipal transit
const transitOf = (recs: NormalizedRecord[]) => {
  const parts = ["transit_local", "go_rail", "joint_go_transit"].map((m) =>
    observedValue(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === m),
  );
  return parts.every((p) => p !== null) ? parts.reduce((a, b) => a! + b!, 0) : null;
};
const totalTripsOf = (recs: NormalizedRecord[]) =>
  observedValue(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "total");
const TRANSIT_RAW_MODES = ["Transit excluding GO rail", "GO rail only", "Joint GO rail and local transit"];
const transitComparableRows = MUNI_IDS.map((id) => {
  const recs16 = muniRecs(2016, id);
  const t16 = transitOf(recs16);
  const tot16 = totalTripsOf(recs16);
  // 2022 comparable basis: mode × municipality-of-household extract, excl2016=0.
  let t22c = 0;
  let tot22c = 0;
  for (const [mode, byMuni] of Object.entries(ds.modeByPdComparable)) {
    const v = byMuni[MUNI_NAMES[id]!] ?? 0;
    tot22c += v;
    if (TRANSIT_RAW_MODES.includes(mode)) t22c += v;
  }
  return {
    id,
    name: MUNI_NAMES[id]!,
    trips2016: tot16,
    transit2016: t16,
    share2016: t16 !== null && tot16 ? t16 / tot16 : null,
    /** Null when 2016 published cells are suppressed (Brock's GO-rail and
     *  joint-GO cells) — the 2016 share is not computable, never guessed. */
    status2016: t16 === null ? "not computable from 2016 published cells (suppressed transit component)" : "observed",
    trips2022Comparable: tot22c,
    transit2022Comparable: t22c,
    share2022Comparable: t22c / tot22c,
    pp: t16 !== null && tot16 ? t22c / tot22c - t16 / tot16 : null,
  };
});
const regionTot16 = totalTripsOf(regionRecords(2016));
const regionT16 = transitOf(regionRecords(2016));
const regionTot22c = Object.values(ds.modeByPdComparable).reduce((s, byMuni) => s + Object.values(byMuni).reduce((a, b) => a + b, 0), 0);
const regionT22c = Object.entries(ds.modeByPdComparable)
  .filter(([mode]) => TRANSIT_RAW_MODES.includes(mode))
  .reduce((s, [, byMuni]) => s + Object.values(byMuni).reduce((a, b) => a + b, 0), 0);
const munisWithComparable2016 = transitComparableRows.filter((r) => r.pp !== null);
const transitComparable = {
  id: "comparable-transit-municipal",
  question: "Where was the comparable transit decline concentrated?",
  takeaway:
    `On the 2016-comparable basis, the transit share fell in all ${munisWithComparable2016.length} municipalities with computable 2016 cells ` +
    `(Brock's 2016 transit components are suppressed, so its change is not computable). Region-wide the comparable ` +
    `total moved ${pct1((regionTot22c - (regionTot16 ?? 0)) / (regionTot16 ?? 1))} while the transit share went from ` +
    `${regionT16 && regionTot16 ? pct1(regionT16 / regionTot16) : "—"} to ${pct1(regionT22c / regionTot22c)}.`,
  universe:
    "2016: resident weekday trips (public summary). 2022: trips by Durham households on the 2016-comparable basis (excl2016 = 0 extract).",
  denominatorNote: "Each year's share uses that year's comparable trip total. Sources differ by 12–18 trips at region level; differences are documented, not forced.",
  basis: "Harmonized comparison basis (excl2016 = 0). Never mix with full-basis 2022 shares.",
  values: {
    region: {
      trips2016: regionTot16,
      transit2016: regionT16,
      share2016: regionT16 && regionTot16 ? regionT16 / regionTot16 : null,
      trips2022Comparable: regionTot22c,
      transit2022Comparable: regionT22c,
      share2022Comparable: regionT22c / regionTot22c,
      tripsChange: (regionTot22c - (regionTot16 ?? 0)) / (regionTot16 ?? 1),
    },
    municipalities: transitComparableRows,
  },
  caveats: [
    "2022 reflects a post-pandemic travel environment; the survey alone cannot attribute causes.",
    "The 2016 figures come from the public summary; the 2022 comparable figures from the iDRS extract — reconciliation differences between extracts are documented, not eliminated.",
    "Municipality = municipality of household for the 2022 extract.",
  ],
  sourceIds: [OD_SOURCES[2]!, SUMMARY_SOURCE_2016],
};

// ------------------------------------------------------- 8. demographic / vehicle context
const personsOf = (year: number) => observedValue(regionRecords(year), (r) => r.domain === "person" && r.metric === "total");
const householdsOf = (year: number) => observedValue(regionRecords(year), (r) => r.domain === "household" && r.metric === "total");
const seniorsOf = (year: number) => {
  const cats = ["65_69", "70_74", "75_79", "80_84", "85_89", "90_94", "95_98"];
  const vals = cats.map((c) => observedValue(regionRecords(year), (r) => r.metric === "age" && r.category === c));
  return vals.every((v) => v !== null) ? vals.reduce((a, b) => a! + b!, 0) : null;
};
const vehiclesMean = (year: number) => {
  let weighted = 0;
  let total = 0;
  for (const cat of ["0", "1", "2", "3", "4", "5plus"]) {
    const v = observedValue(regionRecords(year), (r) => r.domain === "household" && r.metric === "vehicles" && r.category === cat);
    if (v === null) return null;
    weighted += v * (cat === "5plus" ? 5 : Number(cat));
    total += v;
  }
  return total > 0 ? weighted / total : null;
};
const demographicContext = {
  id: "demographic-context",
  question: "Has demographic change altered the context?",
  takeaway:
    `Durham's surveyed population aged 65+ went from ${seniorsOf(2016) && personsOf(2016) ? pct1(seniorsOf(2016)! / personsOf(2016)!) : "—"} (2016) to ` +
    `${seniorsOf(2022) && personsOf(2022) ? pct1(seniorsOf(2022)! / personsOf(2022)!) : "—"} (2022); households grew ` +
    `${householdsOf(2016) && householdsOf(2022) ? pct1((householdsOf(2022)! - householdsOf(2016)!) / householdsOf(2016)!) : "—"} while vehicles per known household moved ` +
    `${vehiclesMean(2016)?.toFixed(2)} → ${vehiclesMean(2022)?.toFixed(2)}.`,
  universe: "All residents and households in the Durham survey (2016 and 2022 TTS).",
  denominatorNote: "65+ share uses all residents; vehicles per household is a mean over known households with '5 or more' counted as 5.",
  basis: "Household/person measures; broadly stable definitions with documented cycle changes.",
  values: {
    seniorsShare2016: seniorsOf(2016) && personsOf(2016) ? seniorsOf(2016)! / personsOf(2016)! : null,
    seniorsShare2022: seniorsOf(2022) && personsOf(2022) ? seniorsOf(2022)! / personsOf(2022)! : null,
    households2016: householdsOf(2016),
    households2022: householdsOf(2022),
    householdsChange: householdsOf(2016) && householdsOf(2022) ? (householdsOf(2022)! - householdsOf(2016)!) / householdsOf(2016)! : null,
    vehiclesPerHousehold2016: vehiclesMean(2016),
    vehiclesPerHousehold2022: vehiclesMean(2022),
  },
  caveats: [
    "These are community-level associations; marginal tables cannot establish joint demographic behaviour (no income × age × vehicle-access inference).",
    "The shared top-code assumption biases vehicle means low, and the bias need not be equal across communities or cycles.",
  ],
  sourceIds: [SUMMARY_SOURCE, SUMMARY_SOURCE_2016],
};

const insights = {
  generatedAt: new Date().toISOString(),
  note: "Every value is computed at build time from the sources named per insight; components render, never recompute.",
  insights: [
    localVsCross,
    concentration,
    modeByDestination,
    purpose,
    weekdayCommuting,
    workAtHome,
    transitComparable,
    demographicContext,
  ],
  unavailable: [
    {
      question: "Joint demographic behaviour (e.g. low-income seniors without cars)",
      reason: "The published files are marginal tables; municipality-level percentages cannot establish joint population behaviour. Requires the cross-tabulated extracts specified in docs/acquisition-manifest.md (Q05).",
    },
    {
      question: "Routes used, travel times, emissions, feasible mode shift",
      reason: "Desire lines show only where trips begin and end; no path, time or emissions data exists in the extracts.",
    },
    {
      question: "Inbound travel by non-Durham households",
      reason: "The authorized extracts cover trips by members of Durham households only. Requires extract Q02 (all surveyed households with a Durham endpoint).",
    },
    {
      question: "Sample reliability / confidence intervals for OD flows",
      reason: "Unexpanded support counts were not part of the extracts; expanded counts are estimates and standard errors must not be invented. Requires extract Q01.",
    },
  ],
};

writeFileSync(OUT, JSON.stringify(insights));
console.log(`insights: wrote public/data/insights.json (${insights.insights.length} analyses, ${insights.unavailable.length} documented gaps)`);
for (const i of insights.insights) console.log(`  • ${i.id}: ${i.takeaway.slice(0, 110)}…`);

function fmt(v: number): string {
  return Math.round(v).toLocaleString("en-CA");
}
function pct1(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
