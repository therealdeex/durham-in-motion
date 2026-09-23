"use client";

import { useMemo, useRef } from "react";
import type { MapGeom } from "@/lib/od-map";
import {
  BROAD_PURPOSES,
  PURPOSE_LABEL,
  type BroadPurpose,
  type DayBin,
  type DayStoryFile,
  type FlowScene,
} from "@/lib/stories/types";
import { binToScene } from "@/lib/stories/selectors";
import { fmtCompact, fmtInt } from "@/lib/format";
import { FlowMap } from "../FlowMap";

/** Purpose colors reuse the site's data palette (school=purple, walk-gold=discretionary). */
export const PURPOSE_COLOR: Record<BroadPurpose, string> = {
  "Home-Based Work": "#33567d",
  "Home-based School": "#8a6fb5",
  "Home-based Discretionary": "#f5b043",
  "Non Home-based": "#98938a",
};

export type DayFilter = { kind: "all" } | { kind: "purpose"; value: BroadPurpose } | { kind: "mode"; value: string };

const MODE_COLORS: Record<string, string> = {
  drive: "#33567d",
  ride: "#a3bfd6",
  transit: "#00857a",
  walk: "#f5b043",
  cycle: "#cc4b37",
  schoolBus: "#8a6fb5",
  other: "#98938a",
};

const filteredTrips = (b: DayBin, filter: DayFilter): number => {
  if (filter.kind === "all") return b.trips;
  if (filter.kind === "purpose") return b.byPurpose[filter.value] ?? 0;
  return b.byMode[filter.value as keyof DayBin["byMode"]] ?? 0;
};

const filterColor = (filter: DayFilter): string =>
  filter.kind === "purpose"
    ? PURPOSE_COLOR[filter.value]
    : filter.kind === "mode"
      ? (MODE_COLORS[filter.value] ?? "#7fd6cc")
      : "#00857a";

/**
 * The master visualization for A Day in Durham: clock + regional map + volume
 * curve + purpose composition + boundary balance, driven by one shared time.
 * Everything reacts to `binIndex`; nothing animates on its own.
 */
