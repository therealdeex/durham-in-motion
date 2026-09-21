/** Types for the curated public data files in /public/data. */

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
