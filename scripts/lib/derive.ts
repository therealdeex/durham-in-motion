/**
 * Deterministic derived measures over the normalized records.
 *
 * All arithmetic goes through scripts/lib/estimates.ts so source states
 * (observed / suppressed / not_available / missing) survive aggregation and
 * division:
 *  - shares use the published total as denominator when that total is
 *    itself observed; suppressed members are never redistributed and never
 *    reverse-engineered from totals;
 *  - a share over a partially observed numerator is an approximate lower
 *    bound (status "partial", value kept);
 *  - a share whose denominator is incomplete is withheld (value null) —
 *    the direction of its bias is unknown;
 *  - an entirely unobserved category set produces no numeric aggregate,
 *    never zero.
 *
 * "transit" = local transit + GO Rail + joint GO/transit trips.
 * Top-coded counts ("5 or more") count as 5 for means. That biases means
 * low; the bias need not be identical across communities, so comparisons
 * are directionally fair but not exact.
 */
import type { NormalizedRecord } from "./read-files.ts";
import type { Estimate } from "./estimates.ts";
import { ratioEstimate, sumEstimates, type Cell } from "./estimates.ts";

export type ShareStatus = Estimate["status"];

/** Display-facing shape kept for compatibility with lib/types.ts. */
export interface Share {
  value: number | null;
  status: ShareStatus;
}

const asShare = (e: Estimate): Share => ({ value: e.value, status: e.status });

/** A cell for estimates arithmetic: absent record → null (structurally excluded). */
const cell = (recs: NormalizedRecord[], pred: (r: NormalizedRecord) => boolean): Cell => {
  const r = recs.find(pred);
  if (!r) return null;
  if (r.status === "observed") {
    if (r.value === null || !Number.isFinite(r.value) || r.value < 0) return { value: null, status: "missing" };
    return { value: r.value, status: "observed" };
  }
  return { value: null, status: r.status };
};

const topCode = 5;

export interface ModeBreakdown {
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
}

export interface DerivedProfile {
  geographyId: string;
  geographyName: string;
  geographyType: "region" | "municipality" | "ward";
  municipality?: string;
  surveyYear: number;
  /** Trip measures from this cycle: 2022 and 1986 bases are not comparable with 1991–2016. */
  tripComparability: "caution" | "not_comparable";
  /** Trip-collection basis id (scripts/lib/compatibility.ts); demographics otherwise. */
  tripBasisId: string;
  households: number | null;
  persons: number | null;
  drivers: number | null;
  avgVehiclesPerHousehold: number | null;
  avgPersonsPerHousehold: number | null;
  zeroVehicleHouseholdShare: Share;
  vehicleCounts: Record<string, number | null>;
  tripsTotal: number | null;
  modes: ModeBreakdown;
  modeShares: {
    autoDriver: Share; autoPassenger: Share; transit: Share; walk: Share;
    bicycle: Share; schoolBus: Share; otherMisc: Share;
  };
  /** Any mode cell suppressed or absent-with-residue — modeShares may not sum to 1. */
  modeSuppressed: boolean;
  amPeakShare: Share;
  purposes: { hbw: number | null; hbs: number | null; hbd: number | null; nhb: number | null };
  employed: number | null;
  /** True when `employed` is an observed subtotal rather than a complete sum. */
  employedPartial: boolean;
  workAtHomeShare: Share;
  workersWithUsualPlace: number | null;
  /** True when the usual-workplace denominator is incomplete (a location cell suppressed/absent). */
  workersWithUsualPlacePartial: boolean;
  torontoWorkShare: Share;
  durhamWorkShare: Share;
  childrenShare: Share;
  seniorsShare: Share;
  drivingAgeLicenceRate: Share;
}

const record = (recs: NormalizedRecord[], pred: (r: NormalizedRecord) => boolean): number | null => {
  const r = recs.find(pred);
  return r && r.status === "observed" ? r.value : null;
};

/** Sum over present category cells; structurally absent categories are excluded. */
const catSum = (recs: NormalizedRecord[], metric: string, cats: string[]): Estimate =>
  sumEstimates(cats.map((c) => cell(recs, (r) => r.metric === metric && r.category === c)));

/**
 * Weighted mean over an exhaustive category set. Requires every cell
 * observed — a suppressed cell inside a mean has unknowable direction.
 */
const weightedMean = (recs: NormalizedRecord[], metric: string): number | null => {
  let weighted = 0;
  let total = 0;
  for (const cat of ["0", "1", "2", "3", "4", "5plus"]) {
    const v = record(recs, (r) => r.metric === metric && r.category === cat);
    if (v === null) return null;
    weighted += v * (cat === "5plus" ? topCode : Number(cat));
    total += v;
  }
  return total > 0 ? weighted / total : null;
};

