"use client";

import { useEffect, useRef, useState } from "react";
import { fmtInt, fmtPct, shareStatusNote } from "@/lib/format";
import { MODES, apportion } from "@/lib/metrics";
import type { Profile } from "@/lib/types";

/**
 * Chapter — How We Move. A 10×10 grid where each cell is 1% of the region's
 * weekday trips. Cells are assigned by largest-remainder apportionment —
 * exactly 100 squares, no padding, no truncation (audit A08: independent
 * rounding previously produced 102 squares and then cut "Other" entirely).
 * Labels and colours come from the shared metric registry.
 */
export function ModeShare({ region }: { region: Profile }) {
  const [active, setActive] = useState<string | null>(null);
  const [assembled, setAssembled] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAssembled(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setAssembled(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shares = MODES.map((m) => region.modeShares[m.id].value ?? 0);
  const counts = apportion(shares, 100); // exact partition of 100 cells
  const cells: string[] = [];
  MODES.forEach((m, i) => {
    for (let k = 0; k < counts[i]!; k++) cells.push(m.id);
  });

  // Deterministic shuffle (no Math.random — SSR/client hydration match).
  const grid = [...cells];
  for (let i = grid.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [grid[i], grid[j]] = [grid[j]!, grid[i]!];
  }

  const anyPartial = MODES.some((m) => {
    const s = region.modeShares[m.id];
    return s.status !== "observed" && s.value !== null;
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
      <div>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => {
            const s = region.modeShares[m.id];
            const isActive = active === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActive(isActive ? null : m.id)}
                onMouseEnter={() => setActive(m.id)}
                onFocus={() => setActive(m.id)}
                aria-pressed={isActive}
                className="group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  borderColor: isActive ? m.color : "var(--color-night-line)",
                  backgroundColor: isActive ? "color-mix(in srgb, " + m.color + " 18%, transparent)" : "transparent",
                  color: "var(--color-chalk)",
                }}
              >
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                {m.label}
                <span className="text-chalk-dim">{fmtPct(s.value)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 min-h-[5.5rem]" aria-live="polite">
          {active ? (
            (() => {
              const m = MODES.find((x) => x.id === active)!;
              const s = region.modeShares[m.id];
              return (
                <div>
                  <p className="font-display text-3xl text-chalk">
                    {fmtPct(s.value)}{" "}
                    <span className="text-lg text-chalk-dim">
                      of weekday trips · {fmtInt(Math.round((s.value ?? 0) * (region.tripsTotal ?? 0)))} trips
                    </span>
                  </p>
                  <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-chalk-dim">{m.blurb}</p>
                  {shareStatusNote(s) && (
                    <p className="mt-1 text-xs text-walk">{shareStatusNote(s)}</p>
                  )}
                </div>
              );
            })()
          ) : (
            <p className="max-w-[48ch] text-sm leading-relaxed text-chalk-dim">
              Hover or tap a mode to explore. Together, trips by car — driving and riding —
              account for {fmtPct((region.modeShares.autoDriver.value ?? 0) + (region.modeShares.autoPassenger.value ?? 0))} of
              all weekday trips made by Durham residents.
            </p>
          )}
        </div>
      </div>

      <div>
        <div
          ref={gridRef}
          className="mx-auto grid w-full max-w-[420px] grid-cols-10 gap-1 rounded-xl border border-night-line bg-night-soft p-4"
          role="img"
          aria-label={`Grid of 100 squares, each representing one percent of weekday trips. ${MODES.map((m) => `${m.label} ${fmtPct(region.modeShares[m.id].value)}`).join(", ")}.`}
        >
          {grid.map((key, i) => {
            const m = MODES.find((x) => x.id === key)!;
            const dim = active !== null && active !== key;
            return (
              <span
                key={i}
                aria-hidden
                className="aspect-square rounded-[3px] transition-all duration-300 motion-reduce:transition-none"
                style={{
                  backgroundColor: m.color,
                  opacity: assembled ? (dim ? 0.22 : 1) : 0,
                  transform: assembled ? "scale(1)" : "scale(0.3)",
                  transitionDelay: `${Math.min(900, i * 6)}ms`,
                }}
              />
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-chalk-dim">
          Each square is 1% of the{" "}
          {region.tripsTotal !== null ? `${(region.tripsTotal / 1_000_000).toFixed(2)} million` : ""} weekday trips
          made by Durham residents (2022). Squares are apportioned by largest remainder, so the
          grid always totals exactly 100.
          {anyPartial ? " ≈ marks shares computed as lower bounds (a suppressed category excluded)." : ""}
        </p>
      </div>
    </div>
  );
}
