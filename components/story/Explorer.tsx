"use client";

import { useMemo, useState } from "react";
import { fmtPct, fmtX } from "@/lib/format";
import type { Profile, WardsFile } from "@/lib/types";

interface Measure {
  id: string;
  label: string;
  scope: "both" | "municipality";
  get: (p: Profile) => number | null;
  fmt: (v: number) => string;
  higherIs: string;
}

const MEASURES: Measure[] = [
  { id: "transit", label: "Transit share of trips", scope: "both", get: (p) => p.modeShares.transit.value, fmt: (v) => fmtPct(v), higherIs: "highest → lowest" },
  { id: "walk", label: "Walking share", scope: "both", get: (p) => p.modeShares.walk.value, fmt: (v) => fmtPct(v), higherIs: "highest → lowest" },
  { id: "bicycle", label: "Cycling share", scope: "both", get: (p) => p.modeShares.bicycle.value, fmt: (v) => fmtPct(v), higherIs: "highest → lowest" },
  { id: "zeroVehicle", label: "No-vehicle households", scope: "both", get: (p) => p.zeroVehicleHouseholdShare.value, fmt: (v) => fmtPct(v), higherIs: "highest → lowest" },
  { id: "vehicles", label: "Vehicles per household", scope: "municipality", get: (p) => p.avgVehiclesPerHousehold, fmt: (v) => fmtX(v), higherIs: "highest → lowest" },
  { id: "workAtHome", label: "Work at home", scope: "both", get: (p) => p.workAtHomeShare.value, fmt: (v) => fmtPct(v), higherIs: "highest → lowest" },
  { id: "toronto", label: "Commute to Toronto", scope: "both", get: (p) => p.torontoWorkShare.value, fmt: (v) => fmtPct(v, 0), higherIs: "highest → lowest" },
];

/** Chapter 8 — Explore a little more: ranked bars, deliberately modest. */
export function Explorer({ region, municipalities, wards }: { region: Profile; municipalities: Profile[]; wards: WardsFile["wards"] }) {
  const [measureId, setMeasureId] = useState("transit");
  const [scope, setScope] = useState<"municipality" | "ward">("municipality");

  const measure = MEASURES.find((m) => m.id === measureId)!;
  const pool = scope === "municipality" ? municipalities : wards;
  const rows = useMemo(() => {
    return pool
      .map((p) => ({ p, v: measure.get(p) }))
      .filter((x): x is { p: Profile; v: number } => x.v !== null)
      .sort((a, b) => b.v - a.v);
  }, [pool, measure]);

  const max = rows.length ? Math.max(...rows.map((r) => r.v)) : 1;
  const regionV = measure.get(region);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="exp-measure" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Measure
          </label>
          <select
            id="exp-measure"
            value={measureId}
            onChange={(e) => setMeasureId(e.target.value)}
            className="rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm font-medium text-ink"
          >
            {MEASURES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="exp-scope" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Communities
          </label>
          <select
            id="exp-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as "municipality" | "ward")}
            className="rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm font-medium text-ink"
          >
            <option value="municipality">8 area municipalities</option>
            <option value="ward">{wards.length} wards (2022 boundaries)</option>
          </select>
        </div>
        <p className="ml-auto text-xs text-ink-faint">
          Durham Region overall:{" "}
          <strong className="text-ink">{regionV === null ? "suppressed" : measure.fmt(regionV)}</strong>
        </p>
      </div>

      <ol className="mt-6 space-y-1.5">
        {rows.map(({ p, v }, i) => (
          <li key={p.geographyId} className="group grid grid-cols-[1.6rem_minmax(9rem,12rem)_1fr_auto] items-center gap-2 text-sm md:gap-3">
            <span className="text-right text-xs text-ink-faint tabular-nums">{i + 1}</span>
            <span className="truncate font-medium text-ink" title={p.geographyName}>
              {p.geographyName}
            </span>
            <span className="relative h-5">
              <span
                className="absolute inset-y-0 left-0 rounded-r-sm rounded-l-[2px] transition-[width] duration-500"
                style={{
                  width: `${Math.max(1.5, (v / max) * 100)}%`,
                  backgroundColor: i === 0 ? "var(--color-transit)" : "var(--color-auto-driver)",
                  opacity: i === 0 ? 1 : 0.75,
                }}
              />
              {regionV !== null && (
                <span
                  aria-hidden
                  className="absolute inset-y-[-3px] w-0.5 bg-accent"
                  style={{ left: `${Math.max(1.5, (regionV / max) * 100)}%` }}
                />
              )}
            </span>
            <span className="w-14 text-right tabular-nums text-ink-soft">{measure.fmt(v)}</span>
          </li>
        ))}
      </ol>
      {rows.some((r) => r.p.modeSuppressed) && (
        <p className="mt-3 text-xs text-ink-faint">
          Communities whose share could not be computed from the published data (suppressed) are omitted from this ranking.
        </p>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        <span aria-hidden className="mr-1 inline-block h-3 w-0.5 translate-y-0.5 bg-accent" />
        Red marker: Durham Region overall.
      </p>
    </div>
  );
}
