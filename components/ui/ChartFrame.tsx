"use client";

import { useState, type ReactNode } from "react";

/**
 * Shared chart frame (PR4): every visualization carries its question, a
 * computed takeaway, the scope/date/basis line, an accessible table, a
 * source trail and caveats. Light/dark variants follow the section theme.
 *
 * Presentation contracts (audit A08/A10):
 *  - counts: compact estimate in editorial text, full precision in tables;
 *  - shares: one decimal; share changes: signed percentage points;
 *  - partial/suppressed: visible status text, never silently ranked;
 *  - tables render the exact values behind every graphic.
 */
export function ChartFrame({
  kicker,
  title,
  takeaway,
  scope,
  children,
  table,
  source,
  caveats,
  theme = "dark",
}: {
  kicker?: string;
  title?: string;
  /** One-sentence computed finding — the thing a reader should learn. */
  takeaway: ReactNode;
  /** Universe/denominator + survey year + basis, as one line. */
  scope: string;
  children: ReactNode;
  /** Accessible table of the exact values (rendered inside a toggle). */
  table: ReactNode;
  source: string;
  caveats?: string[];
  theme?: "dark" | "light";
}) {
  const [showTable, setShowTable] = useState(false);
  const isDark = theme === "dark";
  return (
    <figure
      className={
        isDark
          ? "rounded-xl border border-night-line bg-night-soft/60 p-5 md:p-7"
          : "rounded-xl border border-line bg-white p-5 md:p-7 shadow-[0_1px_0_rgba(28,32,36,0.06),0_12px_40px_-24px_rgba(28,32,36,0.35)]"
      }
    >
      {(kicker || title) && (
        <div>
          {kicker && (
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? "text-walk" : "text-accent"}`}>
              {kicker}
            </p>
          )}
          {title && (
            <h4 className={`mt-2 font-display text-xl font-semibold leading-tight md:text-2xl ${isDark ? "text-chalk" : "text-ink"}`}>
              {title}
            </h4>
          )}
        </div>
      )}
      <p
        className={`mt-3 text-[15px] leading-relaxed ${isDark ? "text-chalk" : "text-ink"}`}
        aria-live="polite"
      >
        {takeaway}
      </p>
      <p className={`mt-1 text-xs ${isDark ? "text-chalk-dim" : "text-ink-faint"}`}>{scope}</p>

      <div className="mt-5">{children}</div>

      <div className="mt-5">
        <button
          type="button"
          aria-expanded={showTable}
          onClick={() => setShowTable((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
            isDark
              ? "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
              : "border-line text-ink-soft hover:border-ink hover:text-ink"
          }`}
        >
          {showTable ? "Hide the numbers" : "View the numbers"}
        </button>
        {showTable && <div className="mt-3">{table}</div>}
      </div>

      <figcaption className={`mt-4 border-t pt-3 text-xs leading-relaxed ${isDark ? "border-night-line text-chalk-dim" : "border-line text-ink-faint"}`}>
        <p>{source}</p>
        {caveats && caveats.length > 0 && (
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}
