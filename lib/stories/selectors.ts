/**
 * Deterministic selectors over the Phase 4 story datasets. Every headline
 * number on /stories/day and /stories/transit flows through one of these
 * functions — never a literal in JSX. Pure: same input file, same answer, so
 * the golden tests in tests/data/phase4.test.ts pin the editorial claims.
 */
import {
  BROAD_PURPOSES,
  OUTSIDE_ID,
  type BroadPurpose,
  type DayBin,
  type DayStoryFile,
  type FlowScene,
  type StationProfile,
  type TransitStoryFile,
} from "./types";

// ---------------------------------------------------------------------------
// A Day in Durham
// ---------------------------------------------------------------------------

/** Bins whose start time falls inside a survey hour (4–27). */
export function binsOfHour(file: DayStoryFile, surveyHour: number): DayBin[] {
  if (surveyHour < 4 || surveyHour > 27) throw new Error(`survey hour ${surveyHour} outside the TTS day (4–27)`);
  const start = (surveyHour - file.meta.dayStartSurveyHour) * 60;
  return file.bins.filter((b) => b.t >= start && b.t < start + 60);
}

/** Expanded resident trip starts in one survey hour (e.g. getTripsByHour(f, 15) → 161,115). */
export function getTripsByHour(file: DayStoryFile, surveyHour: number): number {
  return binsOfHour(file, surveyHour).reduce((a, b) => a + b.trips, 0);
}

export interface PurposeComposition {
  counts: Record<BroadPurpose, number>;
  /** Shares of trips with a stated purpose; the residue dimension is <0.1%. */
  shares: Record<BroadPurpose, number>;
  total: number;
}

export function getPurposeCompositionByHour(file: DayStoryFile, surveyHour: number): PurposeComposition {
  const counts = Object.fromEntries(BROAD_PURPOSES.map((p) => [p, 0])) as Record<BroadPurpose, number>;
  let total = 0;
  for (const b of binsOfHour(file, surveyHour)) {
    for (const p of BROAD_PURPOSES) counts[p] += b.byPurpose[p] ?? 0;
    total += b.trips;
  }
  const stated = BROAD_PURPOSES.reduce((a, p) => a + counts[p], 0);
  const shares = Object.fromEntries(
    BROAD_PURPOSES.map((p) => [p, stated ? counts[p]! / stated : 0]),
  ) as Record<BroadPurpose, number>;
  return { counts, shares, total };
}

export interface BoundaryFlow {
  inbound: number;
  outbound: number;
  /** inbound − outbound: positive = more trips entering Durham than leaving. */
  net: number;
}

/** Balance of trips crossing the regional boundary in one survey hour (G/H basis). */
export function getNetBoundaryFlowByHour(file: DayStoryFile, surveyHour: number): BoundaryFlow {
  let inbound = 0;
  let outbound = 0;
  for (const b of binsOfHour(file, surveyHour)) {
    inbound += b.inbound;
    outbound += b.outbound;
  }
  return { inbound, outbound, net: inbound - outbound };
}

export interface DayMoment {
  bin: DayBin;
  purpose: PurposeComposition;
  boundary: BoundaryFlow;
}

/** Everything the narrative needs at one 30-minute moment (nearest bin start). */
export function getMoment(file: DayStoryFile, minutesSinceFour: number): DayMoment {
  const { binMinutes } = file.meta;
  const idx = Math.min(file.bins.length - 1, Math.max(0, Math.floor(minutesSinceFour / binMinutes)));
  const bin = file.bins[idx]!;
  const hour = Math.floor((minutesSinceFour + 4 * 60) / 60);
  return { bin, purpose: getPurposeCompositionByHour(file, hour), boundary: getNetBoundaryFlowByHour(file, hour) };
}

