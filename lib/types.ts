/** Types for the curated public data files in /public/data. */

export type OdModeGroup = "drive" | "ride" | "transit" | "walk" | "cycle" | "schoolBus" | "other";

export interface OdPairFlow {
  a: string;
  b: string;
  aToB: number;
  bToA: number;
  totalTwoWay: number;
}

export interface OdDestinationFlow {
  destinationId: string;
  destinationName: string;
  group: "same" | "durham" | "toronto" | "outside";
  groupLabel: string;
  trips: number;
  share: number;
}

export interface OdMunicipalityProfile {
  id: string;
  name: string;
  /** Expanded weekday trips ORIGINATING in this municipality (Durham-household members). */
  originTrips: number;
  /** Expanded weekday trips by Durham-household members ENDING in this
   *  municipality — includes trips that started here; not all inbound visitors. */
  destinationTrips: number;
  sameMunicipality: number;
  elsewhereInDurham: number;
  toronto: number;
  otherExternal: number;
  orbitShares: { same: number; durham: number; toronto: number; outside: number };
  /** Complete aggregated outbound distribution, sorted by trips (unique keys). */
  destinations: OdDestinationFlow[];
  /** Display slice of `destinations`. */
  topDestinations: OdDestinationFlow[];
  modeGroupShares: Record<OdModeGroup, number>;
  modeGroupTrips: Record<OdModeGroup, number>;
}

/** Region-level orbit over Durham-origin trips (same scope as municipal orbits). */
export interface OdRegionProfile {
  sameMunicipality: number;
  elsewhereInDurham: number;
  toronto: number;
  elsewhereSurveyArea: number;
  beyondSurveyArea: number;
  durhamOriginTrips: number;
  orbitShares: { same: number; durham: number; toronto: number; outside: number };
  destinations: Omit<OdDestinationFlow, "share" | "groupLabel">[];
}

/** Mutually exclusive composition of ALL Durham-household trips. */
export interface OdLocalComposition {
  sameMunicipality: number;
  betweenDurhamMunicipalities: number;
  outsideInvolving: number;
  totalTrips: number;
}

export interface OdDestinationProfile {
  id: string;
  name: string;
  trips: number;
  fromDurham: number;
  fromToronto: number;
  fromOutside: number;
}

export interface OdModeContext {
  key: string;
  label: string;
  description: string;
  trips: number;
  groups: Record<OdModeGroup, number>;
  disjoint: boolean;
}

export interface OdFlows {
  generatedAt: string;
  provenance: Record<string, string | boolean | string[]>;
  modeGroups: Record<OdModeGroup, string>;
  totals: {
    allTrips: number;
    internalTrips: number;
    internalShare: number;
    toToronto: number;
    fromToronto: number;
    toOutside: number;
    durhamOriginTrips: number;
  };
  pairs: OdPairFlow[];
  regionProfile: OdRegionProfile;
  localComposition: OdLocalComposition;
  profiles: OdMunicipalityProfile[];
  destinationProfiles: OdDestinationProfile[];
  modeContexts: OdModeContext[];
  comparable2022: { total: number; modes: Record<string, number>; groups: Record<OdModeGroup, number> };
  full2022Modes: { total: number; modes: Record<string, number> };
  display: {
    floor: number;
    appliesTo: string[];
    note: string;
  };
  matrix: {
    rowIds: string[];
    columnIds: string[];
    rowLabels: string[];
    columnLabels: string[];
    values: number[][];
  };
}

export type ShareStatus = "observed" | "suppressed" | "not_available" | "missing" | "partial";

export interface Share {
  value: number | null;
  status: ShareStatus;
}

/**
 * Status conventions (scripts/lib/estimates.ts):
 *  - status "observed" → value is a complete estimate;
 *  - status "partial" with a value → observed subtotal, an approximate
 *    lower bound (a suppressed/not-collected component is excluded);
 *  - status "partial" with null → withheld: an incomplete denominator (or a
 *    suppressed cell shared by numerator and denominator) makes the share
 *    non-computable without inventing a bias direction;
 *  - suppressed / not_available / missing → value null, source state kept.
 */

