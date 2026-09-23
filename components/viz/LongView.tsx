"use client";

import { useMemo, useRef, useState } from "react";
import { fmtInt } from "@/lib/format";
import { useIsNarrow } from "@/lib/hooks";
import type { HistoricalTrends, TrendSeries } from "@/lib/types";

const SERIES_ORDER = [
  "population",
  "households",
  "licensed_drivers",
  "avg_vehicles",
  "zero_vehicle_share",
  "work_at_home",
  "seniors_share",
  "toronto_work_share",
  "trips_total",
  "transit_share",
  "auto_driver_share",
  "walk_share",
];

/** Chart geometry adapts to narrow screens so labels render ~1:1. */
const useGeometry = () => {
  const narrow = useIsNarrow();
  return narrow
    ? { W: 340, H: 300, PAD: { top: 24, right: 14, bottom: 34, left: 44 }, font: { axis: 10, year: 10.5, note: 10 } }
    : { W: 840, H: 380, PAD: { top: 28, right: 28, bottom: 40, left: 64 }, font: { axis: 11, year: 11.5, note: 11 } };
};

interface Geom {
  W: number;
  H: number;
  PAD: { top: number; right: number; bottom: number; left: number };
  font: { axis: number; year: number; note: number };
}

function scaleYear(year: number, min: number, max: number, g: Geom): number {
  return g.PAD.left + ((year - min) / (max - min)) * (g.W - g.PAD.left - g.PAD.right);
}

function scaleVal(v: number, min: number, max: number, g: Geom): number {
  if (max === min) return g.H / 2;
  return g.H - g.PAD.bottom - ((v - min) / (max - min)) * (g.H - g.PAD.top - g.PAD.bottom);
}

