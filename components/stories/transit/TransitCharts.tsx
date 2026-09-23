import type { ReactNode } from "react";
import { fmtCompact, fmtInt, fmtPct } from "@/lib/format";
import { ACCESS_LABEL, type AccessKey, type StationProfile, type TransitStoryFile } from "@/lib/stories/types";
import { getGoDestinationDistribution, getSupportedStationPairs } from "@/lib/stories/selectors";

/** Access-type colors on the paper theme (walk gold, car blues, cycle red). */
const ACCESS_COLOR: Record<AccessKey, string> = {
  walk: "#f5b043",
  drive: "#33567d",
  passenger: "#a3bfd6",
  cycle: "#cc4b37",
  other: "#98938a",
};

const ACCESS_ORDER: AccessKey[] = ["walk", "drive", "passenger", "cycle", "other"];

/** Section wrapper for the paper-themed story. */
export function TransitSection({
  id,
  kicker,
  title,
  lead,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-line" aria-labelledby={`${id}-h`}>
      <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
        <p className="chapter-kicker light">{kicker}</p>
        <h2 id={`${id}-h`} className="mt-3 max-w-[24ch] font-display text-[clamp(1.9rem,4vw,2.8rem)] font-semibold leading-tight text-ink">
          {title}
        </h2>
        {lead && <div className="prose-story mt-5 space-y-4">{lead}</div>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** 100%-width stacked strip with labelled segments (system-wide access). */
export function AccessStrip({ access }: { access: Record<AccessKey, number> }) {
  const total = Object.values(access).reduce((a, b) => a + b, 0);
  const rows = ACCESS_ORDER.map((k) => ({ k, v: access[k], share: total ? access[k]! / total : 0 }));
  return (
    <figure>
      <div className="flex h-12 w-full overflow-hidden rounded-lg border border-line" role="img" aria-label={rows.map((r) => `${ACCESS_LABEL[r.k]} ${fmtPct(r.share, 0)}`).join(", ")}>
        {rows
          .filter((r) => r.share > 0.004)
          .map((r) => (
            <div
              key={r.k}
              className="flex h-full items-center justify-center"
              style={{ width: `${r.share * 100}%`, background: ACCESS_COLOR[r.k] }}
              title={`${ACCESS_LABEL[r.k]}: ${fmtInt(r.v)} journeys (${fmtPct(r.share, 0)})`}
            >
              {r.share > 0.1 && (
                <span className={`text-xs font-semibold ${r.k === "passenger" ? "text-ink" : "text-paper"}`}>
                  {fmtPct(r.share, 0)}
                </span>
              )}
            </div>
          ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-soft">
        {rows
          .filter((r) => r.share > 0.004)
          .map((r) => (
            <span key={r.k} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: ACCESS_COLOR[r.k] }} />
              {ACCESS_LABEL[r.k]} · <span className="tabular-nums">{fmtInt(r.v)}</span> ({fmtPct(r.share, 0)})
            </span>
          ))}
      </figcaption>
    </figure>
  );
}

/** Per-station access: one labelled stacked bar per GO station. */
export function StationAccess({ stations }: { stations: StationProfile[] }) {
  const max = Math.max(...stations.map((s) => s.boardings));
  return (
    <figure className="space-y-6">
      {stations.map((s) => {
        const rows = ACCESS_ORDER.map((k) => ({ k, v: s.access[k], share: s.boardings ? s.access[k]! / s.boardings : 0 }));
        return (
          <div key={s.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-ink">{s.name}</h3>
              <p className="text-xs text-ink-soft">
                <span className="tabular-nums">{fmtInt(s.boardings)}</span> boardings ·{" "}
                <strong className="text-ink">{fmtPct(s.carShare, 1)}</strong> arrive by car (drive + dropped off)
                {s.walkShare > 0.15 && (
                  <>
                    {" "}· <strong className="text-ink">{fmtPct(s.walkShare, 1)}</strong> walk
                  </>
                )}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="flex h-9 overflow-hidden rounded-md border border-line"
                style={{ width: `${(s.boardings / max) * 100}%` }}
                role="img"
                aria-label={`${s.name} access: ${rows.filter((r) => r.share > 0.004).map((r) => `${ACCESS_LABEL[r.k]} ${fmtPct(r.share, 0)}`).join(", ")}`}
              >
                {rows
                  .filter((r) => r.share > 0.004)
                  .map((r) => (
                    <div key={r.k} style={{ width: `${r.share * 100}%`, background: ACCESS_COLOR[r.k] }} title={`${ACCESS_LABEL[r.k]}: ${fmtPct(r.share, 0)}`} />
                  ))}
              </div>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-ink-soft">
              {rows
                .filter((r) => r.share > 0.004)
                .map((r) => (
                  <span key={r.k} className="inline-flex items-center gap-1">
                    <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: ACCESS_COLOR[r.k] }} />
                    {ACCESS_LABEL[r.k]} {fmtPct(r.share, 0)}
                  </span>
                ))}
            </p>
          </div>
        );
      })}
    </figure>
  );
}

/** Boardings comparison: horizontal bars, Whitby/Oshawa parity highlighted. */
export function BoardingsBars({ stations }: { stations: StationProfile[] }) {
  const max = Math.max(...stations.map((s) => s.boardings));
  return (
    <figure className="space-y-3">
      {stations.map((s) => (
        <div key={s.id} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-sm font-medium text-ink">{s.name.replace(" GO", "")}</span>
          <div className="h-8 flex-1 rounded-md bg-paper-dim" role="img" aria-label={`${s.name}: ${fmtInt(s.boardings)} boardings`}>
            <div
              className="h-full rounded-md bg-[#33567d]"
              style={{ width: `${(s.boardings / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-sm tabular-nums text-ink-soft">{fmtInt(s.boardings)}</span>
        </div>
      ))}
    </figure>
  );
}

/** Catchment matrix: origin municipality × station, dot area ∝ boardings. */
export function CatchmentMatrix({ file }: { file: TransitStoryFile }) {
  const max = Math.max(
    ...file.catchment.flatMap((c) => Object.values(c.origins)),
    1,
  );
  const muniNames: Record<string, string> = {
    brock: "Brock",
    uxbridge: "Uxbridge",
    scugog: "Scugog",
    pickering: "Pickering",
    ajax: "Ajax",
    whitby: "Whitby",
    oshawa: "Oshawa",
    clarington: "Clarington",
  };
  const munis = Object.keys(muniNames);
  return (
    <figure className="overflow-x-auto">
      <table className="w-full min-w-[430px] border-collapse text-sm">
        <caption className="sr-only">
          GO boardings by origin municipality: each row is where riders come from, each column a station
        </caption>
        <thead>
          <tr>
            <th scope="col" className="py-2 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              From
            </th>
            {file.catchment.map((c) => (
              <th key={c.id} scope="col" className="px-1 py-2 text-center text-xs font-semibold text-ink-soft">
                {c.name.replace(" GO", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {munis.map((m) => (
            <tr key={m} className="border-t border-line">
              <th scope="row" className="py-2 pr-2 text-left text-xs font-medium text-ink-soft">
                {muniNames[m]}
              </th>
              {file.catchment.map((c) => {
                const v = c.origins[m] ?? 0;
                const r = 2 + 12 * Math.sqrt(v / max);
                return (
                  <td key={c.id} className="px-1 py-2 text-center">
                    {v > 0 ? (
                      <span
                        className="mx-auto block rounded-full"
                        style={{
                          width: r * 2,
                          height: r * 2,
                          background: v === max ? "#c2502e" : "#33567d",
                          opacity: 0.25 + 0.75 * Math.sqrt(v / max),
                        }}
                        title={`${muniNames[m]} → ${c.name}: ${fmtInt(v)} boardings`}
                      />
                    ) : (
                      <span className="text-ink-faint/60" aria-label="none">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="mt-3 text-xs leading-relaxed text-ink-faint">
        Dot area is proportional to boardings originating in each municipality (aggregate geography — the
        survey never records exact homes). North Durham is nearly absent: GO rail does not reach it.
      </figcaption>
    </figure>
  );
}

/** Where GO journeys end: proportional bars, Union highlighted but not dominant. */
export function DestinationBars({ file }: { file: TransitStoryFile }) {
  const dist = getGoDestinationDistribution(file);
  const top = dist.slice(0, 9);
  const rest = dist.slice(9).reduce((a, d) => a + d.trips, 0);
  const max = Math.max(...top.map((d) => d.trips));
  return (
    <figure className="space-y-2.5">
      {top.map((d) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className={`w-28 shrink-0 truncate text-sm ${d.name === "Union GO" ? "font-semibold text-ink" : "text-ink-soft"}`}>
            {d.name.replace(" GO", "")}
          </span>
          <div className="h-6 flex-1 rounded bg-paper-dim" role="img" aria-label={`${d.name}: ${fmtInt(d.trips)} alightings, ${fmtPct(d.share, 0)}`}>
            <div
              className="h-full rounded"
              style={{
                width: `${(d.trips / max) * 100}%`,
                background: d.name === "Union GO" ? "#c2502e" : d.name.endsWith("GO") && ["Whitby", "Oshawa", "Ajax", "Pickering"].some((s) => d.name.startsWith(s)) ? "#00857a" : "#a3bfd6",
              }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-ink-soft">
            {fmtCompact(d.trips)} · {fmtPct(d.share, 0)}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-sm text-ink-soft">22 others</span>
        <div className="h-6 flex-1 rounded bg-paper-dim" role="img" aria-label={`All other destinations: ${fmtInt(rest)} alightings`}>
          <div className="h-full rounded bg-[#a3bfd6]" style={{ width: `${(rest / max) * 100}%` }} />
        </div>
        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-ink-soft">{fmtCompact(rest)} · {fmtPct(rest / dist.reduce((a, d) => a + d.trips, 0), 0)}</span>
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-ink-faint">
        Alighting stations of all GO journeys by Durham residents. Union (rust) is the single biggest —
        but the green bars are Durham&apos;s own stations: the return legs home.
      </figcaption>
    </figure>
  );
}

/** Station-to-station pairs with real sample support, both directions. */
export function StationPairs({ file }: { file: TransitStoryFile }) {
  const pairs = getSupportedStationPairs(file).slice(0, 8);
  const max = Math.max(...pairs.map((p) => p.trips));
  return (
    <figure className="space-y-2.5">
      {pairs.map((p) => {
        const durhamToUnion = ["Pickering", "Ajax", "Whitby", "Oshawa"].some((s) => p.from.startsWith(s));
        return (
          <div key={`${p.from}-${p.to}`} className="flex items-center gap-3">
            <span className="w-36 shrink-0 truncate text-right text-xs text-ink-soft">
              {p.from.replace(" GO", "")} <span aria-hidden>→</span> {p.to.replace(" GO", "")}
            </span>
            <div className="h-5 flex-1 rounded bg-paper-dim" role="img" aria-label={`${p.from} to ${p.to}: ${fmtInt(p.trips)} trips on ${p.surveyRecords} survey records`}>
              <div
                className="h-full rounded"
                style={{ width: `${(p.trips / max) * 100}%`, background: durhamToUnion ? "#00857a" : "#33567d" }}
              />
            </div>
            <span className="w-28 shrink-0 text-xs tabular-nums text-ink-soft">
              {fmtInt(p.trips)} <span className="text-ink-faint">({p.surveyRecords} rec)</span>
            </span>
          </div>
        );
      })}
      <figcaption className="mt-3 text-xs leading-relaxed text-ink-faint">
        Only pairs resting on at least 4 survey records are shown — the whole station matrix rests on
        2,158 records, so small cells are hidden rather than guessed. Teal = Durham boarding; blue = the
        return leg from Union.
      </figcaption>
    </figure>
  );
}

/** 1 / 2 / 3+ transit links, GO vs local journeys. */
export function LinkStacks({ file }: { file: TransitStoryFile }) {
  const rows: { label: string; buckets: Record<"1" | "2" | "3+", number>; total: number }[] = [
    { label: "GO journeys", buckets: file.links.go.byBucket, total: file.links.go.total },
    { label: "Local transit journeys", buckets: file.links.nonGo.byBucket, total: file.links.nonGo.total },
  ];
  const colors: Record<"1" | "2" | "3+", string> = { "1": "#00857a", "2": "#33567d", "3+": "#a3bfd6" };
  const labels: Record<"1" | "2" | "3+", string> = { "1": "One link", "2": "Two links", "3+": "3+ links" };
  return (
    <figure className="space-y-5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex h-10 w-full overflow-hidden rounded-lg border border-line" role="img" aria-label={`${r.label}: ${(["1", "2", "3+"] as const).map((k) => `${labels[k]} ${fmtPct(r.buckets[k]! / r.total, 0)}`).join(", ")}`}>
            {(["1", "2", "3+"] as const).map((k) => (
              <div
                key={k}
                className="flex h-full items-center justify-center"
                style={{ width: `${(r.buckets[k]! / r.total) * 100}%`, background: colors[k] }}
              >
                <span className="text-xs font-semibold text-paper">{fmtPct(r.buckets[k]! / r.total, 0)}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            {r.label} · <span className="tabular-nums">{fmtInt(r.total)}</span> journeys
          </p>
        </div>
      ))}
      <figcaption className="flex flex-wrap gap-x-5 text-xs text-ink-soft">
        {(["1", "2", "3+"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[k] }} />
            {labels[k]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