const AGE_CHILDREN = ["0_4", "5_9", "10_14"];
const AGE_SENIORS = ["65_69", "70_74", "75_79", "80_84", "85_89", "90_94", "95_98"];

const MODE_METRICS = [
  "auto_driver", "auto_passenger", "transit_local", "go_rail", "joint_go_transit",
  "walk", "bicycle", "school_bus", "motorcycle", "taxi", "rideshare", "escooter",
  "other", "unknown_mode",
] as const;

const WORK_LOCATIONS = [
  "toronto", "durham", "york", "peel", "halton", "hamilton", "niagara", "waterloo",
  "guelph", "wellington", "orangeville", "barrie", "simcoe", "kawartha_lakes",
  "peterborough_city", "peterborough_county", "orillia", "dufferin", "brantford",
  "brant", "northumberland", "blue_mountains", "grey",
];

export function deriveProfile(recs: NormalizedRecord[]): DerivedProfile {
  if (recs.length === 0) throw new Error("deriveProfile: no records");
  const households = record(recs, (r) => r.domain === "household" && r.metric === "total");
  const persons = record(recs, (r) => r.domain === "person" && r.metric === "total");

  const modeCell = (m: string) =>
    cell(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === m);
  const modes: ModeBreakdown = {
    autoDriver: modeCell("auto_driver")?.value ?? null,
    autoPassenger: modeCell("auto_passenger")?.value ?? null,
    transitLocal: modeCell("transit_local")?.value ?? null,
    goRail: modeCell("go_rail")?.value ?? null,
    jointGoTransit: modeCell("joint_go_transit")?.value ?? null,
    walk: modeCell("walk")?.value ?? null,
    bicycle: modeCell("bicycle")?.value ?? null,
    schoolBus: modeCell("school_bus")?.value ?? null,
    motorcycle: modeCell("motorcycle")?.value ?? null,
    taxi: modeCell("taxi")?.value ?? null,
    rideshare: modeCell("rideshare")?.value ?? null,
    escooter: modeCell("escooter")?.value ?? null,
    other: modeCell("other")?.value ?? null,
  };
  const transitTotal = sumEstimates([modeCell("transit_local"), modeCell("go_rail"), modeCell("joint_go_transit")]);

  const tripsTotalCell = cell(
    recs,
    (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "total",
  );
  const tripsTotal = tripsTotalCell?.value ?? null;
  const anyTripRecord = recs.find((r) => r.domain === "trip");
  const tripComparability = anyTripRecord?.comparability === "not_comparable" ? "not_comparable" : "caution";
  const tripBasisId = anyTripRecord?.basisId ?? "demographics";

  // "Other" collects the residual mode categories plus unknown-mode trips.
  // unknown_mode is structurally absent in cycles that did not report it —
  // then it simply contributes no cell. When present but suppressed, the
  // sum is a lower bound, as with any suppressed category member.
  const otherMisc = sumEstimates([
    modeCell("motorcycle"), modeCell("taxi"), modeCell("rideshare"),
    modeCell("escooter"), modeCell("other"), modeCell("unknown_mode"),
  ]);

  const shareOf = (e: Estimate) => asShare(ratioEstimate(e, tripsTotalCell ?? { value: null, status: "missing" }));
  const modeSuppressed = MODE_METRICS.some(
    (m) =>
      recs.find(
        (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === m,
      )?.status === "suppressed",
  );

  // Employment: numerator = usually-work-at-home persons, denominator = all
  // employed persons. A suppressed cell in either (1986's part-time-at-home)
  // makes that side a lower bound; a suppressed *denominator* cell withholds
  // the share entirely because numerator and denominator would miss the same
  // unknown quantity.
  const employedFt = cell(recs, (r) => r.metric === "employment" && r.category === "full_time");
  const employedPt = cell(recs, (r) => r.metric === "employment" && r.category === "part_time");
  const homeFt = cell(recs, (r) => r.metric === "employment" && r.category === "full_time_at_home");
  const homePt = cell(recs, (r) => r.metric === "employment" && r.category === "part_time_at_home");
  const employedEstimate = sumEstimates([employedFt, employedPt, homeFt, homePt]);
  const employed = employedEstimate.value;
  const employedPartial = employedEstimate.status === "partial";
  const atHome = sumEstimates([homeFt, homePt]);

  const placeSum = catSum(recs, "work_location", WORK_LOCATIONS);
  // "Workers with a usual workplace inside the surveyed area" is the sum of
  // the 23 area cells — at municipal level at least one small cell is always
  // suppressed, so that sum is never complete and cannot serve as a share
  // denominator (bias direction unknown). It is kept as a diagnostic; the
  // published commute shares use the complete employed-persons denominator.
  const workersWithUsualPlace = placeSum.value;
  const workersWithUsualPlacePartial = placeSum.status !== "observed" && placeSum.value !== null;
  const torontoWorkers = cell(recs, (r) => r.metric === "work_location" && r.category === "toronto");
  const durhamWorkers = cell(recs, (r) => r.metric === "work_location" && r.category === "durham");

  const vehicleCounts: Record<string, number | null> = {};
  for (const c of ["0", "1", "2", "3", "4", "5plus"]) {
    vehicleCounts[c] = record(recs, (r) => r.domain === "household" && r.metric === "vehicles" && r.category === c);
  }

  const licenceDenominator = catSum(recs, "licence", ["with", "without"]);

  return {
    geographyId: recs[0]!.geographyId,
    geographyName: recs[0]!.geographyName,
    geographyType: recs[0]!.geographyType,
    municipality:
      recs[0]!.geographyType === "ward" ? recs[0]!.geographyId.replace(/-ward-\d+$/, "") : undefined,
    surveyYear: recs[0]!.surveyYear,
    tripComparability,
    tripBasisId,
    households,
    persons,
    drivers: record(recs, (r) => r.domain === "person" && r.metric === "licence" && r.category === "with"),
    avgVehiclesPerHousehold: weightedMean(recs, "vehicles"),
    avgPersonsPerHousehold: weightedMean(recs, "size"),
    zeroVehicleHouseholdShare: asShare(
      ratioEstimate(
        cell(recs, (r) => r.domain === "household" && r.metric === "vehicles" && r.category === "0")
          ?? { value: null, status: "missing" },
        cell(recs, (r) => r.domain === "household" && r.metric === "total") ?? { value: null, status: "missing" },
      ),
    ),
    vehicleCounts,
    tripsTotal,
    modes,
    modeShares: {
      autoDriver: shareOf(modeCell("auto_driver") ?? { value: null, status: "missing" }),
      autoPassenger: shareOf(modeCell("auto_passenger") ?? { value: null, status: "missing" }),
      transit: shareOf(transitTotal),
      walk: shareOf(modeCell("walk") ?? { value: null, status: "missing" }),
      bicycle: shareOf(modeCell("bicycle") ?? { value: null, status: "missing" }),
      schoolBus: shareOf(modeCell("school_bus") ?? { value: null, status: "missing" }),
      otherMisc: shareOf(otherMisc),
    },
    modeSuppressed,
    amPeakShare: asShare(
      ratioEstimate(
        cell(
          recs,
          (r) => r.domain === "trip" && r.direction === "residents" && r.period === "am_peak" && r.metric === "total",
        ) ?? { value: null, status: "missing" },
        tripsTotalCell ?? { value: null, status: "missing" },
      ),
    ),
    purposes: {
      hbw: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "hbw"),
      hbs: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "hbs"),
      hbd: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "hbd"),
      nhb: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "nhb"),
    },
    employed,
    employedPartial,
    workAtHomeShare: asShare(ratioEstimate(atHome, employedEstimate)),
    workersWithUsualPlace,
    workersWithUsualPlacePartial,
    torontoWorkShare: asShare(ratioEstimate(torontoWorkers ?? { value: null, status: "missing" }, employedEstimate)),
    durhamWorkShare: asShare(ratioEstimate(durhamWorkers ?? { value: null, status: "missing" }, employedEstimate)),
    childrenShare: asShare(ratioEstimate(catSum(recs, "age", AGE_CHILDREN), cell(recs, (r) => r.domain === "person" && r.metric === "total") ?? { value: null, status: "missing" })),
    seniorsShare: asShare(ratioEstimate(catSum(recs, "age", AGE_SENIORS), cell(recs, (r) => r.domain === "person" && r.metric === "total") ?? { value: null, status: "missing" })),
    drivingAgeLicenceRate: asShare(
      ratioEstimate(
        cell(recs, (r) => r.domain === "person" && r.metric === "licence" && r.category === "with")
          ?? { value: null, status: "missing" },
        licenceDenominator,
      ),
    ),
  };
}

export const groupByGeographyYear = (records: NormalizedRecord[]): Map<string, NormalizedRecord[]> => {
  const map = new Map<string, NormalizedRecord[]>();
  for (const r of records) {
    const key = `${r.surveyYear}|${r.geographyId}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
};
