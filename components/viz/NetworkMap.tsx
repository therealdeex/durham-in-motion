"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { arcPath, type MapGeom } from "@/lib/od-map";
import { fmtInt } from "@/lib/format";
import type { OdPairFlow } from "@/lib/types";

const STEP_LABELS = [
  "Eight communities",
  "The strongest connection",
  "Then the next",
  "And the next",
  "The full network",
];

/**
 * Chapter — “Durham's hidden network”. Municipality desire lines appear in
 * rank order; the sequence auto-plays once in view, then the map is
 * interactive (hover/focus a connection for exact flows, click a community
 * to isolate its connections).
 */
export function NetworkMap({
  geom,
  pairs,
  threshold,
}: {
  geom: MapGeom;
  pairs: OdPairFlow[];
  threshold: number;
}) {
  const shown = useMemo(() => pairs.filter((p) => p.totalTwoWay >= threshold), [pairs, threshold]);
  const maxTrips = shown[0]?.totalTwoWay ?? 1;

  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? STEP_LABELS.length : 0);
  const replayedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ pair: OdPairFlow; x: number; y: number } | null>(null);
  const [focusMuni, setFocusMuni] = useState<string | null>(null);

  // Autoplay the staged reveal once the chapter is in view; any manual step
  // selection cancels it.
  useEffect(() => {
    if (reduced || replayedRef.current) return;
    const el = hostRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        replayedRef.current = true;
        let s = 0;
        timerRef.current = window.setInterval(() => {
          s += 1;
          setStep(s);
          if (s >= STEP_LABELS.length && timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }, 1300);
      },
      { threshold: 0.45 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [reduced]);

  const selectStep = (s: number) => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    replayedRef.current = true;
    setStep(s);
  };

  const strokeWidth = (trips: number) => 1.4 + 9 * Math.sqrt(trips / maxTrips);

  const pairGeom = (p: OdPairFlow) => {
    const a = geom.municipalities.find((m) => m.id === p.a)!;
    const b = geom.municipalities.find((m) => m.id === p.b)!;
    return { a, b };
  };

  const isLit = (p: OdPairFlow) =>
    step >= 5 || (focusMuni !== null ? p.a === focusMuni || p.b === focusMuni : false);

  const onArcMove = (e: React.MouseEvent, pair: OdPairFlow) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    setHover({ pair, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div ref={hostRef} className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
      <div className="relative">
        <svg
          viewBox={`0 0 ${geom.W} ${geom.H}`}
          className="w-full"
          role="img"
          aria-label={`Map of Durham Region's eight municipalities with travel connections between them. Step: ${STEP_LABELS[Math.min(step, STEP_LABELS.length) - 1] ?? "starting"}. ${shown
            .slice(0, 6)
            .map((p) => labelOf(p))
            .join("; ")}.`}
        >
          <path d={geom.outlinePath} fill="#141f26" stroke="#3d5a58" strokeWidth="1.6" />
          {geom.municipalities.map((m) => (
            <path
              key={m.id}
              d={m.path}
              fill={focusMuni === m.id ? "rgba(127,214,204,0.14)" : "transparent"}
              stroke="#2a3d44"
              strokeWidth="1"
              className="cursor-pointer transition-[fill] duration-200"
              onClick={() => setFocusMuni(focusMuni === m.id ? null : m.id)}
            />
          ))}

          {/* arcs appear in rank order as steps advance */}
          {shown.map((p, i) => {
            const visible = step >= Math.min(i + 2, STEP_LABELS.length);
            const { a, b } = pairGeom(p);
            const lit = isLit(p);
            const dimmed = focusMuni !== null && !lit;
            return (
              <g
                key={`${p.a}-${p.b}`}
                className={`transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
              >
                <path
                  d={arcPath(a.cx, a.cy, b.cx, b.cy, 0.16)}
                  fill="none"
                  stroke="#7fd6cc"
                  strokeLinecap="round"
                  strokeOpacity={dimmed ? 0.12 : 0.85}
                  strokeWidth={strokeWidth(p.totalTwoWay) * (hover?.pair === p ? 1.35 : 1)}
                  className="transition-[stroke-width,stroke-opacity] duration-200"
                  style={{ pointerEvents: "none" }}
                />
                {/* generous invisible hit area */}
                <path
                  d={arcPath(a.cx, a.cy, b.cx, b.cy, 0.16)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  className="cursor-pointer"
                  onMouseMove={(e) => onArcMove(e, p)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}

          {/* labels */}
          {geom.municipalities.map((m, i) => (
            <g
              key={m.id}
              className={`transition-opacity duration-500 ${step >= 1 || reduced ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDelay: `${i * 40}ms` }}
            >
              <circle
                cx={m.cx}
                cy={m.cy}
                r="3"
                fill={focusMuni === m.id ? "#f5b043" : "#7fd6cc"}
                className="cursor-pointer"
                onClick={() => setFocusMuni(focusMuni === m.id ? null : m.id)}
              />
              <text
                x={m.cx + 8}
                y={m.cy + 4}
                fontSize="12.5"
                fill="#c6d2d0"
                fontFamily="var(--font-inter)"
                className="cursor-pointer select-none"
                onClick={() => setFocusMuni(focusMuni === m.id ? null : m.id)}
              >
                {m.name}
              </text>
            </g>
          ))}
          <g className={`transition-opacity duration-500 ${step >= 2 || reduced ? "opacity-100" : "opacity-0"}`}>
            <circle cx={geom.toronto.x} cy={geom.toronto.y} r="4" fill="#c2502e" />
            <text
              x={geom.toronto.x + 9}
              y={geom.toronto.y + 4}
              fontSize="13"
              fill="#e5b9a8"
              fontFamily="var(--font-inter)"
            >
              Toronto
            </text>
          </g>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-20 max-w-[15rem] rounded-md bg-ink px-3 py-2 text-xs leading-snug text-paper shadow-lg"
            style={{
              left: Math.max(0, hover.x - 120),
              top: Math.max(0, hover.y - 70),
            }}
            role="status"
          >
            <p className="font-semibold">
              {nameOf(hover.pair.a)} ↔ {nameOf(hover.pair.b)}
            </p>
            <p>{fmtInt(hover.pair.totalTwoWay)} weekday trips</p>
            <p className="mt-1 text-paper/70">
              {nameOf(hover.pair.a)} → {nameOf(hover.pair.b)}: {fmtInt(hover.pair.aToB)}
              <br />
              {nameOf(hover.pair.b)} → {nameOf(hover.pair.a)}: {fmtInt(hover.pair.bToA)}
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="flex min-h-[3.4rem] items-center gap-3" aria-live="polite">
          <span className="font-display text-2xl text-walk">
            {Math.min(Math.max(step, 1), STEP_LABELS.length)}/ {STEP_LABELS.length}
          </span>
          <p className="text-chalk-dim">
            {shown.length === 0
              ? "No connections above the display threshold."
              : step <= 1
                ? "Eight communities, one region."
                : step <= 4
                  ? pairLine(shown[step - 2], step - 1)
                  : `Every corridor of ${fmtInt(threshold)}+ daily trips. Durham is tied together.`}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Reveal steps">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => selectStep(i + 1)}
              aria-pressed={step === i + 1}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                step === i + 1
                  ? "border-walk bg-walk/15 text-walk"
                  : "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-night-line bg-night-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-chalk-dim">Strongest corridors</p>
          <ol className="mt-3 space-y-2">
            {shown.slice(0, 6).map((p) => (
              <li key={`${p.a}-${p.b}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-chalk">
                  {nameOf(p.a)} ↔ {nameOf(p.b)}
                </span>
                <span className="tabular-nums text-chalk-dim">{fmtInt(p.totalTwoWay)}</span>
              </li>
            ))}
          </ol>
          <details className="mt-3 text-xs text-chalk-dim">
            <summary className="cursor-pointer hover:text-chalk">All connections as a table</summary>
            <table className="mt-2 w-full text-left">
              <caption className="sr-only">Two-way weekday trips between Durham municipalities</caption>
              <thead>
                <tr className="border-b border-night-line">
                  <th scope="col" className="py-1 font-medium">Connection</th>
                  <th scope="col" className="py-1 text-right font-medium">Weekday trips</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={`${p.a}-${p.b}`} className="border-b border-night-line/40">
                    <td className="py-1">
                      {nameOf(p.a)} ↔ {nameOf(p.b)}
                    </td>
                    <td className="py-1 text-right tabular-nums">{fmtInt(p.totalTwoWay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
          Connections show where trips begin and end — not the roads or transit routes used.
          Showing corridors with at least {fmtInt(threshold)} expanded weekday trips (2022 TTS).
          Tap a community to isolate its connections.
        </p>
      </div>
    </div>
  );
}

const MUNI_NAMES: Record<string, string> = {
  brock: "Brock",
  uxbridge: "Uxbridge",
  scugog: "Scugog",
  pickering: "Pickering",
  ajax: "Ajax",
  whitby: "Whitby",
  oshawa: "Oshawa",
  clarington: "Clarington",
};
const nameOf = (id: string) => MUNI_NAMES[id] ?? id;
const labelOf = (p: OdPairFlow) => `${nameOf(p.a)}–${nameOf(p.b)} ${fmtInt(p.totalTwoWay)}`;
const pairLine = (p: OdPairFlow | undefined, rank: number) =>
  p
    ? `#${rank + 1}: ${nameOf(p.a)} ↔ ${nameOf(p.b)} — ${fmtInt(p.totalTwoWay)} trips a day.`
    : "More connections appear as they are revealed.";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}