export function DayPanel({
  file,
  geom,
  binIndex,
  filter,
  explore,
  onScrubTo,
}: {
  file: DayStoryFile;
  geom: MapGeom;
  binIndex: number;
  filter: DayFilter;
  explore: boolean;
  onScrubTo?: (binIndex: number) => void;
}) {
  const bins = file.bins;
  const bin = bins[Math.min(binIndex, bins.length - 1)]!;
  const hour = Math.floor((bin.t + file.meta.dayStartSurveyHour * 60) / 60);
  const hourBins = bins.filter((b) => Math.floor((b.t + 240) / 60) === hour);

  const scene: FlowScene = useMemo(() => binToScene(file, bin), [file, bin]);
  const maxPair = useMemo(() => Math.max(...bins.flatMap((b) => b.pairs.map((p) => p.v)), 1), [bins]);
  const maxBinExchange = useMemo(
    () => Math.max(...bins.map((b) => Math.max(b.inbound, b.outbound)), 1),
    [bins],
  );
  const seriesMax = useMemo(() => Math.max(...bins.map((b) => filteredTrips(b, filter)), 1), [bins, filter]);

  const hourPurpose = useMemo(() => {
    const counts = Object.fromEntries(BROAD_PURPOSES.map((p) => [p, 0])) as Record<BroadPurpose, number>;
    let stated = 0;
    for (const b of hourBins) {
      for (const p of BROAD_PURPOSES) counts[p] += b.byPurpose[p] ?? 0;
      stated = BROAD_PURPOSES.reduce((a, p) => a + counts[p]!, 0);
    }
    return { counts, stated };
  }, [hourBins]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-night-line bg-night shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
      {/* header: clock + time + trips */}
      <div className="flex items-center gap-4 border-b border-night-line/70 px-4 py-3">
        <ClockDial minutesSinceFour={bin.t} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-semibold leading-none text-chalk md:text-3xl" aria-live="polite">
            {bin.publicLabel}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-chalk-dim">
            survey time {bin.surveyLabel} · {halfHourRange(bin)} ·{" "}
            <span className="tabular-nums">{fmtInt(bin.surveyRecords)}</span> records behind this half-hour
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold leading-none tabular-nums text-walk md:text-2xl">
            {fmtInt(filteredTrips(bin, filter))}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-chalk-dim">trip starts{filter.kind !== "all" ? ` · ${filterName(filter)}` : ""}</p>
        </div>
      </div>

      {/* map */}
      <div className="relative min-h-0 flex-1 px-2 py-1">
        <FlowMap
          geom={geom}
          scene={scene}
          maxValue={maxPair}
          nodeValueById={bin.self}
          compact
          ariaLabel={`Map of movement at ${bin.publicLabel}: ${bin.pairs.length} corridors above the display floor; ${fmtInt(bin.inbound)} trips entering and ${fmtInt(bin.outbound)} leaving Durham Region in this half-hour.`}
        />
      </div>

      {/* volume curve */}
      <div className="border-t border-night-line/70 px-3 pb-1 pt-2">
        <VolumeCurve
          bins={bins}
          binIndex={binIndex}
          filter={filter}
          seriesMax={seriesMax}
          explore={explore}
          onScrub={onScrubTo}
        />
      </div>

      {/* purpose composition (current hour) */}
      <div className="px-3 pb-1 pt-1">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full" role="img" aria-label={purposeAria(hourPurpose)}>
          {BROAD_PURPOSES.map((p) => {
            const share = hourPurpose.stated ? hourPurpose.counts[p]! / hourPurpose.stated : 0;
            return share > 0.004 ? (
              <div
                key={p}
                className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${share * 100}%`, background: PURPOSE_COLOR[p] }}
                title={`${PURPOSE_LABEL[p]} ${Math.round(share * 100)}%`}
              />
            ) : null;
          })}
        </div>
        <p className="mt-1 truncate text-[10.5px] leading-tight text-chalk-dim">
          {BROAD_PURPOSES.map((p) => ({ p, share: hourPurpose.stated ? hourPurpose.counts[p]! / hourPurpose.stated : 0 }))
            .sort((a, b) => b.share - a.share)
            .slice(0, 2)
            .map(({ p, share }) => `${PURPOSE_LABEL[p]} ${Math.round(share * 100)}%`)
            .join(" · ")}{" "}
          <span className="text-chalk-dim/60">({hourLabel(hour)} hour, all purposes)</span>
        </p>
      </div>

      {/* boundary balance */}
      <div className="border-t border-night-line/70 px-3 py-2">
        <BoundaryBalance inbound={bin.inbound} outbound={bin.outbound} max={maxBinExchange} />
      </div>
    </div>
  );
}

const halfHourRange = (bin: DayBin): string => {
  const end = bin.t + 30;
  const fmt = (m: number) => {
    const total = 240 + m;
    const h24 = Math.floor(total / 60) % 24;
    const mm = total % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
  };
  // within the same half of the day the meridiem repeats — shorten the start
  const startStr = fmt(bin.t);
  const endStr = fmt(end);
  const [startClock, startMer] = startStr.split(" ");
  const [, endMer] = endStr.split(" ");
  return startMer === endMer ? `${startClock}–${endStr}` : `${startStr}–${endStr}`;
};

const hourLabel = (hour: number): string => {
  const h24 = hour % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${h24 < 12 ? "a.m." : "p.m."}`;
};

const filterName = (f: DayFilter): string =>
  f.kind === "all" ? "" : f.kind === "purpose" ? PURPOSE_LABEL[f.value].toLowerCase() : f.value;

const purposeAria = ({ counts, stated }: { counts: Record<BroadPurpose, number>; stated: number }) =>
  BROAD_PURPOSES.map((p) => `${PURPOSE_LABEL[p]} ${Math.round((counts[p]! / (stated || 1)) * 100)}%`).join(", ");

// ---------------------------------------------------------------------------

/** 24-hour dial: midnight at top, the survey day sweeps from 04:00. */
function ClockDial({ minutesSinceFour }: { minutesSinceFour: number }) {
  const R = 34;
  const C = 40;
  const angleOf = (minutesOfDay: number) => ((minutesOfDay / 1440) * 360 - 90) * (Math.PI / 180);
  const pt = (minutesOfDay: number, r: number) => ({
    x: C + r * Math.cos(angleOf(minutesOfDay)),
    y: C + r * Math.sin(angleOf(minutesOfDay)),
  });
  const startMin = 4 * 60; // 04:00
  const nowMin = (startMin + minutesSinceFour) % 1440;
  // sweep arc from 04:00 clockwise to now, crossing midnight when it wraps
  const sweepMinutes = minutesSinceFour;
  const largeArc = sweepMinutes > 720 ? 1 : 0;
  const from = pt(startMin, R);
  const to = pt(nowMin, R);
  const hand = pt(nowMin, R - 8);
  const ticks = Array.from({ length: 24 }, (_, h) => {
    const a = pt(h * 60, R);
    const b = pt(h * 60, h % 6 === 0 ? R - 6 : R - 3);
    return { a, b, hour: h };
  });
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16 shrink-0" role="img" aria-hidden>
      <circle cx={C} cy={C} r={R} fill="#0f1418" stroke="#2a333b" strokeWidth="1.5" />
      {ticks.map((t) => (
        <line
          key={t.hour}
          x1={t.a.x}
          y1={t.a.y}
          x2={t.b.x}
          y2={t.b.y}
          stroke={t.hour === 4 ? "#f5b043" : "#3d4a52"}
          strokeWidth={t.hour === 4 ? 1.6 : 1}
        />
      ))}
      {sweepMinutes >= 5 && (
        <path
          d={`M${from.x} ${from.y} A${R} ${R} 0 ${largeArc} 1 ${to.x} ${to.y}`}
          fill="none"
          stroke="#7fd6cc"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}
      <line x1={C} y1={C} x2={hand.x} y2={hand.y} stroke="#ecf1f0" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={C} cy={C} r="2" fill="#ecf1f0" />
      <text x={C} y={C + R + 9.5} fontSize="7.5" fill="#a9b6b4" textAnchor="middle" fontFamily="var(--font-inter)">
        day starts 4 a.m.
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------

/** 24-hour volume ribbon; the current moment is the cursor. */
function VolumeCurve({
  bins,
  binIndex,
  filter,
  seriesMax,
  explore,
  onScrub,
}: {
  bins: DayBin[];
  binIndex: number;
  filter: DayFilter;
  seriesMax: number;
  explore: boolean;
  onScrub?: (i: number) => void;
}) {
  const W = 640;
  const H = 76;
  const padL = 6;
  const padR = 6;
  const padT = 8;
  const padB = 14;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) => padL + (i / (bins.length - 1)) * innerW;
  const y = (v: number) => padT + innerH * (1 - v / seriesMax);

  const line = bins.map((b, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(filteredTrips(b, filter)).toFixed(1)}`).join(" ");
  const area = `${line} L${x(bins.length - 1).toFixed(1)} ${padT + innerH} L${padL} ${padT + innerH} Z`;

  // hour gridlines at 04/08/12/16/20/24 (+ survey hours)
  const hourMarks = [4, 8, 12, 16, 20, 24].map((h) => {
    const i = ((h - 4) * 60) / 30;
    return { i, label: labelForHour(h) };
  });
  const svgRef = useRef<SVGSVGElement>(null);

  const scrubFromEvent = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || !onScrub) return;
    const rect = svg.getBoundingClientRect();
    const rel = (clientX - rect.left) / rect.width;
    const i = Math.round(Math.min(1, Math.max(0, rel)) * (bins.length - 1));
    onScrub(i);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full ${explore && onScrub ? "cursor-ew-resize touch-none" : ""}`}
      role="img"
      aria-label="Volume of trip starts across the survey day, 4 a.m. to just before 4 a.m."
      onPointerDown={explore && onScrub ? (e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        scrubFromEvent(e.clientX);
      } : undefined}
      onPointerMove={explore && onScrub ? (e) => {
        if (e.buttons === 1) scrubFromEvent(e.clientX);
      } : undefined}
    >
      <path d={area} fill={filterColor(filter)} opacity="0.18" />
      <path d={line} fill="none" stroke={filterColor(filter)} strokeWidth="1.8" />
      {hourMarks.map((m) => (
        <line key={m.i} x1={x(m.i)} y1={padT} x2={x(m.i)} y2={padT + innerH} stroke="#2a333b" strokeWidth="1" />
      ))}
      <line
        x1={x(binIndex)}
        y1={padT - 3}
        x2={x(binIndex)}
        y2={padT + innerH}
        stroke="#ecf1f0"
        strokeWidth="1.6"
        className="transition-transform duration-500 motion-reduce:transition-none"
      />
      <circle
        cx={x(binIndex)}
        cy={y(filteredTrips(bins[binIndex]!, filter))}
        r="3.4"
        fill="#ecf1f0"
        className="transition-all duration-500 motion-reduce:transition-none"
      />
      {hourMarks.map((m) => (
        <text
          key={m.i}
          x={x(m.i)}
          y={H - 3}
          fontSize="10"
          fill="#8a9099"
          textAnchor="middle"
          fontFamily="var(--font-inter)"
        >
          {m.label}
        </text>
      ))}
    </svg>
  );
}

const labelForHour = (h: number): string => {
  const h24 = h % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${h24 < 12 ? "a" : "p"}`;
};

// ---------------------------------------------------------------------------

/** Leaving vs entering Durham: two counters and a balance bar that crosses. */
function BoundaryBalance({ inbound, outbound, max }: { inbound: number; outbound: number; max: number }) {
  const half = 50;
  const outW = half * Math.min(1, outbound / max);
  const inW = half * Math.min(1, inbound / max);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="tabular-nums" style={{ color: "#f5b043" }}>
          ← {fmtCompact(inbound)} entering
        </span>
        <span className="text-chalk-dim">boundary exchange · this half-hour</span>
        <span className="tabular-nums" style={{ color: "#c2502e" }}>
          {fmtCompact(outbound)} leaving →
        </span>
      </div>
      <div className="relative mt-1 h-2.5 rounded-full bg-night-soft">
        <div className="absolute inset-y-0 left-1/2 w-px bg-chalk-dim/50" aria-hidden />
        <div
          className="absolute inset-y-0 rounded-l-full transition-all duration-500 motion-reduce:transition-none"
          style={{ right: "50%", width: `${inW}%`, background: "#f5b043", opacity: 0.85 }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 rounded-r-full transition-all duration-500 motion-reduce:transition-none"
          style={{ left: "50%", width: `${outW}%`, background: "#c2502e", opacity: 0.85 }}
          aria-hidden
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {fmtInt(inbound)} trips entering, {fmtInt(outbound)} leaving Durham Region this half-hour
      </p>
    </div>
  );
}
