"use client";

import { useMemo, useState } from "react";
import { MAP_METRICS, metricById } from "@/lib/metrics";
import { shareStatusNote } from "@/lib/format";
import type { MunicipalityProfile, Profile, WardsFile } from "@/lib/types";

/**
 * Ranking panel. Communities whose value is unknown (suppressed / not
 * computable) are NOT silently dropped: they stay listed below the ranking
 * with their state, so discovery never hides a community for missing data
 * (audit A08/A10). Measures come from the shared metric registry, so the
 * denominator phrasing matches the map and postcard.
 */
export function RankPanel({
  region,
  municipalities,
  wards,
  selectedId,
}: {
  region: Profile;
  municipalities: MunicipalityProfile[];
  wards: WardsFile["wards"];
  selectedId: string | null;
}) {
  const [metricId, setMetricId] = useState("transit");
  const [scope, setScope] = useState<"municipality" | "ward">("municipality");
  const metric = metricById(metricId);

  const pool: Profile[] = scope === "municipality" ? municipalities : wards;

  const { ranked, unknown } = useMemo(() => {
    const withValues: { p: Profile; v: number }[] = [];
    const without: { p: Profile; status: string }[] = [];
    for (const p of pool) {
      const v = metric.get(p);
      if (v === null) {
        const share =
          metricId === "transit"
            ? p.modeShares.transit
            : metricId === "walk"
              ? p.modeShares.walk
              : metricId === "zeroVehicle"
                ? p.zeroVehicleHouseholdShare
                : metricId === "workAtHome"
                  ? p.workAtHomeShare
                  : metricId === "toronto"
                    ? p.torontoWorkShare
                    : null;
        without.push({ p, status: share ? share.status : "missing" });
      } else {
        withValues.push({ p, v });
      }
    }
    withValues.sort((a, b) => b.v - a.v);
    return { ranked: withValues, unknown: without };
  }, [pool, metric, metricId]);

  const max = ranked.length ? ranked[0]!.v : 1;
  const regionV = metric.get(region);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="rank-measure" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Measure
          </label>
          <select
            id="rank-measure"
            value={metricId}
            onChange={(e) => setMetricId(e.target.value)}
            className="rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm font-medium text-ink"
          >
            {MAP_METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rank-scope" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Communities
          </label>
          <select
            id="rank-scope"
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
          <strong className="text-ink">{regionV === null ? "not computable" : metric.format(regionV)}</strong>{" "}
          <span className="block text-right">{metric.denominatorLabel}</span>
        </p>
      </div>

      <ol className="mt-6 space-y-1.5">
        {ranked.map(({ p, v }, i) => (
          <li
            key={p.geographyId}
            className={`grid grid-cols-[1.6rem_minmax(8rem,11rem)_1fr_auto] items-center gap-2 rounded-md text-sm md:gap-3 ${
              p.geographyId === selectedId ? "bg-accent/10" : ""
            }`}
          >
            <span className="text-right text-xs text-ink-faint tabular-nums">{i + 1}</span>
            <span className="truncate font-medium text-ink" title={p.geographyName}>
              {p.geographyName}
            </span>
            <span className="relative h-5">
              <span
                className="absolute inset-y-0 left-0 rounded-r-sm rounded-l-[2px] transition-[width] duration-500 motion-reduce:transition-none"
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
            <span className="w-14 text-right tabular-nums text-ink-soft">{metric.format(v)}</span>
          </li>
        ))}
      </ol>

      {unknown.length > 0 && (
        <details className="mt-4 rounded-lg border border-line bg-paper-dim/40 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink-soft">
            {unknown.length} {unknown.length === 1 ? "community is" : "communities are"} not rankable on this
            measure — they stay listed, never hidden
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-faint">
            {unknown.map(({ p, status }) => (
              <li key={p.geographyId} className="flex items-baseline justify-between gap-3">
                <span className="text-ink-soft">{p.geographyName}</span>
                <span>
                  {status === "suppressed"
                    ? "suppressed (fewer than four survey records)"
                    : status === "not_available"
                      ? "not collected in this cycle"
                      : status === "partial"
                        ? "not computable from published cells"
                        : "unavailable"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            {unknown.some((u) => u.status === "partial")
              ? shareStatusNote({ value: null, status: "partial" }) ?? ""
              : ""}
          </p>
        </details>
      )}

      <p className="mt-3 text-xs text-ink-faint">
        <span aria-hidden className="mr-1 inline-block h-3 w-0.5 translate-y-0.5 bg-accent" />
        Red marker: Durham Region overall. Measure: {metric.label.toLowerCase()} —{" "}
        {metric.denominatorLabel}, 2022 TTS.
      </p>
    </div>
  );
}
