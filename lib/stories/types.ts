/**
 * Shared contracts for the Phase 4 story pages (/stories/day,
 * /stories/transit) and the reusable flow-map engine.
 *
 * FlowFrame/FlowScene are deliberately generic: A Day in Durham binds them to
 * time bins, and a future "Every Mode Has Its Own Map" can bind the same
 * renderer to persistent mode-network states without rewriting it.
 */

/** One aggregated movement between two nodes at a moment (or in a state). */
export interface FlowFrame {
  originId: string;
  destinationId: string;
  value: number;
  /** Optional category binding (mode, purpose…) for future stories. */
  category?: string;
}

/** A complete set of flows to render: one time step or one network state. */
export interface FlowScene {
  id: string;
  title: string;
  flows: FlowFrame[];
  /** Minutes since 04:00 when the scene is temporal. */
  timestamp?: number;
}

/** Boundary pseudo-node: everything beyond Durham Region. */
export const OUTSIDE_ID = "outside-durham";

// ---------------------------------------------------------------------------
// A Day in Durham
// ---------------------------------------------------------------------------

export const BROAD_PURPOSES = [
  "Home-Based Work",
  "Home-based School",
  "Home-based Discretionary",
  "Non Home-based",
] as const;
export type BroadPurpose = (typeof BROAD_PURPOSES)[number];

/** Public-facing purpose labels (shorter than the TTS categories). */
export const PURPOSE_LABEL: Record<BroadPurpose, string> = {
  "Home-Based Work": "Work",
  "Home-based School": "School",
  "Home-based Discretionary": "Discretionary",
  "Non Home-based": "Non-home-based",
};

export type ModeKey = "drive" | "ride" | "transit" | "walk" | "cycle" | "schoolBus" | "other";

export const MODE_LABEL: Record<ModeKey, string> = {
  drive: "Drive",
  ride: "Ride",
  transit: "Transit",
  walk: "Walk",
  cycle: "Cycle",
  schoolBus: "School bus",
  other: "Other",
};

export interface DayBin {
  /** Minutes since 04:00 (bin start). */
  t: number;
  /** TTS survey label, hours ≥ 24 preserved ("25:30"). */
  surveyLabel: string;
  /** Public 12-hour label ("1:30 a.m."). */
  publicLabel: string;
  /** Resident weekday trips starting in this bin (Query F). */
  trips: number;
  surveyRecords: number;
  byPurpose: Record<BroadPurpose, number>;
  byMode: Partial<Record<ModeKey, number>>;
  /** Trips entering / leaving Durham Region in this bin (Queries G/H). */
  inbound: number;
  outbound: number;
  /** Map frame (G/H geography basis). */
  self: Record<string, number>;
  pairs: { a: string; b: string; v: number }[];
  outByMuni: Record<string, number>;
  inByMuni: Record<string, number>;
}

export interface DayStoryFile {
  meta: {
    binMinutes: number;
    binCount: number;
    dayStartSurveyHour: number;
    timeConvention: string;
    displayFloor: number;
    basis: { curve: string; curveSupport: string; boundary: string; map: string };
    sources: string[];
    provenance: string;
    /** Day-total context (all-households detailed purposes) for qualified copy. */
    context: { internalPickupDropoff: number; internalDropoffPassenger: number };
  };
  bins: DayBin[];
}

// ---------------------------------------------------------------------------
// The Transit Journey
// ---------------------------------------------------------------------------

export type AccessKey = "walk" | "drive" | "passenger" | "cycle" | "other";

export const ACCESS_LABEL: Record<AccessKey, string> = {
  walk: "Walk",
  drive: "Drive",
  passenger: "Dropped off",
  cycle: "Bicycle",
  other: "Other",
};

export interface StationProfile {
  id: string;
  name: string;
  boardings: number;
  access: Record<AccessKey, number>;
  carShare: number;
  walkShare: number;
}

export interface TransitStoryFile {
  meta: {
    basis: string;
    sources: string[];
    displayFloor: { stationPairs: number };
    stationPairsNote: string;
    accessNote: string;
    provenance: string;
  };
  totals: { journeys: number; goJourneys: number; unionBoardings: number };
  accessOverall: Record<AccessKey, number>;
  stations: StationProfile[];
  destinations: { name: string; stationId: string | null; trips: number; surveyRecords: number }[];
  stationPairs: {
    from: string;
    to: string;
    fromId: string | null;
    toId: string | null;
    trips: number;
    surveyRecords: number;
  }[];
  links: {
    go: { total: number; byBucket: Record<"1" | "2" | "3+", number>; support: Record<"1" | "2" | "3+", number> };
    nonGo: { total: number; byBucket: Record<"1" | "2" | "3+", number>; support: Record<"1" | "2" | "3+", number> };
    byAccessGo: Record<string, Record<string, number>>;
    byAccessNonGo: Record<string, Record<string, number>>;
    note: string;
  };
  catchment: { id: string; name: string; origins: Record<string, number> }[];
}
