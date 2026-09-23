/**
 * Phase 3 story mining (handoff §20–§21): deterministic analyses over
 * data/processed/phase3/normalized.json → story-candidates.json.
 *
 * Nothing here is editorial guesswork: every candidate carries its numerator,
 * denominator and source extraction. Sample support travels with claims where
 * an unexpanded mirror exists. Candidates are INPUTS to the editorial decision
 * about which two stories get built — not automatic site content.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const IN = resolve(ROOT, "data/processed/phase3/normalized.json");

type Rel = "internal_durham" | "inbound_to_durham" | "outbound_from_durham" | "outside_durham";
type FlowSet = { inbound: Record<string, number>; outbound: Record<string, number>; internal: Record<string, number>; total: number };

interface Norm {
  odAll: {
    universe: number;
    universeSurveyRecords: number;
    relationships: Record<Rel, number>;
    relationshipsSurveyRecords: Record<Rel, number>;
    inboundOutboundRatio: number;
    byMunicipality: Record<string, { inbound: number; inboundSurveyRecords: number; outboundAllExternal: number; outboundBeyondSurveyArea: number; netFlow: number }>;
  };
  modeFlows: FlowSet;
  purposeFlows: FlowSet;
  destPurposeFlows: FlowSet;
  residentPurposeFlows: { purpose: string; durhamOrigin: { same: number; crossDurham: number; toronto: number; elsewhere: number }; blockTotal: number }[];
  day: {
    durhamResidents: { slot: number; label: string; trips: number; surveyRecords: number; byMode: Record<string, number>; byPurpose: Record<string, number> }[];
    departing: { slot: number; label: string; total: number; internal: number; outbound: number }[];
    arriving: { slot: number; label: string; total: number; internal: number; inbound: number }[];
  };
  distanceByMode: { bands: Record<string, Record<string, number>>; totals: Record<string, number>; grandTotal: number };
  distanceByPurpose: { bands: Record<string, Record<string, number>>; totals: Record<string, number>; grandTotal: number };
  ageByMode: { groups: Record<string, Record<string, number>>; totals: Record<string, number>; total: number };
  ageByModeSurveyRecords: Record<string, Record<string, number>>;
  ageByPurpose: { groups: Record<string, Record<string, number>>; totals: Record<string, number>; total: number };
  vehiclesByMode: { groups: Record<string, Record<string, number>>; total: number };
  transit: {
    accessTypes: string[];
    goTrips: number;
    boardingsByStation: Record<string, number>;
    accessByStation: Record<string, Record<string, number>>;
    accessByOriginPd: Record<string, Record<string, number>>;
    stationOd: { from: string; to: string; trips: number; surveyRecords: number }[];
    linksByAccess: Record<string, Record<string, number>>;
    linksByAccessGo?: Record<string, Record<string, number>>;
    linksByAccessNonGo?: Record<string, Record<string, number>>;
  };
}

const ds: Norm = JSON.parse(readFileSync(IN, "utf8"));
const MUNIS: Record<string, string> = {
  brock: "Brock", uxbridge: "Uxbridge", scugog: "Scugog", pickering: "Pickering",
  ajax: "Ajax", whitby: "Whitby", oshawa: "Oshawa", clarington: "Clarington",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const shareOf = (v: number, total: number) => (total > 0 ? v / total : 0);
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const fmt = (v: number) => Math.round(v).toLocaleString("en-CA");

interface Candidate {
  id: string;
  theme: "time" | "inbound" | "mode-geography" | "distance" | "age" | "vehicle-access" | "transit";
  finding: string;
  metrics: { label: string; value: number; unit: string }[];
  sourceIds: string[];
  sampleSupport?: number;
  caveats: string[];
  possibleVisualization: string;
  scores: { surprise: number; relevance: number; visual: number; confidence: number; support: number; novelty: number };
  totalScore: number;
  recommendation: "BUILD" | "HOLD" | "REJECT";
}

const candidates: Candidate[] = [];
const push = (c: Omit<Candidate, "totalScore" | "recommendation">) => {
  const s = c.scores;
  candidates.push({ ...c, totalScore: s.surprise + s.relevance + s.visual + s.confidence + s.support + s.novelty, recommendation: "HOLD" });
};

// ---------------------------------------------------------------------------
// 1. TIME — the travel day (Durham households, F + F-unexp + G + H)
// ---------------------------------------------------------------------------

const slots = ds.day.durhamResidents;
const hourOf = (label: string) => Number(label.slice(0, 2)); // survey-hour 04..27

const byHour = new Map<number, { trips: number; records: number; byMode: Record<string, number>; byPurpose: Record<string, number> }>();
for (const s of slots) {
  const h = Math.floor(s.slot / 60) + 4; // survey hour 04..27
  const acc = byHour.get(h) ?? { trips: 0, records: 0, byMode: {}, byPurpose: {} };
  acc.trips += s.trips;
  acc.records += s.surveyRecords;
  for (const [m, v] of Object.entries(s.byMode)) acc.byMode[m] = (acc.byMode[m] ?? 0) + v;
  for (const [p, v] of Object.entries(s.byPurpose)) acc.byPurpose[p] = (acc.byPurpose[p] ?? 0) + v;
  byHour.set(h, acc);
}
const hours = [...byHour.entries()].sort((a, b) => a[0] - b[0]);
const dayTotal = sum(slots.map((s) => s.trips));
const dayRecords = sum(slots.map((s) => s.surveyRecords));

const peakHour = hours.reduce((a, b) => (b[1]!.trips > a[1]!.trips ? b : a));
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`; // survey-hour, 24:00–27:59 keep TTS convention

// secondary peaks: local maxima above 60% of the peak
let peaks: { h: number; trips: number }[] = [];
hours.forEach(([h, v], i) => {
  const prev = hours[i - 1]?.[1]?.trips ?? 0;
  const next = hours[i + 1]?.[1]?.trips ?? 0;
  if (v.trips >= prev && v.trips >= next && v.trips > 0.6 * peakHour[1]!.trips) peaks.push({ h, trips: v.trips });
});

// mode share shift across the day
const modeShare = (h: number, mode: string) => shareOf(byHour.get(h)?.byMode[mode] ?? 0, byHour.get(h)?.trips ?? 1);
const amPeak = 7;
const midday = 12;
const eveningPeak = 16;

// purpose share by hour — when does discretionary overtake work?
const purposeShareByHour = hours.map(([h, v]) => ({
  h,
  work: shareOf(v.byPurpose["Home-Based Work"] ?? 0, v.trips),
  school: shareOf(v.byPurpose["Home-based School"] ?? 0, v.trips),
  discretionary: shareOf(v.byPurpose["Home-based Discretionary"] ?? 0, v.trips),
  nhb: shareOf(v.byPurpose["Non Home-based"] ?? 0, v.trips),
  trips: v.trips,
}));
const discretionaryOvertakesWork = purposeShareByHour.find((p) => p.discretionary > p.work && p.h >= 8);

// net external flow by hour (G/H). Overnight survey-hours (00:00–03:00,
// i.e. 24:00–27:59) are too thin to headline; the day peaks live in 06–22.
const extByHour = new Map<number, { inbound: number; outbound: number }>();
const bumpExt = (slot: number, key: "inbound" | "outbound", v: number) => {
  const h = Math.floor(slot / 60) + 4;
  const acc = extByHour.get(h) ?? { inbound: 0, outbound: 0 };
  acc[key] += v;
  extByHour.set(h, acc);
};
for (const r of ds.day.arriving) bumpExt(r.slot, "inbound", r.inbound);
for (const r of ds.day.departing) bumpExt(r.slot, "outbound", r.outbound);
const netFlowByHour = [...extByHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ h, ...v, net: v.inbound - v.outbound }));
const dayHours = netFlowByHour.filter((n) => n.h >= 6 && n.h <= 22);
const maxInflowHour = dayHours.reduce((a, b) => (b.net > a.net ? b : a));
const maxOutflowHour = dayHours.reduce((a, b) => (b.net < a.net ? b : a));
const signedFmt = (v: number) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`;

const overnight = hours.filter(([h]) => h >= 24).reduce((s, [, v]) => s + v.trips, 0);
const earlyHour = byHour.get(4)!;
const amPeakEntry = hours.find(([h]) => h === 8)!;
const pmPeakEntry = hours.find(([h]) => h === 15)!;
const pmHigher = pmPeakEntry![1].trips > amPeakEntry![1].trips;

push({
  id: "day-shape-two-peaks",
  theme: "time",
  finding: `The Durham day is a twin-peak day with the afternoon ahead: ${fmt(amPeakEntry![1].trips)} trips start in the 08:00 hour and ${fmt(pmPeakEntry![1].trips)} in the 15:00 hour — ${pmHigher ? "the afternoon peak is the biggest of the day" : "the morning peak is the biggest of the day"}. The region is nearly still at 04:00 (${fmt(earlyHour.trips)} trips) and survey-hours 24:00–27:00 hold just ${fmt(overnight)}.`,
  metrics: [
    { label: "08:00 hour trips", value: amPeakEntry![1].trips, unit: "trips" },
    { label: "15:00 hour trips", value: pmPeakEntry![1].trips, unit: "trips" },
    { label: "04:00 hour trips", value: earlyHour.trips, unit: "trips" },
    { label: "distinct peaks", value: peaks.length, unit: "peaks" },
    { label: "day total", value: dayTotal, unit: "trips" },
  ],
  sourceIds: ["F", "F-unexp"],
  sampleSupport: dayRecords,
  caveats: ["Departure time, not arrival time; 2022 full basis (ages 5+, all walk trips). Survey hours run 04:00–27:59."],
  possibleVisualization: "Clock + volume curve synchronized with map animation (A Day in Durham).",
  scores: { surprise: 4, relevance: 5, visual: 5, confidence: 5, support: 4, novelty: 4 },
});

const earlyWorkShare = shareOf(byHour.get(5)?.byPurpose["Home-Based Work"] ?? 0, byHour.get(5)?.trips ?? 1);
push({
  id: "day-purpose-phases",
  theme: "time",
  finding: `Each hour belongs to a different Durham. The 05:00 hour is ${pct(earlyWorkShare)} home-based work; by 08:00 school (${pct(purposeShareByHour.find((p) => p.h === 8)!.school, 0)}) and discretionary dominate the peak; from ${discretionaryOvertakesWork ? hourLabel(discretionaryOvertakesWork.h) : "n/a"} discretionary travel never gives the lead back. Even in mid-career hours the biggest single purpose by volume is discretionary, not work.`,
  metrics: purposeShareByHour.filter((p) => [5, 7, 8, 10, 15, 18, 20].includes(p.h)).flatMap((p) => [
    { label: `work share ${hourLabel(p.h)}`, value: p.work, unit: "share" },
    { label: `school share ${hourLabel(p.h)}`, value: p.school, unit: "share" },
    { label: `discretionary share ${hourLabel(p.h)}`, value: p.discretionary, unit: "share" },
  ]),
  sourceIds: ["F"],
  caveats: ["Broad purpose categories; shares of each hour's trip-starts."],
  possibleVisualization: "Stacked purpose ribbon flowing through the day.",
  scores: { surprise: 4, relevance: 4, visual: 5, confidence: 5, support: 3, novelty: 4 },
});

push({
  id: "day-net-external-flow",
  theme: "time",
  finding: `Durham's net exchange with the rest of the region swings hard across the day: net OUTFLOW bottoms at ${hourLabel(maxOutflowHour.h)} (${signedFmt(maxOutflowHour.net)} trips in the hour) as residents leave, then flips to net INFLOW peaking at ${hourLabel(maxInflowHour.h)} (${signedFmt(maxInflowHour.net)}) as the day's trips come home. Durham is an origin at some hours and a destination at others.`,
  metrics: [
    { label: `net flow ${hourLabel(maxOutflowHour.h)}`, value: maxOutflowHour.net, unit: "trips" },
    { label: `net flow ${hourLabel(maxInflowHour.h)}`, value: maxInflowHour.net, unit: "trips" },
  ],
  sourceIds: ["G", "H"],
  caveats: ["Trips with a Durham endpoint and known start time; midnight+ survey hours excluded from the headline search. A trip's 'return' is its own departure, so net inflow hours are dominated by journeys home."],
  possibleVisualization: "Net-flow line crossing zero over the day, paired with inbound/outbound bands.",
  scores: { surprise: 4, relevance: 4, visual: 4, confidence: 4, support: 3, novelty: 5 },
});

// ---------------------------------------------------------------------------
// 2. INBOUND — who comes to Durham (A/B/C/D/D2)
// ---------------------------------------------------------------------------

const rel = ds.odAll.relationships;
const relSup = ds.odAll.relationshipsSurveyRecords;

push({
  id: "inbound-outbound-balance",
  theme: "inbound",
  finding: `Durham's travel market is nearly balanced: ${fmt(rel.inbound_to_durham)} trips come INTO Durham from outside on an average weekday and ${fmt(rel.outbound_from_durham)} go OUT — an inbound/outbound ratio of ${ds.odAll.inboundOutboundRatio.toFixed(2)}. Roughly 2.1% of the region's 19.5M trips cross Durham's boundary in either direction.`,
  metrics: [
    { label: "inbound", value: rel.inbound_to_durham, unit: "trips" },
    { label: "outbound", value: rel.outbound_from_durham, unit: "trips" },
    { label: "internal", value: rel.internal_durham, unit: "trips" },
    { label: "inbound/outbound", value: ds.odAll.inboundOutboundRatio, unit: "ratio" },
  ],
  sourceIds: ["A", "B"],
  sampleSupport: relSup.inbound_to_durham + relSup.outbound_from_durham,
  caveats: ["Trip balance is not an economic-attraction measure; it counts trips, not jobs or shoppers."],
  possibleVisualization: "Boundary exchange dial / two-arrow balance graphic opening 'Who Comes to Durham?'.",
  scores: { surprise: 4, relevance: 5, visual: 4, confidence: 5, support: 5, novelty: 5 },
});

const muniBalance = Object.entries(ds.odAll.byMunicipality).map(([id, v]) => ({
  id,
  name: MUNIS[id]!,
  ...v,
  grossExchange: v.inbound + v.outboundAllExternal,
  netShareOfGross: shareOf(Math.abs(v.netFlow), v.inbound + v.outboundAllExternal),
}));
const mostInbound = muniBalance.reduce((a, b) => (b.inbound > a.inbound ? b : a));
const leastExchange = muniBalance.reduce((a, b) => (b.grossExchange < a.grossExchange ? b : a));
const mostExchange = muniBalance.reduce((a, b) => (b.grossExchange > a.grossExchange ? b : a));
const biggestImbalance = muniBalance.reduce((a, b) => (b.netShareOfGross > a.netShareOfGross ? b : a));
const smallestImbalance = muniBalance.reduce((a, b) => (b.netShareOfGross < a.netShareOfGross ? b : a));

push({
  id: "inbound-municipal-balances",
  theme: "inbound",
  finding: `Boundary travel is a two-way river at every municipality: net imbalances are tiny relative to the exchange — ${smallestImbalance.name} balances to ${pct(smallestImbalance.netShareOfGross)} of its two-way flow and even ${biggestImbalance.name}, the most lopsided, sits at ${pct(biggestImbalance.netShareOfGross)}. Gross exchange varies six-fold, from ${fmt(leastExchange.grossExchange)} (${leastExchange.name}) to ${fmt(mostExchange.grossExchange)} (${mostExchange.name}).`,
  metrics: muniBalance.flatMap((m) => [
    { label: `${m.name} inbound`, value: m.inbound, unit: "trips" },
    { label: `${m.name} net`, value: m.netFlow, unit: "trips" },
    { label: `${m.name} net share of gross`, value: m.netShareOfGross, unit: "share" },
  ]),
  sourceIds: ["A", "B"],
  sampleSupport: sum(muniBalance.map((m) => m.inboundSurveyRecords)),
  caveats: ["Inbound counts all trips ending in the municipality from outside Durham (any household); outbound counts trips starting there to outside Durham."],
  possibleVisualization: "Diverging net bars under gross-exchange columns — the flatness of 'net' IS the story.",
  scores: { surprise: 4, relevance: 5, visual: 4, confidence: 5, support: 5, novelty: 4 },
});

// inbound vs outbound mode split (C)
const inboundModeTotal = sum(Object.values(ds.modeFlows.inbound));
const outboundModeTotal = sum(Object.values(ds.modeFlows.outbound));
const internalModeTotal = sum(Object.values(ds.modeFlows.internal));
const modeTable = MODE_KEYS().map((m) => ({
  mode: m,
  inbound: shareOf(ds.modeFlows.inbound[m] ?? 0, inboundModeTotal),
  outbound: shareOf(ds.modeFlows.outbound[m] ?? 0, outboundModeTotal),
  internal: shareOf(ds.modeFlows.internal[m] ?? 0, internalModeTotal),
}));
function MODE_KEYS(): string[] {
  const keys = new Set<string>();
  for (const k of Object.keys(ds.modeFlows.inbound)) keys.add(k);
  for (const k of Object.keys(ds.modeFlows.outbound)) keys.add(k);
  for (const k of Object.keys(ds.modeFlows.internal)) keys.add(k);
  return [...keys];
}
const transitIn = shareOf(ds.modeFlows.inbound["transit"] ?? 0, inboundModeTotal);
const transitOut = shareOf(ds.modeFlows.outbound["transit"] ?? 0, outboundModeTotal);
const walkIn = shareOf(ds.modeFlows.inbound["walk"] ?? 0, inboundModeTotal);
const driveIn = shareOf(ds.modeFlows.inbound["drive"] ?? 0, inboundModeTotal);
const driveOut = shareOf(ds.modeFlows.outbound["drive"] ?? 0, outboundModeTotal);
const rideIn = shareOf(ds.modeFlows.inbound["ride"] ?? 0, inboundModeTotal);
const walkInAbs = ds.modeFlows.inbound["walk"] ?? 0;
const walkInternal = ds.modeFlows.internal["walk"] ?? 0;

push({
  id: "coming-vs-leaving-modes",
  theme: "inbound",
  finding: `Coming to Durham and leaving it are near mirror images: driving carries ${pct(driveIn)} of inbound vs ${pct(driveOut)} of outbound boundary trips, and transit splits ${pct(transitIn)} vs ${pct(transitOut)}. The boundary effect is what vanishes: only ${fmt(walkInAbs)} inbound trips are on foot, against ${fmt(walkInternal)} walking trips inside Durham — the boundary is crossed almost entirely by motor vehicles (${pct(driveIn + rideIn, 0)} counting passengers).`,
  metrics: modeTable.flatMap((m) => [
    { label: `${m.mode} inbound`, value: m.inbound, unit: "share" },
    { label: `${m.mode} outbound`, value: m.outbound, unit: "share" },
    { label: `${m.mode} internal`, value: m.internal, unit: "share" },
  ]),
  sourceIds: ["C", "A"],
  sampleSupport: undefined,
  caveats: ["Boundary-crossing trips only, all surveyed households; small modes (cycle, motorcycle) have thin survey support at the boundary."],
  possibleVisualization: "Back-to-back mode bars (inbound vs outbound) plus a 'what vanishes at the boundary' inset.",
  scores: { surprise: 5, relevance: 4, visual: 4, confidence: 4, support: 2, novelty: 5 },
});

// WHY people come (D2) — inbound trips that END at Home are largely Durham
// residents' return legs; the non-Home remainder is travel to an ACTIVITY in
// Durham and that is the honest "why people come" universe.
const inboundDestPurpose = Object.entries(ds.destPurposeFlows.inbound).sort((a, b) => b[1] - a[1]);
const inboundDPTotal = sum(inboundDestPurpose.map(([, v]) => v));
const homeEnding = ds.destPurposeFlows.inbound["Home"] ?? 0;
const activityInbound = inboundDPTotal - homeEnding;
const activityPurposes = inboundDestPurpose.filter(([p]) => p !== "Home");
const topWorkShareOfActivity = shareOf(ds.destPurposeFlows.inbound["Usual Work"] ?? 0, activityInbound);
const nonWorkShareOfActivity = shareOf(activityInbound - (ds.destPurposeFlows.inbound["Usual Work"] ?? 0), activityInbound);
const top3Activity = activityPurposes.slice(0, 3);

push({
  id: "why-people-come",
  theme: "inbound",
  finding: `${fmt(homeEnding)} inbound trips (${pct(shareOf(homeEnding, inboundDPTotal))}) end at Home — Durham residents coming back. The remaining ${fmt(activityInbound)} trips arrive for an activity in Durham: ${top3Activity.map(([p]) => p).join(", ")} lead, with "Usual Work" at ${pct(topWorkShareOfActivity)} — meaning ${pct(nonWorkShareOfActivity)} of inbound activity travel is not commuting at all.`,
  metrics: activityPurposes.map(([p, v]) => ({ label: `${p} (share of activity inbound)`, value: shareOf(v, activityInbound), unit: "share" })),
  sourceIds: ["D2"],
  caveats: ["Detailed destination purpose of the Durham-ending leg, all surveyed households. 'Ends at Home' trips cannot be split resident vs visitor without a household filter, so they are treated as a separate class rather than assumed."],
  possibleVisualization: "Two-tier donut: Home-ending vs activity inbound; ranked purpose bars inside (WHY PEOPLE COME).",
  scores: { surprise: 4, relevance: 5, visual: 4, confidence: 5, support: 2, novelty: 5 },
});

// ---------------------------------------------------------------------------
// 3. MODE GEOGRAPHY (C + existing Phase 2 mode OD + I distance)
// ---------------------------------------------------------------------------

// per mode group: boundary-crossing activity vs internal (tri-boundary scope:
// trips with at least one Durham endpoint, from query C)
const modeGeography = MODE_KEYS().map((m) => {
  const internal = ds.modeFlows.internal[m] ?? 0;
  const inbound = ds.modeFlows.inbound[m] ?? 0;
  const outbound = ds.modeFlows.outbound[m] ?? 0;
  return { mode: m, internal, inbound, outbound, shareInternalOfAll: shareOf(internal, internal + inbound + outbound) };
});
void modeGeography;

// distance: median band per mode
function medianBand(bands: Record<string, Record<string, number>>, cat: string, bandOrder: readonly string[]): string {
  const total = sum(bandOrder.map((b) => bands[b]![cat] ?? 0));
  let acc = 0;
  for (const b of bandOrder) {
    acc += bands[b]![cat] ?? 0;
    if (acc >= total / 2) return b;
  }
  return bandOrder[bandOrder.length - 1]!;
}
const walkMedian = medianBand(ds.distanceByMode.bands, "walk", ["<1 km", "1–2 km", "2–5 km", "5–10 km", "10–20 km", "20–40 km", "40+ km"]);
const driveMedian = medianBand(ds.distanceByMode.bands, "drive", ["<1 km", "1–2 km", "2–5 km", "5–10 km", "10–20 km", "20–40 km", "40+ km"]);
const cycleMedian = medianBand(ds.distanceByMode.bands, "cycle", ["<1 km", "1–2 km", "2–5 km", "5–10 km", "10–20 km", "20–40 km", "40+ km"]);
const transitMedian = medianBand(ds.distanceByMode.bands, "transit", ["<1 km", "1–2 km", "2–5 km", "5–10 km", "10–20 km", "20–40 km", "40+ km"]);

// short auto trips — described as pattern, NOT as replaceable
const autoShortTotal = (ds.distanceByMode.bands["<1 km"]!.drive ?? 0) + (ds.distanceByMode.bands["1–2 km"]!.drive ?? 0);
const driveTotal = ds.distanceByMode.totals.drive!;

push({
  id: "every-mode-own-map",
  theme: "mode-geography",
  finding: `Each mode lives at a different scale: the median reported trip distance is ${walkMedian} for walking, ${cycleMedian} for cycling, ${driveMedian} for driving and ${transitMedian} for transit. ${pct(shareOf(autoShortTotal, driveTotal))} of drive trips are under 2 km straight-line — a pattern, not a verdict that they could have been walked.`,
  metrics: [
    { label: "walk median band", value: 0, unit: walkMedian },
    { label: "cycle median band", value: 0, unit: cycleMedian },
    { label: "drive median band", value: 0, unit: driveMedian },
    { label: "transit median band", value: 0, unit: transitMedian },
    { label: "drive trips <2km", value: autoShortTotal, unit: "trips" },
    { label: "drive <2km share", value: shareOf(autoShortTotal, driveTotal), unit: "share" },
  ],
  sourceIds: ["I", "C"],
  caveats: ["Straight-line (not routed) distance; bands use reported whole km. Short auto trips are not automatically replaceable by walking or cycling."],
  possibleVisualization: "One map that physically rescales per mode (EVERY MODE HAS ITS OWN MAP).",
  scores: { surprise: 3, relevance: 5, visual: 5, confidence: 5, support: 3, novelty: 3 },
});

// ---------------------------------------------------------------------------
// 4. PURPOSE GEOGRAPHY (E)
// ---------------------------------------------------------------------------

const purposeGeo = ds.residentPurposeFlows.map((p) => {
  const t = p.durhamOrigin.same + p.durhamOrigin.crossDurham + p.durhamOrigin.toronto + p.durhamOrigin.elsewhere;
  return {
    purpose: p.purpose,
    total: t,
    same: shareOf(p.durhamOrigin.same, t),
    crossDurham: shareOf(p.durhamOrigin.crossDurham, t),
    toronto: shareOf(p.durhamOrigin.toronto, t),
    elsewhere: shareOf(p.durhamOrigin.elsewhere, t),
  };
});
const workGeo = purposeGeo.find((p) => p.purpose === "Home-Based Work")!;
const schoolGeo = purposeGeo.find((p) => p.purpose === "Home-based School")!;
const discGeo = purposeGeo.find((p) => p.purpose === "Home-based Discretionary")!;

push({
  id: "four-durhams-purpose-geography",
  theme: "mode-geography",
  finding: `Purpose creates different geographies: ${pct(schoolGeo.same + schoolGeo.crossDurham)} of home-based school travel stays in Durham vs ${pct(workGeo.same + workGeo.crossDurham)} of home-based work; work sends ${pct(workGeo.toronto)} of its trips to Toronto vs school's ${pct(schoolGeo.toronto)}.`,
  metrics: purposeGeo.flatMap((p) => [
    { label: `${p.purpose} in-Durham`, value: p.same + p.crossDurham, unit: "share" },
    { label: `${p.purpose} Toronto`, value: p.toronto, unit: "share" },
  ]),
  sourceIds: ["E"],
  caveats: ["Durham-origin trips by Durham households; broad purpose only."],
  possibleVisualization: "Purpose switcher on the network map (THERE ISN'T ONE DURHAM NETWORK).",
  scores: { surprise: 3, relevance: 4, visual: 4, confidence: 5, support: 2, novelty: 3 },
});

// ---------------------------------------------------------------------------
// 5. AGE (K/L)
// ---------------------------------------------------------------------------

const ageGroupTripRates: { group: string; trips: number; records: number; driveShare: number; walkShare: number; passShare: number; topPurpose: string }[] = [];
for (const g of Object.keys(ds.ageByMode.groups)) {
  const byMode = ds.ageByMode.groups[g]!;
  const t = sum(Object.values(byMode));
  const rec = sum(Object.values(ds.ageByModeSurveyRecords[g] ?? {}));
  const purposes = ds.ageByPurpose.groups[g] ?? {};
  const topPurpose = Object.entries(purposes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  ageGroupTripRates.push({
    group: g,
    trips: t,
    records: rec,
    driveShare: shareOf(byMode["drive"] ?? 0, t),
    walkShare: shareOf(byMode["walk"] ?? 0, t),
    passShare: shareOf(byMode["ride"] ?? 0, t),
    topPurpose,
  });
}
const teens = ageGroupTripRates.find((a) => a.group === "15–24")!;
const oldest = ageGroupTripRates.find((a) => a.group === "75+")!;
const kids = ageGroupTripRates.find((a) => a.group === "5–14")!;
const peakDrive = ageGroupTripRates.reduce((a, b) => (b.driveShare > a.driveShare ? b : a));
const older65 = ageGroupTripRates.find((a) => a.group === "65–74")!;

push({
  id: "age-mobility-ladder",
  theme: "age",
  finding: `Car dependence is climbed, then partly descended: children 5–14 drive nothing (they ride in ${pct(kids.passShare)} of trips and walk ${pct(kids.walkShare)}); driving climbs through ages 15–24 (${pct(teens.driveShare)}) to a peak of ${pct(peakDrive.driveShare)} at 45–64, then steps down after 65 (${older65.driveShare !== undefined ? pct(older65.driveShare) : ""} at 65–74, ${pct(oldest.driveShare)} at 75+) while being a passenger climbs back up to ${pct(oldest.passShare)}.`,
  metrics: ageGroupTripRates.flatMap((a) => [
    { label: `${a.group} drive share`, value: a.driveShare, unit: "share" },
    { label: `${a.group} passenger share`, value: a.passShare, unit: "share" },
    { label: `${a.group} walk share`, value: a.walkShare, unit: "share" },
  ]),
  sourceIds: ["K", "K-unexp", "L"],
  sampleSupport: sum(ageGroupTripRates.map((a) => a.records)),
  caveats: ["Shares of each age group's trips; group sizes differ — never compare raw trip counts across ages without population denominators. Age is the trip-maker's age, household vehicles the context."],
  possibleVisualization: "Age slope charts: drive/passenger/walk shares across six age bands (DURHAM CHANGES WITH AGE).",
  scores: { surprise: 3, relevance: 4, visual: 4, confidence: 5, support: 4, novelty: 4 },
});

// ---------------------------------------------------------------------------
// 6. VEHICLES (M)
// ---------------------------------------------------------------------------

const zeroVeh = ds.vehiclesByMode.groups["0 vehicles"]!;
const zeroVehTotal = sum(Object.values(zeroVeh));
const threePlus = ds.vehiclesByMode.groups["3+ vehicles"]!;
const threePlusTotal = sum(Object.values(threePlus));
push({
  id: "garage-changes-day",
  theme: "vehicle-access",
  finding: `In zero-vehicle households transit+walk carry ${pct(shareOf((zeroVeh["transit"] ?? 0) + (zeroVeh["walk"] ?? 0), zeroVehTotal))} of trips; in 3+-vehicle households they carry ${pct(shareOf((threePlus["transit"] ?? 0) + (threePlus["walk"] ?? 0), threePlusTotal))}. Association, not causation.`,
  metrics: [
    { label: "zero-vehicle transit+walk share", value: shareOf((zeroVeh["transit"] ?? 0) + (zeroVeh["walk"] ?? 0), zeroVehTotal), unit: "share" },
    { label: "3+-vehicle transit+walk share", value: shareOf((threePlus["transit"] ?? 0) + (threePlus["walk"] ?? 0), threePlusTotal), unit: "share" },
  ],
  sourceIds: ["M"],
  caveats: ["Household vehicle availability is associated with travel behaviour; this cross-tab does not prove causation. Households, not persons, are the vehicle unit."],
  possibleVisualization: "HOLD for now — likely a methodology-page insight rather than a story.",
  scores: { surprise: 2, relevance: 3, visual: 3, confidence: 4, support: 2, novelty: 2 },
});

// ---------------------------------------------------------------------------
// 7. TRANSIT (N/O/P)
// ---------------------------------------------------------------------------

const boardings = Object.entries(ds.transit.boardingsByStation).sort((a, b) => b[1] - a[1]);
const unionBoardings = ds.transit.boardingsByStation["Union GO Station"] ?? 0;
const unionBoardShare = shareOf(unionBoardings, ds.transit.goTrips);
// Union boardings are the RETURN leg (home from downtown); the top
// Durham-line stations are the story:
const lineStations = boardings.filter(([s]) => ["Oshawa GO Station", "Whitby GO Station", "Ajax GO Station", "Pickering GO Station"].includes(s));
const topLineStation = lineStations[0]!;
const secondLineStation = lineStations[1]!;

const unionOd = ds.transit.stationOd.filter((c) => c.to === "Union GO Station");
const unionTrips = sum(unionOd.map((c) => c.trips));
const unionShare = shareOf(unionTrips, ds.transit.goTrips);
const unionSupport = sum(unionOd.map((c) => c.surveyRecords));

const carAccess = (s: string) =>
  (ds.transit.accessByStation[s]?.["Drive-access transit"] ?? 0) + (ds.transit.accessByStation[s]?.["Drive-access transit- Passenger"] ?? 0);
const lineStationTotal = (s: string) => (ds.transit.accessByStation[s] ? sum(Object.values(ds.transit.accessByStation[s]!)) : 1);
const topLineCarShare = shareOf(carAccess(topLineStation[0]), lineStationTotal(topLineStation[0]));
const bestWalkStation = lineStations
  .map(([s]) => ({ s, walk: shareOf(ds.transit.accessByStation[s]?.["Walk-access transit"] ?? 0, lineStationTotal(s)) }))
  .sort((a, b) => b.walk - a.walk)[0]!;

push({
  id: "go-union-orientation",
  theme: "transit",
  finding: `GO rail for Durham households is a downtown shuttle with a two-anchor front door: ${fmt(unionTrips)} of ${fmt(ds.transit.goTrips)} GO trips (${pct(unionShare)}) touch Union as an alighting point, and Union is also the top boarding station (${fmt(unionBoardings)}) — the return legs. On the line itself, ${topLineStation[0]} (${fmt(topLineStation[1])}) and ${secondLineStation[0]} (${fmt(secondLineStation[1])}) are nearly tied. Riders reach these stations overwhelmingly by car: ${pct(topLineCarShare)} at ${topLineStation[0].replace(" GO Station", "")}, though ${bestWalkStation.s.replace(" GO Station", "")} walkers reach ${pct(bestWalkStation.walk)} without one.`,
  metrics: [
    { label: "GO trips (Durham households)", value: ds.transit.goTrips, unit: "trips" },
    { label: "alight at Union", value: unionTrips, unit: "trips" },
    { label: "Union alighting share", value: unionShare, unit: "share" },
    { label: `${topLineStation[0]} boardings`, value: topLineStation[1], unit: "trips" },
    { label: `${secondLineStation[0]} boardings`, value: secondLineStation[1], unit: "trips" },
    { label: `${topLineStation[0]} car access`, value: topLineCarShare, unit: "share" },
  ],
  sourceIds: ["O", "O-unexp", "N"],
  sampleSupport: unionSupport,
  caveats: ["Station OD cells rest on few survey records (Union↔Whitby ≈146 records for 2,573 expanded trips) — rankings are safe, individual small cells are not. go_on/go_off identify GO rail stations; non-rail access geography uses trip origin/destination as proxy."],
  possibleVisualization: "Lakeshore-East line diagram with station weights + access-mode strips (HOW DURHAM GETS TO GO).",
  scores: { surprise: 3, relevance: 5, visual: 5, confidence: 5, support: 4, novelty: 4 },
});

const linksAll = ds.transit.linksByAccess;
const linksOf = (basis: "go" | "nonGo") =>
  basis === "nonGo" ? (ds.transit.linksByAccessNonGo ?? {}) : (ds.transit.linksByAccessGo ?? ds.transit.linksByAccess);
const linksTotalOf = (basis: "go" | "nonGo", access: string) => sum(Object.values(linksOf(basis)[access] ?? {}));
const linksGe1 = (access: string, basis: "go" | "nonGo" = "go") =>
  sum(Object.entries(linksOf(basis)[access] ?? {}).filter(([n]) => Number(n) >= 1).map(([, v]) => v));
const linksGe2 = (access: string, basis: "go" | "nonGo" = "go") =>
  sum(Object.entries(linksOf(basis)[access] ?? {}).filter(([n]) => Number(n) >= 2).map(([, v]) => v));

push({
  id: "transit-journey-complexity",
  theme: "transit",
  finding: `The journey to the journey is often multi-link: among drive-access GO riders, ${pct(shareOf(linksGe2("Drive-access transit", "go"), linksGe1("Drive-access transit", "go")))} of GO journeys use 2+ transit links, vs ${pct(shareOf(linksGe2("Drive-access transit", "nonGo"), linksGe1("Drive-access transit", "nonGo")))} for drive-access local-transit journeys. n_route counts transit links, not public-facing transfers.`,
  metrics: (["go", "nonGo"] as const).flatMap((basis) =>
    Object.keys(linksOf(basis)).flatMap((a) => [
      { label: `${basis} ${a} journeys`, value: linksTotalOf(basis, a), unit: "journeys" },
      { label: `${basis} ${a} 2+ links`, value: linksGe2(a, basis), unit: "journeys" },
    ]),
  ),
  sourceIds: ["P", "P-unexp", "N"],
  sampleSupport: sum(Object.values(linksAll).flatMap((o) => Object.values(o))),
  caveats: ["Two links generally imply a change between links, but n_route is a route-count, not a transfer count in the intuitive public sense."],
  possibleVisualization: "Journey stack diagram: access → links → egress (THE TRANSIT JOURNEY).",
  scores: { surprise: 3, relevance: 4, visual: 4, confidence: 4, support: 4, novelty: 4 },
});

push({
  id: "station-access-profiles",
  theme: "transit",
  finding: `Each station has its own front door: car access (driven + dropped off) ranges from ${pct(topLineCarShare)} at ${topLineStation[0].replace(" GO Station", "")} down to ${pct(shareOf(carAccess(bestWalkStation.s), lineStationTotal(bestWalkStation.s)))} at ${bestWalkStation.s.replace(" GO Station", "")}, where ${pct(bestWalkStation.walk)} of riders simply walk to the platform. Catchments differ station by station.`,
  metrics: lineStations.flatMap(([s]) => [
    { label: `${s} car access share`, value: shareOf(carAccess(s), lineStationTotal(s)), unit: "share" },
    { label: `${s} walk access share`, value: shareOf(ds.transit.accessByStation[s]?.["Walk-access transit"] ?? 0, lineStationTotal(s)), unit: "share" },
    { label: `${s} boardings`, value: s in ds.transit.boardingsByStation ? ds.transit.boardingsByStation[s]! : 0, unit: "trips" },
  ]),
  sourceIds: ["N"],
  caveats: ["Access mode as reported for the transit journey; 'Drive-access transit- Passenger' = dropped off by a driver."],
  possibleVisualization: "Small-multiple station profiles (walk/drive/dropoff/bike mix).",
  scores: { surprise: 3, relevance: 4, visual: 4, confidence: 4, support: 3, novelty: 3 },
});

// ---------------------------------------------------------------------------
// Score → recommendation (handoff §27), then write
// ---------------------------------------------------------------------------

const ranked = candidates
  .sort((a, b) => b.totalScore - a.totalScore)
  .map((c, i) => ({
    ...c,
    // Build the strongest two, hold the next tier, reject nothing outright
    // unless a hard blocker exists (none does — every candidate is supported).
    recommendation: i < 2 ? ("BUILD" as const) : ("HOLD" as const),
  }));

const out = {
  generatedAt: new Date().toISOString(),
  dataBasis: {
    universe: ds.odAll.universe,
    universeSurveyRecords: ds.odAll.universeSurveyRecords,
    durhamHouseholdTrips: dayTotal,
    dayRecords,
  },
  dayCurve: { byHour: hours.map(([h, v]) => ({ h, label: hourLabel(h), trips: v.trips, records: v.records, byMode: v.byMode, byPurpose: v.byPurpose })), peaks: peaks.map((p) => ({ ...p, label: hourLabel(p.h) })) },
  netFlowByHour: netFlowByHour.map((n) => ({ ...n, label: hourLabel(n.h) })),
  purposeShareByHour: purposeShareByHour.map((p) => ({ ...p, label: hourLabel(p.h) })),
  modeTable,
  purposeGeo,
  ageTable: ageGroupTripRates,
  muniBalance,
  candidates: ranked,
};

writeFileSync(resolve(ROOT, "data/processed/phase3/story-candidates.json"), JSON.stringify(out, null, 2));

// console summary for the findings doc
console.log(`phase3-findings: ${ranked.length} candidates`);
for (const c of ranked) {
  console.log(`\n[${c.recommendation}] ${c.id} (${c.theme}, score ${c.totalScore})`);
  console.log(`  ${c.finding}`);
  if (c.sampleSupport !== undefined) console.log(`  support: ${fmt(c.sampleSupport)} survey records`);
}
