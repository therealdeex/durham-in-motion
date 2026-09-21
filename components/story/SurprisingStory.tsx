"use client";

import { fmtPct } from "@/lib/format";
import { useIsNarrow } from "@/lib/hooks";
import type { MunicipalitiesFile } from "@/lib/types";

/**
 * Chapter 6 — One Surprising Story: the rise of working at home.
 * A slope chart of every municipality, 2016 → 2022 (both shares are
 * employment measures — directly comparable despite the 2022 travel changes).
 */
export function SurprisingStory({ data, region2016 }: { data: MunicipalitiesFile; region2016: number }) {
  const points = data.municipalities
    .map((m) => ({
      name: m.geographyName,
      id: m.geographyId,
      before: (m.workAtHomeShare.value ?? 0) - (m.change2016to2022.workAtHomeShare ?? 0),
      after: m.workAtHomeShare.value,
    }))
    .filter((p) => m_ok(p.before) && m_ok(p.after));

  const regionAfter = data.region.workAtHomeShare.value ?? 0;

  const narrow = useIsNarrow();
  const W = narrow ? 350 : 760;
  const H = narrow ? 340 : 430;
  const padL = narrow ? 78 : 120;
  const padR = narrow ? 52 : 120;
  const padT = 30;
  const padB = 30;
  const nameFont = narrow ? 9.5 : 11.5;
  const valueFont = narrow ? 9.5 : 11.5;
  const yearFont = narrow ? 11 : 13;
  const x0 = padL;
  const x1 = W - padR;
  const vLo = 0;
  const vHi = Math.max(0.2, ...points.map((p) => Math.max(p.before, p.after ?? 0))) * 1.15;
  const yOf = (v: number) => H - padB - (v / vHi) * (H - padT - padB);

  const sorted = [...points].sort((a, b) => (b.after ?? 0) - (a.after ?? 0));

  /** Greedy vertical repel in place: keeps labels >= minGap apart, top→bottom. */
  const minGap = narrow ? 11.5 : 16;
  const repel = (items: { y: number }[], gap = minGap): void => {
    const ordered = [...items].sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const item of ordered) {
      item.y = Math.max(item.y, prev + gap);
      prev = item.y;
    }
  };
  // Region labels join the same repel pass so nothing overprints (they sit
  // last in each array; index kept for rendering).
  const leftY = sorted.map((p) => ({ y: yOf(p.before) }));
  leftY.push({ y: yOf(region2016) });
  const rightY = sorted.map((p) => ({ y: yOf(p.after ?? 0) }));
  rightY.push({ y: yOf(regionAfter) - 10 });
  repel(leftY);
  repel(rightY);
  const regionLeftY = leftY[leftY.length - 1].y;
  const regionRightY = rightY[rightY.length - 1].y;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
      <div>
        <p className="chapter-kicker">The finding</p>
        <h3 className="mt-3 font-display text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-tight text-chalk">
          Working at home doubled in six years.
        </h3>
        <p className="prose-story mt-5">
          In 2016, {fmtPct(region2016)} of employed Durham residents usually worked at home. By 2022 —
          after two years of pandemic-era hybrid work — it was{" "}
          <strong>{fmtPct(regionAfter)}</strong>. No other measured travel behaviour in the survey has
          moved this far, this fast.
        </p>
        <p className="prose-story mt-4">
          It shows up everywhere: every municipality's share roughly doubled. Rural and suburban
          communities lead — home-based work is now a bigger share of employment than transit is of trips
          in most of Durham.
        </p>
        <p className="mt-5 text-xs leading-relaxed text-chalk-dim">
          Measured as usually working at home, full-time plus part-time, as a share of employed residents.
          Employment questions are comparable across cycles.
        </p>
      </div>

      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Slope chart: share of employed residents usually working at home, 2016 to 2022. Region went from ${fmtPct(region2016)} to ${fmtPct(regionAfter)}. ${sorted.map((s) => `${s.name} from ${fmtPct(s.before)} to ${fmtPct(s.after)}`).join("; ")}.`}>
          {/* guides */}
          <text x={x0} y={padT - 12} textAnchor="middle" fontSize={yearFont} fill="#a9b6b4" fontWeight="600">2016</text>
          <text x={x1} y={padT - 12} textAnchor="middle" fontSize={yearFont} fill="#a9b6b4" fontWeight="600">2022</text>

          {/* region line highlighted */}
          <line
            x1={x0} y1={yOf(region2016)} x2={x1} y2={yOf(regionAfter)}
            stroke="#f5b043" strokeWidth="3" strokeLinecap="round"
          />
          <circle cx={x0} cy={yOf(region2016)} r="4.5" fill="#f5b043" />
          <circle cx={x1} cy={yOf(regionAfter)} r="4.5" fill="#f5b043" />
          <text x={x0 - 8} y={regionLeftY + 4} textAnchor="end" fontSize={valueFont + 1} fill="#f5b043" fontWeight="600">
            Durham {fmtPct(region2016)}
          </text>
          <text x={x1 + 8} y={regionRightY + 4} textAnchor="start" fontSize={valueFont + 1} fill="#f5b043" fontWeight="600">
            {narrow ? "" : "Durham "}
            {fmtPct(regionAfter)}
          </text>

          {/* municipality lines */}
          {sorted.map((p, i) => {
            const after = p.after ?? 0;
            const col = i % 2 === 0 ? "#9fd8cf" : "#7fb3e0";
            return (
              <g key={p.id}>
                <line x1={x0} y1={yOf(p.before)} x2={x1} y2={yOf(after)} stroke={col} strokeWidth="1.6" opacity="0.75" />
                <circle cx={x0} cy={yOf(p.before)} r="3" fill={col} />
                <circle cx={x1} cy={yOf(after)} r="3" fill={col} />
                <text x={x0 - 8} y={leftY[i].y + 3.5} textAnchor="end" fontSize={nameFont} fill="#cfd8d6">
                  {p.name}
                </text>
                <text x={x1 + 8} y={rightY[i].y + 3.5} textAnchor="start" fontSize={valueFont} fill={col}>
                  {fmtPct(after)}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-3 text-center text-xs text-chalk-dim">
          Share of employed residents usually working at home, by area municipality. 2022 TTS vs 2016 TTS.
        </figcaption>
      </figure>
    </div>
  );
}

const m_ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
