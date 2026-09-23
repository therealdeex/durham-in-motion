"use client";

import { useState } from "react";
import type { MapGeom } from "@/lib/od-map";
import { fmtInt } from "@/lib/format";
import { MAP_METRICS, metricById } from "@/lib/metrics";
import type { MunicipalityProfile, Profile } from "@/lib/types";

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

const colorFor = (m: { domain: [number, number]; colors: string[] }, v: number | null): string => {
  if (v === null) return "#e5e0d5"; // unknown: neutral hatched tone
  const [lo, hi] = m.domain;
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const stops = m.colors;
  const idx = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(idx));
  return mixHex(stops[i]!, stops[i + 1]!, idx - i);
};

/**
 * SVG choropleth of the eight municipalities (replaces the MapLibre canvas:
 * a fixed eight-polygon map with no pan/zoom, per the audit's simpler-is-
 * better note — no async bundle, no load-failure state, keyboard-accessible).
 * The legend names each metric's denominator; unknown values get a distinct
 * neutral tone and remain clickable/discoverable (never silently dropped).
 */
export function ChoroplethPanel({
  geom,
  region,
  municipalities,
  selectedId,
  onSelect,
}: {
  geom: MapGeom;
  region: Profile;
  municipalities: MunicipalityProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [metricId, setMetricId] = useState("transit");
  const metric = metricById(metricId);
  const selected = municipalities.find((m) => m.geographyId === selectedId) ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div>
        <div role="group" aria-label="Map measure" className="mb-4 flex flex-wrap gap-2">
          {MAP_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={metricId === m.id}
              onClick={() => setMetricId(m.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                metricId === m.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {m.short}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${geom.W} ${geom.H}`}
          className="w-full rounded-xl border border-line bg-paper-dim/40"
          role="img"
          aria-label={`Map of Durham's eight municipalities coloured by ${metric.label} (${metric.denominatorLabel}), 2022. Values listed beside the map.`}
        >
          <path d={geom.outlinePath} fill="#f7f4ed" stroke="#c9c0b0" strokeWidth="1.6" />
          {geom.municipalities.map((muni) => {
            const prof = municipalities.find((p) => p.geographyId === muni.id);
            const v = prof ? metric.get(prof) : null;
            const fill = colorFor(metric, v);
            const isSel = muni.id === selectedId;
            return (
              <g key={muni.id}>
                <path
                  d={muni.path}
                  fill={fill}
                  stroke={isSel ? "#c2502e" : "#b9b09e"}
                  strokeWidth={isSel ? 2.5 : 1}
                  tabIndex={0}
                  role="button"
                  aria-label={`${muni.name}: ${metric.short} ${v === null ? "not computable" : metric.format(v)} (${metric.denominatorLabel})`}
                  onClick={() => onSelect(muni.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(muni.id);
                    }
                  }}
                  className="cursor-pointer outline-none focus:stroke-accent focus:stroke-[3]"
                />
                <text
                  x={muni.cx}
                  y={muni.cy + 3.5}
                  fontSize="12.5"
                  textAnchor="middle"
                  fill="#3c3630"
                  fontFamily="var(--font-inter)"
                  pointerEvents="none"
                >
                  {muni.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-ink-soft">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span aria-hidden className="flex overflow-hidden rounded">
              {metric.colors.map((c) => (
                <span key={c} className="h-2.5 w-8" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="min-w-0">
              {metric.format(metric.domain[0])} → {metric.format(metric.domain[1])} {metric.denominatorLabel}
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: "#e5e0d5" }} />
            not computable from published cells
          </span>
        </div>
      </div>

      <div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            Choose a community
          </legend>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
            {municipalities.map((m) => (
              <li key={m.geographyId}>
                <button
                  type="button"
                  onClick={() => onSelect(m.geographyId)}
                  aria-pressed={selectedId === m.geographyId}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedId === m.geographyId
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line text-ink-soft hover:border-ink hover:text-ink"
                  }`}
                >
                  {m.geographyName}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {(selected ?? municipalities[0]) && (
          <article className="mt-4 rounded-xl border border-line bg-white p-5" aria-live="polite">
            <h4 className="font-display text-2xl text-ink">
              {(selected ?? municipalities[0]).geographyName}
            </h4>
            <p className="mt-1 text-xs text-ink-faint">
              {fmtInt((selected ?? municipalities[0]).persons)} residents ·{" "}
              {fmtInt((selected ?? municipalities[0]).households)} households · 2022 survey
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink">
              {metric.sentence(selected ?? municipalities[0], region)}
            </p>
            <p className="mt-3 text-xs text-ink-faint">
              Metric: {metric.label.toLowerCase()} — {metric.denominatorLabel}. Regional value:{" "}
              {metric.format(metric.get(region))}.
            </p>
          </article>
        )}
      </div>
    </div>
  );
}
