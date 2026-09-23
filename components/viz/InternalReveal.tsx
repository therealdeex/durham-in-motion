"use client";

import { useEffect, useRef, useState } from "react";
import { arcPath, type MapGeom } from "@/lib/od-map";
import { fmtInt } from "@/lib/format";

interface RevealTotals {
  allTrips: number;
  internalTrips: number;
  internalShare: number;
  toToronto: number;
  fromToronto: number;
}

/** Fires once when the element scrolls into view. */
function useInView<T extends Element>(threshold = 0.35): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, seen];
}

function useCountUp(target: number, run: boolean, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return value;
}

/**
 * Chapter — “Most movement is local”. A four-frame cinematic reveal:
 * scale (1.44 M) → the Toronto assumption → the 79% reveal → Toronto in
 * proportion. All numbers computed upstream; nothing hard-coded.
 */
export function InternalReveal({ geom, totals }: { geom: MapGeom; totals: RevealTotals }) {
  return (
    <div>
      <Frame1 geom={geom} totals={totals} />
      <Frame2 geom={geom} />
      <Frame3 geom={geom} totals={totals} />
      <Frame4 geom={geom} totals={totals} />
    </div>
  );
}

function Frame1({ geom, totals }: { geom: MapGeom; totals: RevealTotals }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const millions = totals.allTrips / 1_000_000;
  return (
    <div ref={ref} className="grid min-h-[92svh] items-center gap-10 py-16 lg:grid-cols-2">
      <div className={seen ? "motion-safe:animate-[risein_0.9s_ease-out_forwards]" : "opacity-0"}>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-walk">A weekday in Durham</p>
        <p className="mt-6 font-display text-[clamp(3.4rem,9vw,6.4rem)] font-semibold leading-none text-chalk">
          {(Math.floor(millions * 100) / 100).toFixed(2)}
          <span className="block text-[0.42em] leading-tight text-chalk-dim">million trips</span>
        </p>
        <p className="prose-story mt-8 max-w-[44ch]">
          Every weekday, the people of Durham Region make about{" "}
          <strong>{fmtInt(totals.allTrips)} journeys</strong> — to work, school, the store, the rink,
          the grandparents, the GO station. Taken together, they are one of the biggest things this
          region makes.
        </p>
      </div>
      <div className="relative mx-auto w-full max-w-[420px]" aria-hidden>
        <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="w-full opacity-95">
          <path
            d={geom.outlinePath}
            fill="#141f26"
            stroke="#3d5a58"
            strokeWidth="1.6"
            className={seen ? "motion-safe:animate-[draw_2.6s_ease-out_forwards]" : ""}
            style={{ strokeDasharray: 4200, strokeDashoffset: 4200 }}
          />
        </svg>
      </div>
    </div>
  );
}