/** Chapter 5 — The Long View, 1986→2022. */
export function LongView({ trends }: { trends: HistoricalTrends }) {
  const seriesById = useMemo(() => {
    const map = new Map<string, TrendSeries>();
    for (const s of trends.series) map.set(s.id, s);
    return map;
  }, [trends]);

  const geom = useGeometry();
  const W = geom.W;
  const H = geom.H;
  const PAD = geom.PAD;

  const [seriesId, setSeriesId] = useState("population");
  const [hover, setHover] = useState<{ x: number; y: number; year: number; value: number | null; status: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const series = seriesById.get(seriesId)!;
  // Markers for every numeric point; the connecting line only spans runs of
  // consecutive comparable, observed points — never across a method break or
  // an unavailable year (docs/tts-audit-2026-09.md A05, A10).
  const points = series.points.filter((p) => p.value !== null);
  const years = series.points.map((p) => p.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const values = points.map((p) => p.value as number);
  const vMin = Math.min(0, ...values);
  const vMax = Math.max(...values);
  const lo = vMin - (vMax - vMin) * 0.08;
  const hi = vMax + (vMax - vMin) * 0.12;

  const segments: string[] = [];
  let run: { year: number; value: number }[] = [];
  for (const p of series.points) {
    if (p.value !== null && p.comparable && p.status !== "not_available") {
      run.push({ year: p.year, value: p.value });
    } else if (run.length > 0) {
      if (run.length >= 2) segments.push(pathOf(run));
      run = [];
    }
  }
  if (run.length >= 2) segments.push(pathOf(run));

  function pathOf(pts: { year: number; value: number }[]): string {
    return pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${scaleYear(p.year, minY, maxY, geom).toFixed(1)} ${scaleVal(p.value, lo, hi, geom).toFixed(1)}`)
      .join(" ");
  }

  const valueFmt = (v: number | null): string => {
    if (v === null) return "not available";
    if (series.unit === "percent") return `${(v * 100).toFixed(1)}%`;
    if (series.unit === "vehicles") return v.toFixed(2);
    return fmtInt(v);
  };

  const onMove = (e: React.MouseEvent | React.FocusEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Map pointer position into the plot's padded range, not the whole SVG.
    const pxInPlot = ("clientX" in e ? e.clientX - rect.left : rect.width / 2) * (W / rect.width) - PAD.left;
    const t = Math.max(0, Math.min(1, pxInPlot / (W - PAD.left - PAD.right)));
    const year = Math.round(minY + t * (maxY - minY));
    let best: (typeof series.points)[number] | undefined;
    for (const p of points) {
      if (!best || Math.abs(p.year - year) < Math.abs(best.year - year)) best = p;
    }
    if (!best) return;
    setHover({
      x: scaleYear(best.year, minY, maxY, geom),
      y: scaleVal(best.value as number, lo, hi, geom),
      year: best.year,
      value: best.value,
      status: best.status,
    });
  };

  const isTripSeries = series.comparability === "caution";

  return (
    <div>
      {/* Series selector */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose a measure">
        {SERIES_ORDER.filter((id) => seriesById.has(id)).map((id) => {
          const s = seriesById.get(id)!;
          const active = id === seriesId;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setSeriesId(id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-walk bg-walk/15 text-walk"
                  : "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
              }`}
            >
              {s.label}
              {s.comparability === "caution" && <span aria-hidden> ‡</span>}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="relative mt-5 rounded-xl border border-night-line bg-night-soft p-2 md:p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Line chart: ${series.label} across TTS survey years 1986 to 2022. ${series.note}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const v = lo + (hi - lo) * t;
            const y = scaleVal(v, lo, hi, geom);
            return (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#2a333b" strokeWidth="1" />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={geom.font.axis} fill="#a9b6b4">
                  {series.unit === "percent" ? `${(v * 100).toFixed(0)}%` : series.unit === "vehicles" ? v.toFixed(1) : compactAxis(v)}
                </text>
              </g>
            );
          })}

          {/* year labels */}
          {series.points.map((p) => (
            <text key={p.year} x={scaleYear(p.year, minY, maxY, geom)} y={H - 12} textAnchor="middle" fontSize={geom.font.year} fill="#a9b6b4">
              {String(p.year).slice(2)}
            </text>
          ))}

          {/* comparability break annotation */}
          {minY < 2022 && maxY >= 2022 && (
            <g>
              <line
                x1={scaleYear(2022, minY, maxY, geom)}
                x2={scaleYear(2022, minY, maxY, geom)}
                y1={PAD.top - 8}
                y2={H - PAD.bottom}
                stroke="#c2502e"
                strokeWidth="1.4"
                strokeDasharray="5 4"
              />
              <text
                x={scaleYear(2022, minY, maxY, geom) - 6}
                y={PAD.top + 2}
                textAnchor="end"
                fontSize={geom.font.note}
                fill="#e59b85"
              >
                {isTripSeries ? (W < 500 ? "2022: method change" : "2022 method change — not comparable") : "2022 survey"}
              </text>
            </g>
          )}

          {/* caution band label for trip-basis series */}
          {isTripSeries && points.length > 0 && (
            <text x={PAD.left + 6} y={PAD.top + 2} fontSize={geom.font.note} fill="#e0b445">
              {W < 500 ? "1991–2016 line" : "connected line: 1991–2016 (trips of persons 11+)"}
            </text>
          )}

          {/* the line — one segment per comparable run; gaps across breaks */}
          {segments.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#f5b043" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* points: filled when on the series basis; open diamonds for
              observed values from a different collection basis */}
          {points.map((p) => {
            const cx = scaleYear(p.year, minY, maxY, geom);
            const cy = scaleVal(p.value as number, lo, hi, geom);
            if (!p.comparable) {
              const r = hover?.year === p.year ? 7 : 5;
              return (
                <rect
                  key={p.year}
                  x={cx - r / 1.4}
                  y={cy - r / 1.4}
                  width={(r / 1.4) * 2}
                  height={(r / 1.4) * 2}
                  transform={`rotate(45 ${cx} ${cy})`}
                  fill="#0f1418"
                  stroke="#f5b043"
                  strokeWidth="2"
                />
              );
            }
            return (
              <circle
                key={p.year}
                cx={cx}
                cy={cy}
                r={hover?.year === p.year ? 5.5 : 3.6}
                fill={p.status === "partial" ? "#0f1418" : "#f5b043"}
                stroke="#f5b043"
                strokeWidth="2"
              />
            );
          })}

          {/* hover marker */}
          {hover && (
            <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={H - PAD.bottom} stroke="#4d545c" strokeDasharray="3 3" />
          )}
        </svg>

        {/* hover / focus readout (also serves as accessible value list fallback trigger) */}
        <div className="mt-1 flex min-h-[2.2rem] flex-wrap items-center justify-between gap-2 px-2 text-sm">
          {hover ? (
            <p className="text-chalk">
              <span className="font-semibold">{hover.year}:</span> {valueFmt(hover.value)}
              {hover.status === "partial" && <span className="ml-2 text-xs text-chalk-dim">approximate — small suppressed categories excluded</span>}
            </p>
          ) : (
            <p className="text-xs text-chalk-dim">{series.note || "Hover the chart for exact values."}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs leading-relaxed text-chalk-dim md:grid-cols-2">
        <p>
          <span aria-hidden className="text-walk">‡</span> Trip-based measures: the connected line
          covers 1991–2016, when trips were collected for household members aged 11+. 1986
          collected ages 6+ and 2022 collected ages 5+ with fuller walking capture — those points
          (open diamonds) are shown for context and are never connected to the line.
        </p>
        <p>
          Household and person measures are broadly stable across cycles, with cycle-specific
          collection changes documented in DMG&apos;s data guide (for example 2011 household-attribute
          restrictions and the 2016 income-band change). Gaps appear where a value is unavailable
          or not computable from published cells.
        </p>
      </div>

      {/* accessible data table */}
      <details className="mt-4 rounded-lg border border-night-line bg-night-soft px-4 py-3 text-sm">
        <summary className="cursor-pointer text-chalk">View the numbers as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-chalk-dim">
            <caption className="sr-only">{series.label} by survey year</caption>
              <thead>
                <tr className="border-b border-night-line">
                  <th scope="col" className="py-1.5 pr-4 font-medium">Survey year</th>
                  <th scope="col" className="py-1.5 font-medium">{series.label}</th>
                  <th scope="col" className="py-1.5 font-medium">Note</th>
                </tr>
              </thead>
            <tbody>
              {series.points.map((p) => (
                <tr key={p.year} className="border-b border-night-line/50">
                  <td className="py-1.5 pr-4">{p.year}</td>
                  <td className="py-1.5 text-chalk">{valueFmt(p.value)}</td>
                  <td className="py-1.5 text-xs text-chalk-dim">
                    {p.value === null
                      ? p.status === "partial"
                        ? "not computable from published cells"
                        : p.status === "suppressed"
                          ? "suppressed"
                          : p.status === "not_available"
                            ? "not collected"
                            : "not available"
                      : p.status === "partial"
                        ? "approximate (lower bound)"
                        : !p.comparable
                          ? "different collection basis"
                          : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function compactAxis(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}
