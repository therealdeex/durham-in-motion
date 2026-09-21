/**
 * Deterministic story facts: every narrative sentence on the site is
 * generated here from the data alone — no hand-written numbers, no LLM.
 * Same data in, same sentence out.
 */
import { fmtPct, fmtX, fmtInt } from "./format";
import type { MunicipalityProfile, Profile } from "./types";

/** "Transit represents X% of trips here, compared with Y% across Durham." */
export function transitSentence(p: Profile, region: Profile): string {
  const t = p.modeShares.transit;
  const r = region.modeShares.transit;
  if (t.value === null) {
    return `Transit's share of weekday trips here was too small to report reliably in the 2022 survey — transit trips made up about ${fmtPct(r.value)} of trips region-wide.`;
  }
  if (t.value > r.value! * 1.15) {
    return `Transit represents ${fmtPct(t.value)} of weekday trips here — noticeably above the ${fmtPct(r.value)} across Durham as a whole.`;
  }
  if (t.value < r.value! * 0.6) {
    return `Transit represents ${fmtPct(t.value)} of weekday trips here — well below the ${fmtPct(r.value)} across Durham.`;
  }
  return `Transit represents ${fmtPct(t.value)} of weekday trips here, close to the regional share of ${fmtPct(r.value)}.`;
}

export function carSentence(p: Profile, region: Profile): string {
  const v = p.avgVehiclesPerHousehold;
  const r = region.avgVehiclesPerHousehold;
  if (v === null) return "Household vehicle ownership here was too small to report reliably.";
  const vs = fmtX(v);
  if (r !== null && v >= r + 0.15) return `Households here own ${vs} vehicles on average — among the highest in Durham (region: ${fmtX(r)}).`;
  if (r !== null && v <= r - 0.15) return `Households here own ${vs} vehicles on average — among the lowest in Durham (region: ${fmtX(r)}).`;
  return `Households here own ${vs} vehicles on average (region: ${fmtX(r)}).`;
}

export function walkSentence(p: Profile, region: Profile): string {
  const w = p.modeShares.walk;
  const b = p.modeShares.bicycle;
  const rw = region.modeShares.walk;
  if (w.value === null) return "Walking and cycling shares here were too small to report reliably.";
  const bike = b.value !== null ? ` Cycling accounts for another ${fmtPct(b.value, 1)}.` : "";
  return `About ${fmtPct(w.value)} of weekday trips here are on foot${w.value > (rw.value ?? 0) ? ", above the regional share" : ""}.${bike}`;
}

export function zeroVehicleSentence(p: Profile): string {
  const z = p.zeroVehicleHouseholdShare;
  if (z.value === null) return "The number of households without a vehicle here was too small to report reliably.";
  return `${fmtPct(z.value)} of households here have no vehicle — roughly 1 in ${Math.max(2, Math.round(1 / z.value))}.`;
}

export function commuteSentence(p: Profile): string {
  const t = p.torontoWorkShare;
  if (t.value === null) return "Commuting destinations were not reported reliably for this community.";
  const pct = fmtPct(t.value, 0);
  if (t.value >= 0.35) return `About ${pct} of workers with a usual workplace commute to Toronto — the strongest cross-boundary flow in the region.`;
  if (t.value >= 0.2) return `Roughly ${pct} of workers with a usual workplace commute to Toronto; most of the rest work inside Durham.`;
  return `About ${pct} of workers with a usual workplace commute to Toronto — most people here work closer to home.`;
}

export function workAtHomeSentence(p: Profile, region: Profile): string {
  const w = p.workAtHomeShare;
  if (w.value === null) return "Home-based work was not reported reliably here.";
  return `${fmtPct(w.value)} of employed residents here usually work from home (region: ${fmtPct(region.workAtHomeShare.value)}).`;
}

export function placeKindLabel(p: Profile): string {
  return p.geographyType === "ward" ? "Community (ward)" : "Area municipality";
}

export function rankSuffix(rank: number | null): string {
  if (rank === null) return "";
  const s = ["st", "nd", "rd"][((rank + 90) % 100) - 10] || (["th", "st", "nd", "rd"][rank % 10] ?? "th");
  return `${rank}${s} of 8`;
}

/** The largest municipality-level gap for a share-like measure, 2022. */
export function extremes(
  places: MunicipalityProfile[],
  get: (p: MunicipalityProfile) => number | null,
): { high: MunicipalityProfile; low: MunicipalityProfile } | null {
  const vals = places
    .map((p) => ({ p, v: get(p) }))
    .filter((x): x is { p: MunicipalityProfile; v: number } => x.v !== null);
  if (vals.length < 2) return null;
  vals.sort((a, b) => b.v - a.v);
  return { high: vals[0].p, low: vals[vals.length - 1].p };
}

/** People-per-trip sanity phrasing for hero facts. */
export function tripsPerHousehold(p: Profile): string {
  if (p.tripsTotal === null || p.households === null || p.households === 0) return "—";
  return (p.tripsTotal / p.households).toFixed(1);
}

export function tripsHuman(p: Profile): string {
  if (p.tripsTotal === null) return "—";
  return `${(p.tripsTotal / 1_000_000).toFixed(2)} million`;
}

export { fmtInt, fmtPct, fmtX };
