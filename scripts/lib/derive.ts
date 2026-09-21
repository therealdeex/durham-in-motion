/**
 * Deterministic derived measures over the normalized records.
 *
 * Rules:
 *  - Shares are value/total with the published total as denominator.
 *    Suppressed members yield a suppressed share — never redistributed
 *    or reverse-engineered from totals.
 *  - Top-coded categories ("5 or more") count as 5 for means; the assumption
 *    is stated in the methodology page. It biases means slightly low, equally
 *    for every geography, so comparisons remain fair.
 *  - "transit" = local transit + GO Rail + joint GO/transit trips.
 */
import type { NormalizedRecord } from "./read-files.ts";

export type ShareStatus = "observed" | "suppressed" | "not_available" | "missing" | "partial";

export interface Share {
  value: number | null;
  status: ShareStatus;
}

const observed = (r: NormalizedRecord | undefined): number | null =>
  r && r.status === "observed" ? r.value : null;

const share = (numerator: number | null, denominator: number | null): Share => {
  if (numerator === null) return { value: null, status: "suppressed" };
  if (denominator === null || denominator === 0) return { value: null, status: "missing" };
  return { value: numerator / denominator, status: "observed" };
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
  /** Trip measures from this cycle: 2022 is not comparable with earlier cycles. */
  tripComparability: "caution" | "not_comparable";
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
  /** Any suppressed mode cell — the modeShares will not sum to 1. */
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

const record = (recs: NormalizedRecord[], pred: (r: NormalizedRecord) => boolean) =>
  observed(recs.find(pred));

interface CatSum {
  value: number | null;
  /** True when some present cells were suppressed (fewer than 4 records). */
  partial: boolean;
}

/**
 * Sum over category cells, tolerating suppressed small cells: their values are
 * unknown, so the sum is incomplete — callers must surface `partial` in the
 * share status rather than presenting the result as exact.
 */
const catSumFlagged = (recs: NormalizedRecord[], metric: string, cats: string[]): CatSum => {
  let sum = 0;
  let anyPresent = false;
  let partial = false;
  for (const c of cats) {
    const cell = recs.find((r) => r.metric === metric && r.category === c);
    if (!cell) continue; // category not collected this cycle
    anyPresent = true;
    if (cell.status === "observed" && cell.value !== null) {
      sum += cell.value;
    } else if (cell.status === "suppressed") {
      partial = true;
    } else {
      partial = true;
    }
  }
  return { value: anyPresent ? sum : null, partial };
};

const catSum = (recs: NormalizedRecord[], metric: string, cats: string[]): number | null =>
  catSumFlagged(recs, metric, cats).value;

const weightedMean = (
  recs: NormalizedRecord[],
  metric: string,
): number | null => {
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

export function deriveProfile(recs: NormalizedRecord[]): DerivedProfile {
  const households = record(recs, (r) => r.domain === "household" && r.metric === "total");
  const persons = record(recs, (r) => r.domain === "person" && r.metric === "total");

  const modeValue = (m: string) =>
    record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === m);
  const modes: ModeBreakdown = {
    autoDriver: modeValue("auto_driver"),
    autoPassenger: modeValue("auto_passenger"),
    transitLocal: modeValue("transit_local"),
    goRail: modeValue("go_rail"),
    jointGoTransit: modeValue("joint_go_transit"),
    walk: modeValue("walk"),
    bicycle: modeValue("bicycle"),
    schoolBus: modeValue("school_bus"),
    motorcycle: modeValue("motorcycle"),
    taxi: modeValue("taxi"),
    rideshare: modeValue("rideshare"),
    escooter: modeValue("escooter"),
    other: modeValue("other"),
  };
  const unknownMode = modeValue("unknown_mode") ?? 0;
  const transitTotal =
    modes.transitLocal !== null && modes.goRail !== null && modes.jointGoTransit !== null
      ? modes.transitLocal + modes.goRail + modes.jointGoTransit
      : null;

  const tripsTotal = record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "total");
  const tripComparability = recs.find((r) => r.domain === "trip")?.comparability === "not_comparable"
    ? "not_comparable" as const
    : "caution" as const;

  const shareOf = (num: number | null) => share(num, tripsTotal);
  const modeSuppressed = MODE_METRICS.some(
    (m) => recs.find((r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === m)?.status === "suppressed",
  );

  const employedFt = record(recs, (r) => r.metric === "employment" && r.category === "full_time");
  const employedPt = record(recs, (r) => r.metric === "employment" && r.category === "part_time");
  const homeFt = record(recs, (r) => r.metric === "employment" && r.category === "full_time_at_home");
  const homePt = record(recs, (r) => r.metric === "employment" && r.category === "part_time_at_home");
  const atHomeNum =
    homeFt !== null || homePt !== null ? (homeFt ?? 0) + (homePt ?? 0) : null;
  const atHomePartial = homeFt === null || homePt === null;
  const employmentCells = [employedFt, employedPt, homeFt, homePt];
  const employedNum = employmentCells.some((v) => v !== null)
    ? employmentCells.reduce<number>((a, v) => a + (v ?? 0), 0)
    : null;
  const employedPartial = employmentCells.some((v) => v === null);
  // Exposed as the employed-persons denominator; partial when a small cell
  // (e.g. part-time-at-home in 1986) was suppressed.
  const employed = employedNum;
  const employedIsPartial = employedPartial;

  const LOCATIONS = [
    "toronto", "durham", "york", "peel", "halton", "hamilton", "niagara", "waterloo",
    "guelph", "wellington", "orangeville", "barrie", "simcoe", "kawartha_lakes",
    "peterborough_city", "peterborough_county", "orillia", "dufferin", "brantford",
    "brant", "northumberland", "blue_mountains", "grey",
  ];
  const placeSum = catSumFlagged(recs, "work_location", LOCATIONS);
  const workersWithUsualPlace = placeSum.value;
  const torontoWorkers = record(recs, (r) => r.metric === "work_location" && r.category === "toronto");
  const durhamWorkers = record(recs, (r) => r.metric === "work_location" && r.category === "durham");
  const withPartial = (num: number | null, den: number | null): Share => {
    const s = share(num, den);
    return placeSum.partial && s.value !== null ? { ...s, status: "partial" as const } : s;
  };

  const vehicleCounts: Record<string, number | null> = {};
  for (const c of ["0", "1", "2", "3", "4", "5plus"]) {
    vehicleCounts[c] = record(recs, (r) => r.domain === "household" && r.metric === "vehicles" && r.category === c);
  }

  return {
    geographyId: recs[0].geographyId,
    geographyName: recs[0].geographyName,
    geographyType: recs[0].geographyType,
    municipality: recs[0].geographyType === "ward" ? recs[0].geographyId.replace(/-ward-\d+$/, "") : undefined,
    surveyYear: recs[0].surveyYear,
    tripComparability,
    households,
    persons,
    drivers: record(recs, (r) => r.domain === "person" && r.metric === "licence" && r.category === "with"),
    avgVehiclesPerHousehold: weightedMean(recs, "vehicles"),
    avgPersonsPerHousehold: weightedMean(recs, "size"),
    zeroVehicleHouseholdShare: share(vehicleCounts["0"], households),
    vehicleCounts,
    tripsTotal,
    modes,
    modeShares: {
      autoDriver: shareOf(modes.autoDriver),
      autoPassenger: shareOf(modes.autoPassenger),
      transit: shareOf(transitTotal),
      walk: shareOf(modes.walk),
      bicycle: shareOf(modes.bicycle),
      schoolBus: shareOf(modes.schoolBus),
      otherMisc: shareOf(
        [modes.motorcycle, modes.taxi, modes.rideshare, modes.escooter, modes.other]
          .some((v) => v === null)
          ? null
          : modes.motorcycle! + modes.taxi! + modes.rideshare! + modes.escooter! + modes.other! + unknownMode,
      ),
    },
    modeSuppressed,
    amPeakShare: share(
      record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "am_peak" && r.metric === "total"),
      tripsTotal,
    ),
    purposes: {
      hbw: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "hbw"),
      hbs: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "hbs"),
      hbd: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "hbd"),
      nhb: record(recs, (r) => r.domain === "trip" && r.direction === "residents" && r.period === "all_day" && r.metric === "purpose" && r.category === "nhb"),
    },
    employed,
    workAtHomeShare: (() => {
      // A suppressed part-time-at-home cell (1986) leaves the numerator
      // slightly low: report as partial rather than hiding the year.
      const s = share(atHomeNum, employed);
      if (s.value !== null && (atHomePartial || employedIsPartial)) {
        return { ...s, status: "partial" as const };
      }
      return s;
    })(),
    workersWithUsualPlace,
    torontoWorkShare: withPartial(torontoWorkers, workersWithUsualPlace),
    durhamWorkShare: withPartial(durhamWorkers, workersWithUsualPlace),
    childrenShare: (() => {
      const c = catSumFlagged(recs, "age", AGE_CHILDREN);
      const s = share(c.value, persons);
      return c.partial && s.value !== null ? { ...s, status: "partial" as const } : s;
    })(),
    seniorsShare: (() => {
      const c = catSumFlagged(recs, "age", AGE_SENIORS);
      const s = share(c.value, persons);
      return c.partial && s.value !== null ? { ...s, status: "partial" as const } : s;
    })(),
    drivingAgeLicenceRate: share(
      record(recs, (r) => r.domain === "person" && r.metric === "licence" && r.category === "with"),
      catSum(recs, "licence", ["with", "without"]),
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
