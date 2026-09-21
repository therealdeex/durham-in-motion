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
  const points = series.points.filter((p) => p.value !== null);
  const years = series.points.map((p) => p.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const values = points.map((p) => p.value as number);
  const includeZero = series.unit === "percent" || series.unit === "vehicles";
  const vMin = includeZero ? Math.min(0, ...values) : Math.min(...values);
  const vMax = Math.max(...values);
  const lo = vMin - (vMax - vMin) * 0.08;
  const hi = vMax + (vMax - vMin) * 0.12;

  const g: Geom = geom;
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleYear(p.year, minY, maxY, geom).toFixed(1)} ${scaleVal(p.value as number, lo, hi, geom).toFixed(1)}`)
    .join(" ");

  const valueFmt = (v: number | null): string => {
    if (v === null) return "suppressed";
    if (series.unit === "percent") return `${(v * 100).toFixed(1)}%`;
    if (series.unit === "vehicles") return v.toFixed(2);
    return fmtInt(v);
  };

  const onMove = (e: React.MouseEvent | React.FocusEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = "clientX" in e ? e.clientX - rect.left : 0;
    const year = Math.round(minY + ((px / rect.width) * (maxY - minY)));
    let best = points[0];
    for (const p of points) {
      if (Math.abs(p.year - year) < Math.abs(best.year - year)) best = p;
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

          {/* caution band label for pre-2022-only series */}
          {isTripSeries && points.length > 0 && (
            <text x={PAD.left + 6} y={PAD.top + 2} fontSize={geom.font.note} fill="#e0b445">
              {W < 500 ? "1986–2016 only" : "comparable cycles: 1986–2016 (trips of persons 11+)"}
            </text>
          )}

          {/* the line */}
          <path d={pathD} fill="none" stroke="#f5b043" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

          {/* points; open circles for partial estimates */}
          {points.map((p) => (
            <circle
              key={p.year}
              cx={scaleYear(p.year, minY, maxY, geom)}
              cy={scaleVal(p.value as number, lo, hi, geom)}
              r={hover?.year === p.year ? 5.5 : 3.6}
              fill={p.status === "partial" ? "#0f1418" : "#f5b043"}
              stroke="#f5b043"
              strokeWidth="2"
            />
          ))}

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
          <span aria-hidden className="text-walk">‡</span> Trip-based measures come from cycles collected for
          household members aged 11+. The 2022 survey collected trips for ages 5+ and captured walking more
          completely, so 2022 trip counts and mode shares are shown separately, never on the same line.
        </p>
        <p>
          Demographic measures (population, households, vehicles, work at home, commuting) are collected the
          same way in every cycle and are directly comparable.
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
              </tr>
            </thead>
            <tbody>
              {series.points.map((p) => (
                <tr key={p.year} className="border-b border-night-line/50">
                  <td className="py-1.5 pr-4">{p.year}</td>
                  <td className="py-1.5 text-chalk">{valueFmt(p.value)}</td>
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
