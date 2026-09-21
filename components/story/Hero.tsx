import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bboxOf, centroidOf, projectGeometry, ringsToPath } from "@/lib/geo-path";

/**
 * Chapter 0 — Hero. The Durham outline is inlined as SVG at build time:
 * the title renders immediately, no map bundle required. Animation is a
 * one-time draw-on plus gentle pulses, disabled under reduced motion.
 */
export function Hero({ districts }: { districts: { id: string; name: string }[] }) {
  const raw = readFileSync(resolve(process.cwd(), "public/data/durham-outline.geojson"), "utf8");
  const outline = JSON.parse(raw) as {
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
  };
  const geom = outline.geometry as { type: "Polygon" | "MultiPolygon"; coordinates: never };

  const W = 560;
  const H = 620;
  const bb = bboxOf(geom);
  const rings = projectGeometry(geom, bb, { width: W, height: H, padding: 24 });
  const path = ringsToPath(rings);
  const [cx, cy] = centroidOf(rings);

  // Municipality marks (server-computed centroids of the PD polygons).
  const districtsFile = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/data/planning-districts.geojson"), "utf8"),
  ) as {
    features: { properties: { id: string; name: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: never } }[];
  };
  const marks = districtsFile.features.map((f) => {
    const r = projectGeometry(f.geometry, bb, { width: W, height: H, padding: 24 });
    const [x, y] = centroidOf(r);
    return { id: f.properties.id, name: f.properties.name, x, y };
  });

  return (
    <section
      id="top"
      className="dark-section dark-textured relative flex min-h-[100svh] flex-col overflow-hidden"
      aria-label="Durham in Motion — introduction"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full max-h-[92svh] w-auto opacity-90"
          role="img"
          aria-label="Outline of Durham Region with its eight area municipalities"
        >
          <defs>
            <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16222a" />
              <stop offset="100%" stopColor="#101a20" />
            </linearGradient>
          </defs>
          <path
            d={path}
            fill="url(#hero-fill)"
            stroke="#3d5a58"
            strokeWidth="1.4"
            className="motion-safe:animate-[draw_2.8s_ease-out_forwards]"
            style={{ strokeDasharray: 4200, strokeDashoffset: 4200 }}
          />
          <circle cx={cx} cy={cy} r="4" fill="#f5b043" className="motion-safe:animate-[pulse_3.2s_ease-in-out_1.2s_infinite]" />
          {marks.map((m, i) => (
            <g key={m.id} className="motion-safe:animate-[fadein_1s_ease-out_forwards]" style={{ opacity: 0, animationDelay: `${1 + i * 0.18}s` }}>
              <circle cx={m.x} cy={m.y} r="2.4" fill="#7fd6cc" />
              <text x={m.x + 7} y={m.y + 3.5} fontSize="11.5" fill="#a9b6b4" fontFamily="var(--font-inter)">
                {m.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-walk">
          Based on the 2022 Transportation Tomorrow Survey
        </p>
        <h1 className="max-w-[14ch] font-display text-[clamp(3.2rem,9vw,7rem)] font-semibold leading-[0.98] tracking-tight text-chalk">
          Durham
          <br />
          in Motion
        </h1>
        <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-chalk-dim">
          A portrait of how Durham Region moves on a typical weekday — and how that story has changed
          over nearly four decades.
        </p>
        <a
          href="#meet-durham"
          className="group mt-12 inline-flex w-fit items-center gap-3 rounded-full border border-night-line bg-night-soft/80 px-6 py-3 text-sm font-semibold text-chalk transition-colors hover:border-walk hover:text-walk"
        >
          Start exploring
          <span aria-hidden className="transition-transform group-hover:translate-y-0.5 motion-reduce:transition-none">↓</span>
        </a>
      </div>
    </section>
  );
}
