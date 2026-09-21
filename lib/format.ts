/** Presentation formatting. Survey estimates avoid false precision. */

export const fmtInt = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-CA");

export const fmtCompact = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} million`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Math.round(v).toLocaleString("en-CA");
};

export const fmtPct = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;

export const fmtPp = (v: number | null | undefined, digits = 1): string => {
  if (v === null || v === undefined) return "—";
  const pp = v * 100;
  return `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toFixed(digits)} pp`;
};

export const fmtX = (v: number | null | undefined, digits = 2): string =>
  v === null || v === undefined ? "—" : v.toFixed(digits);

/** Percent share with an explicit approximation marker for partial data. */
export const fmtShare = (s: { value: number | null; status: string }, digits = 1): string => {
  if (s.value === null) {
    if (s.status === "suppressed") return "suppressed";
    return "—";
  }
  const pct = (s.value * 100).toFixed(digits);
  return s.status === "partial" ? `≈${pct}%` : `${pct}%`;
};

export const shareStatusNote = (s: { status: string }): string | null => {
  if (s.status === "suppressed")
    return "Suppressed because the underlying survey count was too small.";
  if (s.status === "partial")
    return "Approximate: a small category (under four survey records) is excluded.";
  if (s.status === "not_available") return "Not collected in this survey cycle.";
  return null;
};
