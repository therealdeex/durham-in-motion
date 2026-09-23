/**
 * Metric registry — the single source of truth for labels, colours,
 * denominators and formatting rules across map, profile, ranking, narrative
 * and export (audit A08: components previously defined their own meanings).
 *
 * Rules encoded here:
 *  - every share names its population/denominator;
 *  - one canonical mode palette/order/label set;
 *  - percent shares carry one decimal by default; share changes are signed
 *    percentage points; ratios carry two decimals with their unit;
 *  - statuses travel with values — presentation branches on them, never
 *    discards them.
 */
import type { Profile, Share } from "./types";

export interface ModeDef {
  id: "autoDriver" | "autoPassenger" | "transit" | "walk" | "bicycle" | "schoolBus" | "otherMisc";
  label: string;
  color: string;
  blurb: string;
}

/** Canonical mode order/labels/colours for every mode display on the site. */
export const MODES: ModeDef[] = [
  {
    id: "autoDriver",
    label: "Car driver",
    color: "var(--color-auto-driver)",
    blurb: "Trips where the person is driving a private car, truck or van.",
  },
  {
    id: "autoPassenger",
    label: "Car passenger",
    color: "var(--color-auto-passenger)",
    blurb: "Riding as a passenger in a private vehicle — carpooling, getting dropped off, sharing a ride.",
  },
  {
    id: "transit",
    label: "Transit",
    color: "var(--color-transit)",
    blurb: "Local transit (Durham Region Transit), GO trains and buses, and trips combining both.",
  },
  {
    id: "walk",
    label: "Walk",
    color: "var(--color-walk)",
    blurb: "Trips made entirely on foot. The 2022 survey captured walking trips more completely than earlier cycles.",
  },
  {
    id: "bicycle",
    label: "Cycle",
    color: "var(--color-bicycle)",
    blurb: "Trips by bicycle, including e-bikes.",
  },
  {
    id: "schoolBus",
    label: "School bus",
    color: "var(--color-school-bus)",
    blurb: "Yellow-bus trips, mostly to and from school.",
  },
  {
    id: "otherMisc",
    label: "Other",
    color: "var(--color-other-misc)",
    blurb: "Motorcycles, taxis, ride-hailing, e-scooters and everything else.",
  },
];

/** OD editorial mode groups map onto the same canonical labels. */
export const OD_MODE_LABEL: Record<string, string> = {
  drive: "Car driver",
  ride: "Car passenger",
  transit: "Transit",
  walk: "Walk",
  cycle: "Cycle",
  schoolBus: "School bus",
  other: "Other",
};

export interface MetricDef {
  id: string;
  label: string;
  short: string;
  unit: "percent" | "vehicles";
  /** The denominator sentence every display of this metric must carry. */
  denominatorLabel: string;
  domain: [number, number];
  get: (p: Profile) => number | null;
  format: (v: number | null) => string;
  colors: [string, string, string, string, string];
  sentence: (p: Profile, region: Profile) => string;
}

const fmtPct0 = (v: number | null) => (v === null ? "not computable" : `${(v * 100).toFixed(0)}%`);