export interface Profile {
  geographyId: string;
  geographyName: string;
  geographyType: "region" | "municipality" | "ward";
  municipality?: string;
  surveyYear: number;
  tripComparability: "caution" | "not_comparable";
  tripBasisId: string;
  households: number | null;
  persons: number | null;
  drivers: number | null;
  avgVehiclesPerHousehold: number | null;
  avgPersonsPerHousehold: number | null;
  zeroVehicleHouseholdShare: Share;
  vehicleCounts: Record<string, number | null>;
  tripsTotal: number | null;
  modes: {
    autoDriver: number | null;
    autoPassenger: number | null;
    transitLocal: number | null;
    goRail: number | null;
    jointGoTransit: number | null;
    walk: number | null;
    bicycle: number | null;
    schoolBus: number | null;
    motorcycle: number | null;
    taxi: number | null;
    rideshare: number | null;
    escooter: number | null;
    other: number | null;
  };
  modeShares: {
    autoDriver: Share;
    autoPassenger: Share;
    transit: Share;
    walk: Share;
    bicycle: Share;
    schoolBus: Share;
    otherMisc: Share;
  };
  modeSuppressed: boolean;
  amPeakShare: Share;
  purposes: { hbw: number | null; hbs: number | null; hbd: number | null; nhb: number | null };
  employed: number | null;
  employedPartial: boolean;
  workAtHomeShare: Share;
  workersWithUsualPlace: number | null;
  workersWithUsualPlacePartial: boolean;
  torontoWorkShare: Share;
  durhamWorkShare: Share;
  childrenShare: Share;
  seniorsShare: Share;
  drivingAgeLicenceRate: Share;
}

/** Explicit 2016 endpoints for municipal change stories. */
export interface Prior2016 {
  workAtHomeShare: Share;
  zeroVehicleHouseholdShare: Share;
  torontoWorkShare: Share;
  seniorsShare: Share;
  persons: number | null;
  households: number | null;
  avgVehiclesPerHousehold: number | null;
  modeShares: { autoDriver: Share; transit: Share; walk: Share };
}

export interface MunicipalityProfile extends Profile {
  prior2016: Prior2016;
  change2016to2022: {
    persons: number | null;
    households: number | null;
    avgVehiclesPerHousehold: number | null;
    zeroVehicleHouseholdShare: number | null;
    workAtHomeShare: number | null;
    torontoWorkShare: number | null;
    seniorsShare: number | null;
  };
  ranks: {
    transitShare: number | null;
    zeroVehicleShare: number | null;
    walkShare: number | null;
    vehiclesPerHousehold: number | null;
    torontoWorkShare: number | null;
  };
}

export interface RegionSummary {
  generatedAt: string;
  profiles: Profile[];
}

export interface TrendSeries {
  id: string;
  label: string;
  unit: "persons" | "households" | "vehicles" | "percent" | "trips";
  comparability: "strong" | "caution" | "not_comparable";
  note: string;
  anchorBasis: string;
  points: { year: number; value: number | null; status: string; basisId: string; comparable: boolean }[];
}

export interface HistoricalTrends {
  generatedAt: string;
  methodologyBreak: { year: number; summary: string };
  series: TrendSeries[];
}

export interface MunicipalitiesFile {
  generatedAt: string;
  region: Profile;
  municipalities: MunicipalityProfile[];
}

export interface WardsFile {
  generatedAt: string;
  region: Profile;
  wards: Profile[];
}

export interface GeographyEntry {
  id: string;
  name: string;
  type: "region" | "municipality" | "ward";
  municipality?: string;
  surveyYears: number[];
}

export interface SourceRecord {
  id: string;
  title: string;
  organization: string;
  surveyYear: number;
  geography: string;
  url: string;
  landingPage: string;
  licence: string;
  licenceUrl: string;
  downloadedAt: string | null;
  sha256: string | null;
  supplementaryOnly: boolean;
  note: string | null;
}

export interface Manifest {
  generatedAt: string;
  project: string;
  attribution: string;
  endorsement: string;
  sources: SourceRecord[];
}

/** The eight area municipalities, in geographic north→south order. */
export const MUNICIPALITY_ORDER = [
  "brock",
  "uxbridge",
  "scugog",
  "pickering",
  "ajax",
  "whitby",
  "oshawa",
  "clarington",
] as const;

// --------------------------------------------------------------------------
// insights.json (generated by scripts/build-insights.ts)
// --------------------------------------------------------------------------

export interface InsightBase {
  id: string;
  question: string;
  takeaway: string;
  universe: string;
  denominatorNote: string;
  basis: string;
  caveats: string[];
  sourceIds: string[];
}

export interface InsightsFile {
  generatedAt: string;
  note: string;
  insights: (InsightBase & { values: Record<string, unknown> })[];
  unavailable: { question: string; reason: string }[];
}