function Frame2({ geom }: { geom: MapGeom }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className="grid min-h-[92svh] items-center gap-10 py-16 lg:grid-cols-2">
      <div className={seen ? "motion-safe:animate-[risein_0.9s_ease-out_forwards]" : "opacity-0"}>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-walk">The assumption</p>
        <h3 className="mt-5 max-w-[16ch] font-display text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-tight text-chalk">
          Where do all those journeys go?
        </h3>
        <p className="prose-story mt-6 max-w-[44ch]">
          Say “Durham and transportation” and most people picture one thing: the long grind down the
          401 toward <strong>Toronto</strong>. It&apos;s the region&apos;s most talked-about trip.
          It looks like it must dominate everything.
        </p>
        <p className="prose-story mt-4 max-w-[44ch] text-chalk-dim">Does it?</p>
      </div>
      <div className="relative mx-auto w-full max-w-[420px]" aria-hidden>
        <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="w-full opacity-95">
          <path d={geom.outlinePath} fill="#141f26" stroke="#3d5a58" strokeWidth="1.6" />
          {geom.municipalities.map((m, i) => (
            <g
              key={m.id}
              className={seen ? "motion-safe:animate-[fadein_0.7s_ease-out_forwards]" : "opacity-0"}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <circle cx={m.cx} cy={m.cy} r="2.6" fill="#7fd6cc" />
              <text x={m.cx + 8} y={m.cy + 3.5} fontSize="12.5" fill="#a9b6b4" fontFamily="var(--font-inter)">
                {m.name}
              </text>
            </g>
          ))}
          <g
            className={seen ? "motion-safe:animate-[fadein_0.9s_ease-out_0.9s_forwards]" : "opacity-0"}
            style={{ animationDelay: "0.9s" }}
          >
            <circle cx={geom.toronto.x} cy={geom.toronto.y} r="5" fill="#c2502e" />
            <circle
              cx={geom.toronto.x}
              cy={geom.toronto.y}
              r="5"
              fill="none"
              stroke="#c2502e"
              className="motion-safe:animate-[pulse_2.6s_ease-in-out_1.6s_infinite]"
            />
            <text
              x={geom.toronto.x + 10}
              y={geom.toronto.y + 4}
              fontSize="14"
              fontWeight="600"
              fill="#e5b9a8"
              fontFamily="var(--font-inter)"
            >
              Toronto
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function Frame3({ geom, totals }: { geom: MapGeom; totals: RevealTotals }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const counted = useCountUp(Math.round((totals.internalShare * 100)), seen);
  const keepPct = totals.internalShare * 100;
  return (
    <div ref={ref} className="grid min-h-[100svh] items-center gap-10 py-20 lg:grid-cols-2">
      <div className="order-2 lg:order-1" aria-hidden>
        <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="mx-auto w-full max-w-[420px] opacity-95">
          <path d={geom.outlinePath} fill="#141f26" stroke="#3d5a58" strokeWidth="1.6" />
          {/* internal web fades in behind the number */}
          <g
            fill="none"
            stroke="#2e8f86"
            className={seen ? "motion-safe:animate-[fadein_1.6s_ease-out_0.5s_forwards]" : "opacity-0"}
          >
            {geom.municipalities.map((a, i) =>
              geom.municipalities.slice(i + 1).map((b) => (
                <path key={`${a.id}-${b.id}`} d={arcPath(a.cx, a.cy, b.cx, b.cy, 0.16)} strokeWidth="1.1" opacity="0.55" />
              )),
            )}
          </g>
          {/* four-in-five motif: five marks, four lit */}
          <g className={seen ? "motion-safe:animate-[fadein_1s_ease-out_1.2s_forwards]" : "opacity-0"}>
            {[0, 1, 2, 3, 4].map((i) => (
              <circle
                key={i}
                cx={geom.W / 2 - 78 + i * 39}
                cy={geom.H - 46}
                r={i < 4 ? 11 : 11}
                fill={i < 4 ? "#f5b043" : "none"}
                stroke={i < 4 ? "#f5b043" : "#5a6a68"}
                strokeWidth="2"
                strokeDasharray={i < 4 ? undefined : "4 4"}
              />
            ))}
            <text x={geom.W / 2} y={geom.H - 14} textAnchor="middle" fontSize="13" fill="#a9b6b4" fontFamily="var(--font-inter)">
              each mark = 1 in 5 trips
            </text>
          </g>
        </svg>
      </div>
      <div className="order-1 lg:order-2">
        <div className={seen ? "motion-safe:animate-[risein_0.9s_ease-out_forwards]" : "opacity-0"}>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-walk">The reveal</p>
          <p className="mt-6 font-display text-[clamp(5rem,16vw,11rem)] font-semibold leading-none text-walk">
            {seen ? counted : 0}%
          </p>
          <h3 className="mt-4 max-w-[16ch] font-display text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-tight text-chalk">
            Most trips never leave Durham.
          </h3>
          <p className="prose-story mt-6 max-w-[46ch]">
            About <strong>four in five weekday trips made by Durham residents both begin and end
            within Durham Region</strong> — {fmtInt(totals.internalTrips)} of {fmtInt(totals.allTrips)}.
            The region&apos;s biggest travel network is its own.
          </p>
        </div>
      </div>
      <span className="sr-only">
        {keepPct.toFixed(1)} percent of weekday trips made by Durham residents begin and end within Durham
        Region — {fmtInt(totals.internalTrips)} of {fmtInt(totals.allTrips)} trips.
      </span>
    </div>
  );
}

function Frame4({ geom, totals }: { geom: MapGeom; totals: RevealTotals }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const oshawa = geom.municipalities.find((m) => m.id === "oshawa") ?? geom.municipalities[0]!;
  return (
    <div ref={ref} className="grid min-h-[92svh] items-center gap-10 py-16 lg:grid-cols-2">
      <div aria-hidden>
        <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="mx-auto w-full max-w-[420px] opacity-95">
          <path d={geom.outlinePath} fill="#141f26" stroke="#3d5a58" strokeWidth="1.6" />
          <path
            d={arcPath(oshawa.cx, oshawa.cy, geom.toronto.x, geom.toronto.y, 0.22)}
            fill="none"
            stroke="#c2502e"
            strokeWidth="2.4"
            strokeLinecap="round"
            className={seen ? "motion-safe:animate-[draw_1.8s_ease-out_forwards]" : ""}
            style={{ strokeDasharray: 620, strokeDashoffset: seen ? 620 : 620 }}
          />
          <circle cx={geom.toronto.x} cy={geom.toronto.y} r="5" fill="#c2502e" />
          <text
            x={geom.toronto.x + 10}
            y={geom.toronto.y + 4}
            fontSize="14"
            fontWeight="600"
            fill="#e5b9a8"
            fontFamily="var(--font-inter)"
          >
            Toronto
          </text>
          <circle cx={oshawa.cx} cy={oshawa.cy} r="3.4" fill="#7fd6cc" />
        </svg>
      </div>
      <div className={seen ? "motion-safe:animate-[risein_0.9s_ease-out_forwards]" : "opacity-0"}>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-walk">And Toronto?</p>
        <h3 className="mt-5 max-w-[18ch] font-display text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-tight text-chalk">
          Toronto matters — it just isn&apos;t the whole story.
        </h3>
        <p className="prose-story mt-6 max-w-[46ch]">
          About <strong>{fmtInt(totals.toToronto)} weekday trips</strong> run from Durham to Toronto —
          and a nearly identical {fmtInt(totals.fromToronto)} flow the other way. Real, constant,
          important. And still fewer than one trip in seventeen. The other sixteen stay closer to
          home.
        </p>
      </div>
    </div>
  );
}
