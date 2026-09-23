/**
 * Work-at-home 2016→2022 change: computed predicates for the geographic
 * divergence story. Pure functions shared by the chapter component and the
 * regression tests — no editorial claim lives outside these predicates.
 *
 * Both endpoints come explicitly from the curated data (prior2016), never
 * reconstructed as value − change. These are point estimates from two survey
 * cycles; no significance or causation is claimed.
 */
import type { MunicipalityProfile, Share } from "./types";

export interface WahChange {
  id: string;
  name: string;
  y2016: Share;
  y2022: Share;
  /** Percentage-point change (2022 − 2016); null when either endpoint is unavailable. */
  pp: number | null;
}

/** Change threshold (0.5 pp, expressed as a share fraction) below which a difference is called "little change". */
export const FLAT_THRESHOLD = 0.005;

export const wahChanges = (municipalities: MunicipalityProfile[]): WahChange[] =>
  municipalities.map((m) => ({
    id: m.geographyId,
    name: m.geographyName,
    y2016: m.prior2016.workAtHomeShare,
    y2022: m.workAtHomeShare,
    pp:
      m.workAtHomeShare.value !== null && m.prior2016.workAtHomeShare.value !== null
        ? m.workAtHomeShare.value - m.prior2016.workAtHomeShare.value
        : null,
  }));

export type Direction = "increase" | "decline" | "little-change" | "unknown";

export const directionOf = (pp: number | null): Direction => {
  if (pp === null) return "unknown";
  if (pp > FLAT_THRESHOLD) return "increase";
  if (pp < -FLAT_THRESHOLD) return "decline";
  return "little-change";
};

/** How many municipalities moved in each direction (tested predicates). */
export const directionCounts = (changes: WahChange[]): Record<Direction, number> => {
  const counts: Record<Direction, number> = { increase: 0, decline: 0, "little-change": 0, unknown: 0 };
  for (const c of changes) counts[directionOf(c.pp)]!++;
  return counts;
};

/** Relative multiple of the 2016 share, when both endpoints exist and the baseline is positive. */
export const multiple = (c: WahChange): number | null => {
  const a = c.y2016.value;
  const b = c.y2022.value;
  if (a === null || b === null || a <= 0) return null;
  return b / a;
};

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const ppSigned = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} pp`;

/** One computed sentence per municipality; every clause derives from the values. */
export const wahSentence = (c: WahChange): string => {
  const dir = directionOf(c.pp);
  const a = c.y2016.value;
  const b = c.y2022.value;
  if (dir === "unknown" || a === null || b === null || c.pp === null) {
    return `${c.name}: change not computable from the published cells.`;
  }
  const mult = multiple(c);
  const growthWord =
    mult === null ? "" : mult >= 3 ? "more than tripled" : mult >= 1.8 ? "nearly doubled" : mult >= 1.25 ? "rose" : "changed more modestly";
  switch (dir) {
    case "increase":
      return growthWord
        ? `${c.name} ${growthWord}: ${pct(a)} → ${pct(b)} of employed residents usually working at home (${ppSigned(c.pp)}).`
        : `${c.name} rose from ${pct(a)} to ${pct(b)} (${ppSigned(c.pp)}).`;
    case "decline":
      return `${c.name} declined from ${pct(a)} to ${pct(b)} (${ppSigned(c.pp)}).`;
    default:
      return `${c.name} changed little: ${pct(a)} → ${pct(b)} (${ppSigned(c.pp)}).`;
  }
};

/** Region-level summary computed the same way (no universal claim). */
export const regionSummary = (
  region2016: Share,
  region2022: Share,
): { sentence: string; multiple: number | null; pp: number | null } => {
  const a = region2016.value;
  const b = region2022.value;
  if (a === null || b === null) {
    return { sentence: "The regional change cannot be computed from the published cells.", multiple: null, pp: null };
  }
  const pp = b - a;
  const mult = a > 0 ? b / a : null;
  const word = mult === null ? "changed" : mult >= 1.8 ? "nearly doubled" : mult >= 1.25 ? "rose" : "changed more modestly";
  return {
    sentence: `Across Durham Region, the share of employed residents usually working at home ${word}: ${pct(a)} in 2016 to ${pct(b)} in 2022 (${ppSigned(pp)}).`,
    multiple: mult,
    pp,
  };
};