/** Choropleth + ranking metrics with explicit denominators (A08). */
export const MAP_METRICS: MetricDef[] = [
  {
    id: "transit",
    label: "Transit share of weekday trips",
    short: "Transit share",
    unit: "percent",
    denominatorLabel: "of weekday trips by residents",
    domain: [0, 0.05],
    get: (p) => p.modeShares.transit.value,
    format: fmtPct0,
    colors: ["#1d2f33", "#175e56", "#0f8b7f", "#5cc9b6", "#c9f5e8"],
    sentence: (p, r) => {
      const t = p.modeShares.transit;
      if (t.value === null) return `Transit's share here could not be computed from the published cells. Region-wide it is ${(r.modeShares.transit.value! * 100).toFixed(1)}%.`;
      const rT = r.modeShares.transit.value ?? 0;
      if (t.value >= rT * 1.15) return `Transit carries ${(t.value * 100).toFixed(1)}% of weekday trips here — noticeably above the regional ${(rT * 100).toFixed(1)}%.`;
      if (t.value <= rT * 0.6) return `Transit carries ${(t.value * 100).toFixed(1)}% of weekday trips here — well below the regional ${(rT * 100).toFixed(1)}%.`;
      return `Transit carries ${(t.value * 100).toFixed(1)}% of weekday trips here, close to the regional ${(rT * 100).toFixed(1)}%.`;
    },
  },
  {
    id: "vehicles",
    label: "Vehicles per household",
    short: "Vehicles / household",
    unit: "vehicles",
    denominatorLabel: "per household (mean; '5 or more' counted as 5)",
    domain: [1.4, 2.2],
    get: (p) => p.avgVehiclesPerHousehold,
    format: (v) => (v === null ? "not computable" : v.toFixed(2)),
    colors: ["#33261d", "#7d4a2a", "#b06c35", "#d99a55", "#f7d8a8"],
    sentence: (p, r) => {
      if (p.avgVehiclesPerHousehold === null) return "Household vehicle ownership here could not be computed from the published cells.";
      const rr = r.avgVehiclesPerHousehold;
      if (rr !== null && p.avgVehiclesPerHousehold >= rr + 0.15)
        return `Households here own ${p.avgVehiclesPerHousehold.toFixed(2)} vehicles on average — among the highest in Durham (region ${rr.toFixed(2)}).`;
      if (rr !== null && p.avgVehiclesPerHousehold <= rr - 0.15)
        return `Households here own ${p.avgVehiclesPerHousehold.toFixed(2)} vehicles on average — among the lowest in Durham (region ${rr.toFixed(2)}).`;
      return `Households here own ${p.avgVehiclesPerHousehold.toFixed(2)} vehicles on average (region ${rr?.toFixed(2) ?? "—"}).`;
    },
  },
  {
    id: "zeroVehicle",
    label: "Households with no vehicle",
    short: "No-vehicle households",
    unit: "percent",
    denominatorLabel: "of households",
    domain: [0, 0.09],
    get: (p) => p.zeroVehicleHouseholdShare.value,
    format: fmtPct0,
    colors: ["#25172e", "#4c2d63", "#784491", "#a76fc0", "#e3c8f0"],
    sentence: (p) => {
      const z = p.zeroVehicleHouseholdShare;
      if (z.value === null) return "The no-vehicle share here could not be computed from the published cells.";
      return `${(z.value * 100).toFixed(1)}% of households here have no vehicle — roughly 1 in ${Math.max(2, Math.round(1 / z.value))}.`;
    },
  },
  {
    id: "walk",
    label: "Walking share of weekday trips",
    short: "Walking share",
    unit: "percent",
    denominatorLabel: "of weekday trips by residents",
    domain: [0.02, 0.11],
    get: (p) => p.modeShares.walk.value,
    format: fmtPct0,
    colors: ["#3a2c12", "#7d5c1c", "#b58a24", "#e0b445", "#fbe9b1"],
    sentence: (p, r) => {
      const w = p.modeShares.walk;
      if (w.value === null) return "Walking here could not be computed from the published cells.";
      const rw = r.modeShares.walk.value ?? 0;
      return `${(w.value * 100).toFixed(1)}% of weekday trips here are on foot${w.value > rw ? " — above the regional share" : ` (region ${(rw * 100).toFixed(1)}%)`}.`;
    },
  },
  {
    id: "workAtHome",
    label: "Usually work at home (share of employed)",
    short: "Work at home",
    unit: "percent",
    denominatorLabel: "of employed residents",
    domain: [0.06, 0.18],
    get: (p) => p.workAtHomeShare.value,
    format: fmtPct0,
    colors: ["#1c2b3a", "#2c5468", "#3f7f95", "#67b0c2", "#bfe2ea"],
    sentence: (p, r) => {
      const w = p.workAtHomeShare;
      if (w.value === null) return "Home-based work could not be computed from the published cells here.";
      return `${(w.value * 100).toFixed(1)}% of employed residents here usually work at home (region ${(r.workAtHomeShare.value! * 100).toFixed(1)}%).`;
    },
  },
  {
    id: "toronto",
    label: "Usual workplace in Toronto (share of employed)",
    short: "Work in Toronto",
    unit: "percent",
    denominatorLabel: "of employed residents",
    domain: [0.1, 0.42],
    get: (p) => p.torontoWorkShare.value,
    format: fmtPct0,
    colors: ["#2e1f1f", "#5e3230", "#94473f", "#c26f5c", "#efc3ae"],
    sentence: (p) => {
      const t = p.torontoWorkShare;
      if (t.value === null) return "Commuting destinations here could not be computed from the published cells.";
      return t.value >= 0.3
        ? `About ${(t.value * 100).toFixed(0)}% of employed residents usually work in Toronto — one of the strongest cross-boundary patterns in Durham.`
        : `About ${(t.value * 100).toFixed(0)}% of employed residents usually work in Toronto; most people here work closer to home.`;
    },
  },
];

export const metricById = (id: string): MetricDef =>
  MAP_METRICS.find((m) => m.id === id) ?? MAP_METRICS[0]!;

/** Largest-remainder apportionment of shares to N cells — exact, no padding,
 *  no truncation (audit A08: independent rounding produced 102 squares and
 *  then cut "Other" entirely). */
export function apportion(shares: number[], cells: number): number[] {
  const total = shares.reduce((a, b) => a + b, 0);
  if (total <= 0) return shares.map(() => 0);
  const exact = shares.map((s) => (s / total) * cells);
  const base = exact.map((v) => Math.floor(v));
  let remainder = cells - base.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...base];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i]!++;
    remainder--;
  }
  return out;
}

/** Share of a share, status-aware: null/withheld propagates. */
export const shareValue = (s: Share): number | null => s.value;