/** Bind one bin's map frame into the generic flow-scene contract. */
export function binToScene(file: DayStoryFile, bin: DayBin): FlowScene {
  const flows = [
    ...bin.pairs.flatMap((p): FlowScene["flows"] => [
      { originId: p.a, destinationId: p.b, value: p.v },
    ]),
    ...Object.entries(bin.outByMuni).map(([m, v]) => ({ originId: m, destinationId: OUTSIDE_ID, value: v })),
    ...Object.entries(bin.inByMuni).map(([m, v]) => ({ originId: OUTSIDE_ID, destinationId: m, value: v })),
  ];
  return { id: `t${bin.t}`, title: bin.publicLabel, flows, timestamp: bin.t };
}

/** The bin index closest to a time, clamped to the day. */
export function nearestBinIndex(file: DayStoryFile, minutesSinceFour: number): number {
  const { binMinutes } = file.meta;
  return Math.min(file.bins.length - 1, Math.max(0, Math.round(minutesSinceFour / binMinutes)));
}

// ---------------------------------------------------------------------------
// The Transit Journey
// ---------------------------------------------------------------------------

/** Boardings for every profiled station (or one by id). */
export function getStationBoardings(file: TransitStoryFile, stationId?: string): StationProfile[] {
  return stationId ? file.stations.filter((s) => s.id === stationId) : file.stations;
}

export interface AccessComposition {
  station: StationProfile;
  /** Shares of the station's boardings by access type. */
  shares: Record<AccessKeyOf, number>;
  arriveByCar: number;
}

type AccessKeyOf = keyof StationProfile["access"];

/** Access-mode shares for one station (id like "oshawa"; throws if unknown). */
export function getStationAccessComposition(file: TransitStoryFile, stationId: string): AccessComposition {
  const station = file.stations.find((s) => s.id === stationId);
  if (!station) throw new Error(`unknown station id "${stationId}"`);
  const total = Object.values(station.access).reduce((a, b) => a + b, 0);
  const shares = Object.fromEntries(
    Object.entries(station.access).map(([k, v]) => [k, total ? v / total : 0]),
  ) as Record<AccessKeyOf, number>;
  return { station, shares, arriveByCar: station.carShare };
}

export interface DestinationShare {
  name: string;
  stationId: string | null;
  trips: number;
  surveyRecords: number;
  share: number;
}

/**
 * Where GO journeys end: alighting distribution across destination stations.
 * The denominator is journeys with a stated destination station (18,734 — two
 * fewer than goJourneys, whose station field is missing).
 */
export function getGoDestinationDistribution(file: TransitStoryFile): DestinationShare[] {
  const total = file.destinations.reduce((a, d) => a + d.trips, 0);
  return file.destinations.map((d) => ({ ...d, share: total ? d.trips / total : 0 }));
}

export interface LinkDistribution {
  total: number;
  buckets: { key: "1" | "2" | "3+"; label: string; trips: number; share: number; surveyRecords: number }[];
}

/** 1 / 2 / 3+ transit-link distribution for GO or non-GO journeys. */
export function getTransitLinkDistribution(file: TransitStoryFile, kind: "go" | "nonGo"): LinkDistribution {
  const d = file.links[kind];
  const labels: Record<"1" | "2" | "3+", string> = {
    "1": "One transit link",
    "2": "Two links",
    "3+": "Three or more links",
  };
  return {
    total: d.total,
    buckets: (["1", "2", "3+"] as const).map((key) => ({
      key,
      label: labels[key],
      trips: d.byBucket[key],
      share: d.total ? d.byBucket[key]! / d.total : 0,
      surveyRecords: d.support[key] ?? 0,
    })),
  };
}

/** Station-to-station pairs above the sample-support display floor. */
export function getSupportedStationPairs(file: TransitStoryFile) {
  const floor = file.meta.displayFloor.stationPairs;
  return file.stationPairs.filter((p) => p.surveyRecords >= floor);
}

/** Union's share of GO alightings, computed (the 46.1% headline). */
export function getUnionAlightingShare(file: TransitStoryFile): { trips: number; total: number; share: number } {
  const union = file.destinations.find((d) => d.name === "Union GO");
  const total = file.destinations.reduce((a, d) => a + d.trips, 0);
  if (!union) throw new Error("Union GO missing from destinations");
  return { trips: union.trips, total, share: union.trips / total };
}
