"use client";

import { useEffect, useRef, useState } from "react";
import { fmtInt, fmtPct } from "@/lib/format";
import type { OdFlows, OdModeContext, OdModeGroup } from "@/lib/types";

const GROUP_ORDER: OdModeGroup[] = ["drive", "ride", "transit", "walk", "cycle", "schoolBus", "other"];

const GROUP_COLOR: Record<OdModeGroup, string> = {
  drive: "var(--color-auto-driver)",
  ride: "var(--color-auto-passenger)",
  transit: "var(--color-transit)",
  walk: "var(--color-walk)",
  cycle: "var(--color-bicycle)",
  schoolBus: "var(--color-school-bus)",
  other: "var(--color-other-misc)",
};

const GROUP_BLURB: Record<OdModeGroup, string> = {
  drive: "Driving alone — the private car as the driver.",
  ride: "Riding as a passenger — carpooling, drop-offs, shared rides.",
  transit: "Durham Region Transit, GO trains and buses, and trips combining both.",
  walk: "Trips made entirely on foot.",
  cycle: "Trips by bicycle, including e-bikes.",
  schoolBus: "Yellow-bus trips, mostly to school.",
  other: "Taxis, ride-hailing, motorcycles, e-scooters and unclassified trips.",
};

/**
 * Chapter — “Where we're going changes how we get there”. One stacked bar
 * that morphs between destination contexts. On first scroll into view it
 * performs the internal → Toronto morph once (skipped under reduced motion).
 */
export function ModeMorph({ contexts }: { contexts: OdFlows["modeContexts"] }) {
  const byKey = new Map(contexts.map((c) => [c.key, c]));
  const baseline = byKey.get("internalDurham") ?? contexts[0]!;
  const [activeKey, setActiveKey] = useState(baseline.key);
  const [touched, setTouched] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  const active = byKey.get(activeKey) ?? baseline;
  const activeShare = (g: OdModeGroup) => (active.trips > 0 ? active.groups[g]! / active.trips : 0);
  const baseShare = (g: OdModeGroup) => (baseline.trips > 0 ? baseline.groups[g]! / baseline.trips : 0);

  // One-time demonstration morph when the chapter enters the viewport.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = hostRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        window.setTimeout(() => {
          if (!touched) setActiveKey("toToronto");
        }, 900);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (key: string) => {
    setTouched(true);
    setActiveKey(key);
  };

  const toToronto = byKey.get("toToronto");

  return (
    <div ref={hostRef}>
      {/* context selector */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose a destination">
        {contexts.map((c) => {
          const isActive = c.key === activeKey;
          return (
            <button
              key={c.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => select(c.key)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "border-walk bg-walk/15 text-walk"
                  : "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 min-h-[2.6rem] max-w-[52ch] text-sm text-chalk-dim" aria-live="polite">
        {active.description} — {fmtInt(active.trips)} weekday trips.
      </p>

      {/* the morphing bar */}
      <div className="mt-6 rounded-xl border border-night-line bg-night-soft p-4 md:p-6">
        <div
          className="flex h-24 w-full gap-[2px] overflow-hidden rounded-lg md:h-28"
          role="img"
          aria-label={`Mode split for trips ${active.description}: ${GROUP_ORDER.map((g) => `${label(g)} ${fmtPct(activeShare(g))}`).join(", ")}.`}
        >
          {GROUP_ORDER.map((g) => {
            const share = activeShare(g);
            const widthPct = share * 100;
            if (widthPct === 0) return null;
            const showLabel = widthPct >= 12;
            return (
              <div
                key={g}
                className="relative h-full transition-[width] duration-700 ease-out"
                style={{ width: `${widthPct}%`, backgroundColor: GROUP_COLOR[g]! }}
              >
                {showLabel && (
                  <div className="flex h-full flex-col justify-center px-3">
                    <span
                      className="truncate text-[0.72rem] font-semibold uppercase tracking-wide"
                      style={{ color: readableOn(g) }}
                    >
                      {label(g)}
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: readableOn(g) }}>
                      {fmtPct(share, 0)}
                    </span>
                  </div>
                )}
                {widthPct >= 5 && widthPct < 12 && (
                  <span
                    className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center text-xs font-bold tabular-nums"
                    style={{ color: readableOn(g) }}
                  >
                    {fmtPct(share, 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* per-mode legend with counts + deltas vs internal Durham */}
        <ul className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {GROUP_ORDER.map((g) => {
            const share = activeShare(g);
            const delta = share - baseShare(g);
            return (
              <li key={g} className="flex items-center justify-between gap-3 border-b border-night-line/40 pb-1.5">
                <span className="flex items-center gap-2 text-chalk">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GROUP_COLOR[g]! }} />
                  {label(g)}
                </span>
                <span className="tabular-nums text-chalk-dim">
                  <span className="text-chalk">{fmtPct(share)}</span>{" "}
                  <span className="text-xs">({fmtInt(active.groups[g]!)})</span>
                  {activeKey !== baseline.key && Math.abs(delta) >= 0.0005 && (
                    <span className={`ml-1.5 text-xs ${delta > 0 ? "text-walk" : "text-chalk-dim"}`}>
                      {delta > 0 ? "+" : "−"}
                      {Math.abs(delta * 100).toFixed(1)} pp
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* editorial read of the internal → Toronto contrast */}
      {toToronto && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <MorphStat
            group="transit"
            from={baseline}
            to={toToronto}
            text="Transit share multiplies"
          />
          <MorphStat group="walk" from={baseline} to={toToronto} text="Walking all but vanishes" />
          <MorphStat group="drive" from={baseline} to={toToronto} text="Driving tightens its grip" />
        </div>
      )}
    </div>
  );
}

function MorphStat({
  group,
  from,
  to,
  text,
}: {
  group: OdModeGroup;
  from: OdModeContext;
  to: OdModeContext;
  text: string;
}) {
  const fromShare = from.groups[group]! / from.trips;
  const toShare = to.groups[group]! / to.trips;
  const factor = fromShare > 0 ? toShare / fromShare : 0;
  return (
    <div className="rounded-lg border border-night-line bg-night-soft/60 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-chalk-dim">{text}</p>
      <p className="mt-1 font-display text-xl text-chalk">
        {fmtPct(fromShare)} <span aria-hidden className="text-chalk-dim">→</span>{" "}
        <span className="text-walk">{fmtPct(toShare)}</span>
      </p>
      <p className="text-xs text-chalk-dim">
        {group === "transit"
          ? `${factor.toFixed(1)}× the share when the destination is Toronto`
          : group === "walk"
            ? "a share so small it rounds away"
            : `${(toShare / fromShare).toFixed(2)}× the internal share`}
      </p>
    </div>
  );
}

const LABELS: Record<OdModeGroup, string> = {
  drive: "Drive",
  ride: "Ride",
  transit: "Transit",
  walk: "Walk",
  cycle: "Cycle",
  schoolBus: "School bus",
  other: "Other",
};
const label = (g: OdModeGroup) => LABELS[g]!;

/** Label colour that stays legible on each mode colour. */
const readableOn = (g: OdModeGroup) =>
  g === "ride" || g === "walk" ? "#1c2024" : "#f5f8f7";
