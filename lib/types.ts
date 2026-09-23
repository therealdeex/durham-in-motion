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
  originTrips: number;
  destinationTrips: number;
  sameMunicipality: number;
  elsewhereInDurham: number;
  toronto: number;
  otherExternal: number;
  orbitShares: { same: number; durham: number; toronto: number; outside: number };
  topDestinations: OdDestinationFlow[];
  modeGroupShares: Record<OdModeGroup, number>;
  modeGroupTrips: Record<OdModeGroup, number>;
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
  profiles: OdMunicipalityProfile[];
  destinationProfiles: OdDestinationProfile[];
  modeContexts: OdModeContext[];
  comparable2022: { total: number; modes: Record<string, number>; groups: Record<OdModeGroup, number> };
  full2022Modes: { total: number; modes: Record<string, number> };
  displayThreshold: number;
  matrix: { columns: string[]; values: number[][] };
}

export type ShareStatus = "observed" | "suppressed" | "not_available" | "missing" | "partial";

export interface Share {
  value: number | null;
  status: ShareStatus;
}

export interface Profile {
  geographyId: string;
  geographyName: string;
  geographyType: "region" | "municipality" | "ward";
  municipality?: string;
  surveyYear: number;
  tripComparability: "caution" | "not_comparable";
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
  workAtHomeShare: Share;
  workersWithUsualPlace: number | null;
  torontoWorkShare: Share;
  durhamWorkShare: Share;
  childrenShare: Share;
  seniorsShare: Share;
  drivingAgeLicenceRate: Share;
}

export interface MunicipalityProfile extends Profile {
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
  points: { year: number; value: number | null; status: string }[];
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
