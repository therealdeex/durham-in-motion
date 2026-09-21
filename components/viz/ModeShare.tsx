"use client";

import { useEffect, useRef, useState } from "react";
import { fmtInt, fmtPct } from "@/lib/format";
import type { Profile } from "@/lib/types";

interface ModeDef {
  key: keyof Profile["modeShares"];
  rawKeys: string[];
  label: string;
  color: string;
  blurb: string;
}

const MODES: ModeDef[] = [
  {
    key: "autoDriver",
    rawKeys: ["autoDriver"],
    label: "Car driver",
    color: "var(--color-auto-driver)",
    blurb: "Trips where the person is driving a private car, truck or van.",
  },
  {
    key: "autoPassenger",
    rawKeys: ["autoPassenger"],
    label: "Car passenger",
    color: "var(--color-auto-passenger)",
    blurb: "Riding as a passenger in a private vehicle — carpooling, getting dropped off, sharing a ride.",
  },
  {
    key: "transit",
    rawKeys: ["transit"],
    label: "Transit",
    color: "var(--color-transit)",
    blurb: "Local transit (Durham Region Transit), GO buses and trains, and trips that combine both.",
  },
  {
    key: "walk",
    rawKeys: ["walk"],
    label: "Walking",
    color: "var(--color-walk)",
    blurb: "Trips made entirely on foot. The 2022 survey captured walking trips more completely than earlier cycles.",
  },
  {
    key: "bicycle",
    rawKeys: ["bicycle"],
    label: "Cycling",
    color: "var(--color-bicycle)",
    blurb: "Trips by bicycle, including e-bikes.",
  },
  {
    key: "schoolBus",
    rawKeys: ["schoolBus"],
    label: "School bus",
    color: "var(--color-school-bus)",
    blurb: "Yellow-bus trips, mostly to and from school.",
  },
  {
    key: "otherMisc",
    rawKeys: ["otherMisc"],
    label: "Other",
    color: "var(--color-other-misc)",
    blurb: "Motorcycles, taxis, ride-hailing, e-scooters and everything else.",
  },
];

/**
 * Chapter 2 — How We Move. A 10×10 grid where each cell is 1% of the
 * region's weekday trips; cells assemble mode by mode.
 */
export function ModeShare({ region }: { region: Profile }) {
  const [active, setActive] = useState<string | null>(null);
  const [assembled, setAssembled] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
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

  // 100 cells, assigned to modes in order of share.
  const cells: string[] = [];
  for (const m of MODES) {
    const share = region.modeShares[m.key].value ?? 0;
    cells.push(...Array(Math.round(share * 100)).fill(m.key));
  }
  while (cells.length < 100) cells.push(MODES[0].key);
  cells.length = 100;

  // interleave so the grid looks mixed when assembled
  const grid = [...cells];
  for (let i = grid.length - 1 > 0 ? grid.length - 1 : 0; i > 0; i--) {
    // deterministic shuffle (no Math.random — SSR/client hydration mismatch)
    const j = (i * 7 + 3) % (i + 1);
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
      <div>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => {
            const s = region.modeShares[m.key];
            const isActive = active === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActive(isActive ? null : m.key)}
                onMouseEnter={() => setActive(m.key)}
                onFocus={() => setActive(m.key)}
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
              const m = MODES.find((x) => x.key === active)!;
              const s = region.modeShares[m.key];
              return (
                <div>
                  <p className="font-display text-3xl text-chalk">
                    {fmtPct(s.value)}{" "}
                    <span className="text-lg text-chalk-dim">
                      of weekday trips · {fmtInt(Math.round((s.value ?? 0) * (region.tripsTotal ?? 0)))} trips
                    </span>
                  </p>
                  <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-chalk-dim">{m.blurb}</p>
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
          aria-label={`Grid of 100 squares, each representing one percent of weekday trips. ${MODES.map((m) => `${m.label} ${fmtPct(region.modeShares[m.key].value)}`).join(", ")}.`}
        >
          {grid.map((key, i) => {
            const m = MODES.find((x) => x.key === key)!;
            const dim = active !== null && active !== key;
            return (
              <span
                key={i}
                aria-hidden
                className="aspect-square rounded-[3px] transition-all duration-300"
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
          Each square is 1% of the {region.tripsTotal !== null ? `${(region.tripsTotal / 1_000_000).toFixed(2)} million` : ""} weekday trips made by Durham residents (2022).
        </p>
      </div>
    </div>
  );
}
