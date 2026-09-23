"use client";

import { fmtPct } from "@/lib/format";
import { useIsNarrow } from "@/lib/hooks";
import {
  wahChanges,
  wahSentence,
  directionOf,
  directionCounts,
  regionSummary,
  type WahChange,
} from "@/lib/wah-story";
import type { MunicipalitiesFile, Share } from "@/lib/types";

const INCREASE = "#7fd6cc";
const DECLINE = "#e0856d";
const FLAT = "#9fb3c9";

/**
 * Chapter — “Change was uneven: working at home”. The 2016→2022 work-at-home
 * change was a large regional increase that did not happen everywhere: Ajax
 * more than tripled while Uxbridge and Scugog declined. Every sentence is
 * generated from tested predicates in lib/wah-story.ts; both endpoint values
 * come explicitly from the curated data. Point estimates only — no
 * significance or causation is claimed.
 */
export function WorkAtHomeDivergence({ data, region2016 }: { data: MunicipalitiesFile; region2016: Share }) {
  const changes = wahChanges(data.municipalities);
  const counts = directionCounts(changes);
  const region = regionSummary(region2016, data.region.workAtHomeShare);

  const increased = changes.filter((c) => directionOf(c.pp) === "increase");
  const declined = changes.filter((c) => directionOf(c.pp) === "decline");
  const topIncrease = [...increased].sort((a, b) => (b.pp ?? 0) - (a.pp ?? 0))[0];
  const regionValue2016 = region2016.value;
  const declinersStartedAboveRegion =
    regionValue2016 !== null && declined.length > 0 && declined.every((c) => (c.y2016.value ?? 0) > regionValue2016);

  const narrow = useIsNarrow();

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
      <div>
        <p className="chapter-kicker">Change was uneven</p>
        <h3 className="mt-3 font-display text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-tight text-chalk">
          Working at home rose region-wide — but not everywhere.
        </h3>
        <p className="prose-story mt-5">{region.sentence}</p>
        <p className="prose-story mt-4">
          Behind that regional average sit very different community stories:{" "}
          {counts.increase} of the eight municipalities saw their work-at-home share rise
          {counts.decline > 0
            ? `; ${counts.decline} declined${declinersStartedAboveRegion ? " — and each of them started above the regional share in 2016" : ""}`
            : ""}
          .{topIncrease && topIncrease.pp !== null
            ? ` The largest increase was ${topIncrease.name} (${(topIncrease.pp * 100).toFixed(1)} pp).`
            : ""}
        </p>
        <ul className="mt-5 space-y-2 text-sm leading-relaxed text-chalk-dim">
          {[...increased.sort((a, b) => (b.pp ?? 0) - (a.pp ?? 0)), ...declined].map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorOf(c) }}
              />
              {wahSentence(c)}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-chalk-dim">
          Measured as usually working at home (full-time plus part-time) as a share of employed
          residents, 2016 and 2022 TTS. Employment questions are comparable across these cycles.
          These are survey point estimates; we do not claim statistical significance, and the
          survey alone cannot say why the change happened.
        </p>
      </div>

      {narrow ? (
        <figure>
          <figcaption className="sr-only">
            Work-at-home share of employed residents by municipality, 2016 and 2022, with
            percentage-point change. {changes.map((c) => `${c.name}: ${fmtPct(c.y2016.value)} to ${fmtPct(c.y2022.value)}`).join("; ")}.
          </figcaption>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-night-line text-left text-xs uppercase tracking-wide text-chalk-dim">
                <th scope="col" className="py-2 font-medium">Municipality</th>
                <th scope="col" className="py-2 text-right font-medium">2016</th>
                <th scope="col" className="py-2 text-right font-medium">2022</th>
                <th scope="col" className="py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {[...changes]
                .sort((a, b) => (b.pp ?? -99) - (a.pp ?? -99))
                .map((c) => (
                  <tr key={c.id} className="border-b border-night-line/40">
                    <td className="py-2 font-medium text-chalk">{c.name}</td>
                    <td className="py-2 text-right tabular-nums text-chalk-dim">{fmtPct(c.y2016.value)}</td>
                    <td className="py-2 text-right tabular-nums text-chalk">{fmtPct(c.y2022.value)}</td>
                    <td
                      className="py-2 text-right tabular-nums font-semibold"
                      style={{ color: colorOf(c) }}
                    >
                      {c.pp === null ? "—" : `${c.pp >= 0 ? "+" : "−"}${Math.abs(c.pp * 100).toFixed(1)} pp`}
                    </td>
                  </tr>
                ))}
              <tr className="border-t-2 border-night-line">
                <td className="py-2 font-semibold text-chalk">Durham Region</td>
                <td className="py-2 text-right tabular-nums text-chalk-dim">{fmtPct(region2016.value)}</td>
                <td className="py-2 text-right tabular-nums font-semibold text-chalk">
                  {fmtPct(data.region.workAtHomeShare.value)}
                </td>
                <td className="py-2 text-right tabular-nums font-semibold text-walk">
                  {region.pp === null ? "—" : `+${(region.pp * 100).toFixed(1)} pp`}
                </td>
              </tr>
            </tbody>
          </table>
        </figure>
      ) : (
        <SlopeChart changes={changes} region2016={region2016} region2022={data.region.workAtHomeShare} />
      )}
    </div>
  );
}

