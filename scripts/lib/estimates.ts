/**
 * Shared analytical contract for estimates: status-aware arithmetic that
 * preserves source states (observed / suppressed / not_available / missing)
 * through aggregation, division and historical comparison.
 *
 * Publication rules implemented here (docs/tts-audit-2026-09.md A04):
 *  - Suppression is not zero. If no component of a sum was observed, the sum
 *    has no numeric value — never 0.
 *  - Counts are nonnegative, so a sum over a partially observed category set
 *    is an *observed subtotal*: a lower bound on the true total. Such a sum
 *    keeps its numeric value and is marked `partial`.
 *  - A ratio needs a complete (observed, nonzero) denominator. With a partial
 *    numerator over a complete denominator the ratio is a lower bound on the
 *    true share (`partial`, value kept). With an incomplete denominator the
 *    ratio is withheld (value null) — the direction of the bias is unknown.
 *  - Suppressed cells are never recovered by subtracting from totals.
 *
 * Status precedence when several non-observed cells combine without any
 * observed value: suppressed (strongest statement about the source) over
 * not_available over missing.
 */

export type EstimateStatus = "observed" | "suppressed" | "not_available" | "missing" | "partial";

export interface Estimate {
  value: number | null;
  status: EstimateStatus;
}

export const observed = (value: number): Estimate => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid observed estimate: ${value} (must be finite and nonnegative)`);
  }
  return { value, status: "observed" };
};

const STATUS_PRIORITY: Record<Exclude<EstimateStatus, "observed" | "partial">, number> = {
  suppressed: 3,
  not_available: 2,
  missing: 1,
};

const combineUnobserved = (statuses: Exclude<EstimateStatus, "observed" | "partial">[]): EstimateStatus =>
  statuses.sort((a, b) => STATUS_PRIORITY[b] - STATUS_PRIORITY[a])[0] ?? "missing";

/** Cell accessor result: a cell that is structurally absent contributes nothing. */
export type Cell = Estimate | null;

/**
 * Sum of category cells. Absent cells (not collected this cycle) are
 * structurally excluded — they do not make the sum partial. Present but
 * unobserved cells make the sum partial when at least one other cell was
 * observed, or non-numeric when none was.
 */
export function sumEstimates(cells: Cell[]): Estimate {
  const present = cells.filter((c): c is Estimate => c !== null);
  if (present.length === 0) return { value: null, status: "missing" };
  let sum = 0;
  let observedCount = 0;
  const unobserved: Exclude<EstimateStatus, "observed" | "partial">[] = [];
  for (const c of present) {
    if (c.status === "observed" && c.value !== null) {
      sum += c.value;
      observedCount++;
    } else {
      unobserved.push(c.status as Exclude<EstimateStatus, "observed" | "partial">);
    }
  }
  if (observedCount === present.length) return { value: sum, status: "observed" };
  if (observedCount === 0) return { value: null, status: combineUnobserved(unobserved) };
  return { value: sum, status: "partial" }; // observed subtotal → lower bound
}

/**
 * Share/rate: numerator over denominator. See module rules — an incomplete
 * denominator yields no numeric share.
 */
export function ratioEstimate(numerator: Estimate, denominator: Estimate): Estimate {
  if (denominator.status !== "observed" || denominator.value === null || denominator.value === 0) {
    // A zero or unknown denominator produces no share. Keep the more specific
    // state: a partial denominator is a withheld computation, not missing data.
    if (denominator.status === "observed" && denominator.value === 0) return { value: null, status: "missing" };
    return { value: null, status: denominator.status };
  }
  if (numerator.status === "observed" && numerator.value !== null) {
    return { value: numerator.value / denominator.value, status: "observed" };
  }
  if (numerator.status === "partial" && numerator.value !== null) {
    return { value: numerator.value / denominator.value, status: "partial" }; // lower bound
  }
  return { value: null, status: numerator.status };
}

/**
 * Percentage-point difference of two share estimates (current − previous).
 * Both endpoints must be numeric; a partial endpoint makes the difference
 * partial (it inherits the lower-bound caveat of its inputs).
 */
export function diffPp(current: Estimate, previous: Estimate): Estimate {
  if (current.value === null || previous.value === null) {
    return { value: null, status: current.value === null ? current.status : previous.status };
  }
  const pp = current.value - previous.value;
  const status: EstimateStatus =
    current.status === "observed" && previous.status === "observed" ? "observed" : "partial";
  return { value: pp, status };
}

/**
 * Relative (percent) change (current − previous) / previous. Requires a
 * strictly positive *baseline* (previous) — the old code tested the current
 * value instead. Only permitted for comparable bases; the caller enforces that.
 */
export function pctChange(current: Estimate, previous: Estimate): Estimate {
  if (previous.value === null || previous.value <= 0) return { value: null, status: "missing" };
  if (current.value === null) return { value: null, status: current.status };
  const status: EstimateStatus =
    current.status === "observed" && previous.status === "observed" ? "observed" : "partial";
  return { value: (current.value - previous.value) / previous.value, status };
}

/** Human-readable explanation for a derived estimate state. */
export function estimateNote(e: Estimate): string | null {
  switch (e.status) {
    case "observed":
      return null;
    case "partial":
      return e.value === null
        ? "Not computable from the published cells: a component affecting the total is unavailable (suppressed or not collected)."
        : "Approximate lower bound: a small component (suppressed or not collected) is excluded from the numerator; the true value is at least this large.";
    case "suppressed":
      return "Suppressed because the underlying survey count was too small (fewer than four survey records).";
    case "not_available":
      return "Not collected in this survey cycle.";
    default:
      return "Not available in the published data.";
  }
}
