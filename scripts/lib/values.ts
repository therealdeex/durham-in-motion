/**
 * Value parsing for DMG CSV cells.
 *
 * Three non-numeric states, kept strictly distinct (see DMG notes embedded in
 * each file):
 *  - "*"            → suppressed: fewer than four survey observations.
 *                     Never zero, never to be reverse-engineered from totals.
 *  - "N/A"          → the characteristic was not collected that survey year.
 *  - "" / malformed → missing.
 */
export type ValueStatus = "observed" | "suppressed" | "not_available" | "missing";

export interface ParsedValue {
  value: number | null;
  status: ValueStatus;
}

export function parseValue(raw: string | undefined): ParsedValue {
  if (raw === undefined) return { value: null, status: "missing" };
  const t = raw.trim();
  if (t === "*") return { value: null, status: "suppressed" };
  if (t === "N/A" || t === "n/a") return { value: null, status: "not_available" };
  if (t === "") return { value: null, status: "missing" };
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return { value: null, status: "missing" };
  return { value: n, status: "observed" };
}