function colorOf(c: WahChange): string {
  switch (directionOf(c.pp)) {
    case "increase":
      return INCREASE;
    case "decline":
      return DECLINE;
    case "little-change":
      return FLAT;
    default:
      return "#8a9099";
  }
}

function SlopeChart({
  changes,
  region2016,
  region2022,
}: {
  changes: WahChange[];
  region2016: Share;
  region2022: Share;
}) {
  const sorted = [...changes].sort((a, b) => (b.y2022.value ?? 0) - (a.y2022.value ?? 0));
  const W = 760;
  const H = 430;
  const padL = 120;
  const padR = 120;
  const padT = 30;
  const padB = 30;
  const x0 = padL;
  const x1 = W - padR;
  const allVals = [
    ...sorted.flatMap((p) => [p.y2016.value, p.y2022.value]),
    region2016.value,
    region2022.value,
  ].filter((v): v is number => v !== null);
  const vHi = Math.max(0.2, ...allVals) * 1.15;
  const yOf = (v: number) => H - padB - (v / vHi) * (H - padT - padB);

  /** Greedy vertical repel so labels never overprint. */
  const repel = (items: { y: number }[], gap: number): void => {
    const ordered = [...items].sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const item of ordered) {
      item.y = Math.max(item.y, prev + gap);
      prev = item.y;
    }
  };
  const leftY = sorted.map((p) => ({ y: yOf(p.y2016.value ?? 0) }));
  leftY.push({ y: yOf(region2016.value ?? 0) });
  const rightY = sorted.map((p) => ({ y: yOf(p.y2022.value ?? 0) }));
  rightY.push({ y: yOf(region2022.value ?? 0) - 10 });
  repel(leftY, 16);
  repel(rightY, 16);
  const regionLeftY = leftY[leftY.length - 1]!.y;
  const regionRightY = rightY[rightY.length - 1]!.y;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Slope chart: share of employed residents usually working at home, 2016 to 2022. Durham Region went from ${fmtPct(region2016.value)} to ${fmtPct(region2022.value)}. ${sorted.map((s) => `${s.name} from ${fmtPct(s.y2016.value)} to ${fmtPct(s.y2022.value)}`).join("; ")}.`}
      >
        <text x={x0} y={padT - 12} textAnchor="middle" fontSize={13} fill="#a9b6b4" fontWeight="600">2016</text>
        <text x={x1} y={padT - 12} textAnchor="middle" fontSize={13} fill="#a9b6b4" fontWeight="600">2022</text>

        <line x1={x0} y1={yOf(region2016.value ?? 0)} x2={x1} y2={yOf(region2022.value ?? 0)} stroke="#f5b043" strokeWidth="3" strokeLinecap="round" />
        <circle cx={x0} cy={yOf(region2016.value ?? 0)} r="4.5" fill="#f5b043" />
        <circle cx={x1} cy={yOf(region2022.value ?? 0)} r="4.5" fill="#f5b043" />
        <text x={x0 - 8} y={regionLeftY + 4} textAnchor="end" fontSize={12.5} fill="#f5b043" fontWeight="600">
          Durham {fmtPct(region2016.value)}
        </text>
        <text x={x1 + 8} y={regionRightY + 4} textAnchor="start" fontSize={12.5} fill="#f5b043" fontWeight="600">
          Durham {fmtPct(region2022.value)}
        </text>

        {sorted.map((p, i) => {
          const col = colorOf(p);
          const a = p.y2016.value ?? 0;
          const b = p.y2022.value ?? 0;
          return (
            <g key={p.id}>
              <line x1={x0} y1={yOf(a)} x2={x1} y2={yOf(b)} stroke={col} strokeWidth="1.8" opacity="0.85" />
              <circle cx={x0} cy={yOf(a)} r="3" fill={col} />
              <circle cx={x1} cy={yOf(b)} r="3" fill={col} />
              <text x={x0 - 8} y={leftY[i]!.y + 3.5} textAnchor="end" fontSize={12} fill="#cfd8d6">
                {p.name} {fmtPct(a)}
              </text>
              <text x={x1 + 8} y={rightY[i]!.y + 3.5} textAnchor="start" fontSize={12} fill={col} fontWeight="600">
                {fmtPct(b)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 text-center text-xs text-chalk-dim">
        Share of employed residents usually working at home, by area municipality, 2016 → 2022 TTS.
        Teal lines rose; red lines declined.
      </figcaption>
    </figure>
  );
}
