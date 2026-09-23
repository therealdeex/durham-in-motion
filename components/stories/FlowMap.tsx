"use client";

import { useMemo } from "react";
import { arcPath, type MapGeom } from "@/lib/od-map";
import { OUTSIDE_ID, type FlowScene } from "@/lib/stories/types";
import { fmtInt } from "@/lib/format";

/**
 * The reusable flow-map renderer. Draws one FlowScene — internal arcs between
 * municipality nodes, node weight for within-node volume, and aggregate
 * exchange with the world beyond Durham (the OUTSIDE_ID pseudo-node).
 *
 * Deliberately unbound to time: A Day in Durham feeds it scenes with
 * `timestamp`; a future "Every Mode Has Its Own Map" can feed persistent
 * mode-network states through the same interface.
 */
export function FlowMap({
  geom,
  scene,
  maxValue,
  labelBeyond = "Beyond Durham",
  ariaLabel,
  nodeValueById,
  compact = false,
}: {
  geom: MapGeom;
  scene: FlowScene | null;
  /** Reference value for width scaling across scenes (keeps strokes comparable). */
  maxValue: number;
  labelBeyond?: string;
  ariaLabel?: string;
  /** Optional within-node volumes (e.g. trips staying in each municipality). */
  nodeValueById?: Record<string, number>;
  compact?: boolean;
}) {
  const nodeOf = useMemo(() => {
    const m = new Map(geom.municipalities.map((x) => [x.id, x]));
    m.set(OUTSIDE_ID, { id: OUTSIDE_ID, name: labelBeyond, path: "", cx: geom.toronto.x, cy: geom.toronto.y });
    return m;
  }, [geom, labelBeyond]);

  const internal = scene?.flows.filter((f) => f.originId !== OUTSIDE_ID && f.destinationId !== OUTSIDE_ID) ?? [];
  const outbound = scene?.flows.filter((f) => f.destinationId === OUTSIDE_ID) ?? [];
  const inbound = scene?.flows.filter((f) => f.originId === OUTSIDE_ID) ?? [];
  const outTotal = outbound.reduce((a, f) => a + f.value, 0);
  const inTotal = inbound.reduce((a, f) => a + f.value, 0);
  const maxNode = nodeValueById
    ? Math.max(1, ...Object.values(nodeValueById))
    : 1;

  const strokeWidth = (v: number) => 1.2 + (compact ? 5 : 7) * Math.sqrt(v / (maxValue || 1));

  // boundary exchange drawn as two aggregate arcs between the outline and the
  // beyond-node — width comparable to internal arcs, direction encoded by color
  const durhamCore = geom.municipalities[0];
  const anchorX = durhamCore ? geom.municipalities.reduce((a, m) => a + m.cx, 0) / geom.municipalities.length : 0;
  const anchorY = durhamCore ? geom.municipalities.reduce((a, m) => a + m.cy, 0) / geom.municipalities.length : 0;
  const beyond = nodeOf.get(OUTSIDE_ID)!;

  return (
    <svg
      viewBox={`0 0 ${geom.W} ${geom.H}`}
      className="h-full w-full"
      role="img"
      aria-label={ariaLabel ?? `Movement map: ${scene?.title ?? "no time selected"}`}
    >
      <path d={geom.outlinePath} fill="#101a20" stroke="#2a3d44" strokeWidth="1.4" />
      {geom.municipalities.map((m) => {
        const v = nodeValueById?.[m.id] ?? 0;
        return (
          <g key={m.id}>
            <path d={m.path} fill="transparent" stroke="#233139" strokeWidth="1" />
            {v > 0 && (
              <circle
                cx={m.cx}
                cy={m.cy}
                r={3 + 7 * Math.sqrt(v / maxNode)}
                fill="#7fd6cc"
                opacity={0.1 + 0.25 * Math.sqrt(v / maxNode)}
                className="transition-all duration-500 motion-reduce:transition-none"
              />
            )}
            <circle cx={m.cx} cy={m.cy} r="2.6" fill="#7fd6cc" opacity={v > 0 ? 1 : 0.55} />
          </g>
        );
      })}

      {internal.map((f) => {
        const a = nodeOf.get(f.originId);
        const b = nodeOf.get(f.destinationId);
        if (!a || !b) return null;
        return (
          <path
            key={`${f.originId}-${f.destinationId}`}
            d={arcPath(a.cx, a.cy, b.cx, b.cy, 0.16)}
            fill="none"
            stroke="#7fd6cc"
            strokeLinecap="round"
            strokeOpacity={0.8}
            strokeWidth={strokeWidth(f.value)}
            className="transition-[stroke-width] duration-500 motion-reduce:transition-none"
          />
        );
      })}

      {outTotal > 0 && (
        <path
          d={arcPath(anchorX, anchorY, beyond.cx, beyond.cy + 14, 0.1)}
          fill="none"
          stroke="#c2502e"
          strokeLinecap="round"
          strokeOpacity={0.75}
          strokeWidth={strokeWidth(outTotal)}
          className="transition-[stroke-width] duration-500 motion-reduce:transition-none"
        />
      )}
      {inTotal > 0 && (
        <path
          d={arcPath(beyond.cx, beyond.cy - 14, anchorX, anchorY, -0.1)}
          fill="none"
          stroke="#f5b043"
          strokeLinecap="round"
          strokeOpacity={0.8}
          strokeWidth={strokeWidth(inTotal)}
          className="transition-[stroke-width] duration-500 motion-reduce:transition-none"
        />
      )}
      <circle cx={beyond.cx} cy={beyond.cy} r="3.5" fill={inTotal > outTotal ? "#f5b043" : "#c2502e"} />
      {!compact && (
        <text x={beyond.cx + 8} y={beyond.cy + 4} fontSize="11" fill="#a9b6b4" fontFamily="var(--font-inter)">
          {labelBeyond}
        </text>
      )}
      {(outTotal > 0 || inTotal > 0) && !compact && (
        <text
          x={beyond.cx - 4}
          y={beyond.cy + 22}
          fontSize="10"
          fill="#a9b6b4"
          textAnchor="end"
          fontFamily="var(--font-inter)"
        >
          <tspan fill="#c2502e">→ {fmtInt(outTotal)}</tspan>
          <tspan fill="#f5b043"> ← {fmtInt(inTotal)}</tspan>
        </text>
      )}

      {/* label layer painted above the arcs, haloed for legibility */}
      {geom.municipalities.map((m) => (
        <text
          key={m.id}
          x={m.cx + 6}
          y={m.cy + 3.5}
          fontSize={compact ? "9.5" : "10.5"}
          fill="#ecf1f0"
          opacity={0.95}
          fontFamily="var(--font-inter)"
          style={{ paintOrder: "stroke" }}
          stroke="#0f1418"
          strokeWidth="2.4"
          strokeLinejoin="round"
        >
          {m.name}
        </text>
      ))}
    </svg>
  );
}
