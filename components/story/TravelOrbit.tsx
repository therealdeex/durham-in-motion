"use client";

import { useEffect, useMemo, useState } from "react";
import { arcPath, type MapGeom } from "@/lib/od-map";
import { fmtInt, fmtPct } from "@/lib/format";
import type { OdFlows, OdModeGroup, OdMunicipalityProfile } from "@/lib/types";

const ORBIT_SEGMENTS = [
  { key: "same" as const, label: "Inside this municipality", color: "#f5b043" },
  { key: "durham" as const, label: "Elsewhere in Durham", color: "#00857a" },
  { key: "toronto" as const, label: "Toronto", color: "#c2502e" },
  { key: "outside" as const, label: "Beyond the region", color: "#98938a" },
];

const MODE_COLOR: Record<OdModeGroup, string> = {
  drive: "var(--color-auto-driver)",
  ride: "var(--color-auto-passenger)",
  transit: "var(--color-transit)",
  walk: "var(--color-walk)",
  cycle: "var(--color-bicycle)",
  schoolBus: "var(--color-school-bus)",
  other: "var(--color-other-misc)",
};
const MODE_LABEL: Record<OdModeGroup, string> = {
  drive: "Drive",
  ride: "Ride",
  transit: "Transit",
  walk: "Walk",
  cycle: "Cycle",
  schoolBus: "School bus",
  other: "Other",
};

/**
 * Chapter — “Choose your community”. Each municipality's travel orbit:
 * where its trips go and how they are made. Selection is shareable via
 * ?place=<id> (URL updated in place; works on the static export).
 */
export function TravelOrbit({ geom, profiles }: { geom: MapGeom; profiles: OdMunicipalityProfile[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("place");
    if (fromUrl && profiles.some((p) => p.id === fromUrl)) setSelected(fromUrl);
  }, [profiles]);

  const select = (id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("place", id);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url.toString());
  };

  const maxOrigin = Math.max(...profiles.map((p) => p.originTrips));
  const mostTorontoOriented = useMemo(
    () => [...profiles].sort((a, b) => b.orbitShares.toronto - a.orbitShares.toronto)[0]!,
    [profiles],
  );

  const profile = profiles.find((p) => p.id === selected) ?? null;

  return (
    <div>
      {/* community picker */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Choose a community">
        {profiles.map((p) => {
          const isActive = p.id === selected;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => select(isActive ? null : p.id)}
              aria-pressed={isActive}
              className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper hover:border-ink"
              }`}
            >
              <span className="block font-display text-lg leading-tight">{p.name}</span>
              <span className={`text-xs ${isActive ? "text-paper/70" : "text-ink-faint"}`}>
                {fmtInt(p.originTrips)} trips a day
              </span>
              <span aria-hidden className="mt-2 block h-1 w-full rounded bg-night-line/20">
                <span
                  className="block h-1 rounded bg-accent"
                  style={{ width: `${Math.max(8, (p.originTrips / maxOrigin) * 100)}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* profile panel */}
      {profile ? (
        <div className="mt-8 grid gap-8 rounded-xl border border-line bg-paper-dim/60 p-5 md:p-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div>
            <h3 className="font-display text-3xl font-semibold text-ink">
              {profile.name}&apos;s travel orbit
            </h3>
            <p className="prose-story mt-3">{orbitSentence(profile, mostTorontoOriented)}</p>

            <div
              className="mt-5 flex h-9 w-full overflow-hidden rounded-md"
              role="img"
              aria-label={`Destinations of weekday trips beginning in ${profile.name}: ${ORBIT_SEGMENTS.map(
                (s) => `${s.label} ${fmtPct(profile.orbitShares[s.key])}`,
              ).join(", ")}.`}
            >
              {ORBIT_SEGMENTS.map((s) => {
                const w = profile.orbitShares[s.key] * 100;
                if (w === 0) return null;
                return (
                  <div
                    key={s.key}
                    className="h-full transition-[width] duration-500"
                    style={{ width: `${w}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${fmtPct(profile.orbitShares[s.key])}`}
                  />
                );
              })}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-soft">
              {ORBIT_SEGMENTS.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{fmtPct(profile.orbitShares[s.key], 0)}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
              How those trips are made
            </p>
            <div className="mt-2 flex h-5 w-full overflow-hidden rounded" aria-hidden>
              {(Object.keys(MODE_LABEL) as OdModeGroup[]).map((g) => {
                const w = profile.modeGroupShares[g] * 100;
                return w === 0 ? null : (
                  <div key={g} className="h-full transition-[width] duration-500" style={{ width: `${w}%`, backgroundColor: MODE_COLOR[g]! }} />
                );
              })}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
              {(Object.keys(MODE_LABEL) as OdModeGroup[]).map((g) => (
                <li key={g} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: MODE_COLOR[g]! }} />
                  {MODE_LABEL[g]!} {fmtPct(profile.modeGroupShares[g], 0)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Where trips from {profile.name} go
            </p>
            <ol className="mt-3 space-y-2.5">
              {profile.topDestinations.slice(0, 6).map((d) => {
                const max = profile.topDestinations[0]!.trips;
                return (
                  <li key={d.destinationId} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-ink">{d.destinationName}</span>
                      <span className="tabular-nums text-ink-soft">
                        {fmtInt(d.trips)} · {fmtPct(d.share, 0)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-line/60">
                      <div
                        className="h-1.5 rounded transition-[width] duration-500"
                        style={{
                          width: `${Math.max(2, (d.trips / max) * 100)}%`,
                          backgroundColor:
                            d.group === "toronto" ? "#c2502e" : d.group === "outside" ? "#98938a" : "#00857a",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Connections show where trips begin and end, not the roads used. Flows below 1,000
              weekday trips are omitted for readability. People from elsewhere travel into{" "}
              {profile.name} too: {fmtInt(profile.destinationTrips)} trips arrive here on an average
              weekday.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-line px-5 py-8 text-center text-ink-soft">
          Pick a community to see its travel orbit — or share a link like{" "}
          <code className="rounded bg-paper-dim px-1.5 py-0.5 text-xs">?place=whitby</code>
        </p>
      )}

      {/* mini map with selection */}
      <div className="mt-8" aria-hidden>
        <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="mx-auto w-full max-w-[300px] opacity-90">
          <path d={geom.outlinePath} fill="#f1ece2" stroke="#c9c0b0" strokeWidth="1.4" />
          {geom.municipalities.map((m) => {
            const p = profiles.find((x) => x.id === m.id);
            const isSel = p?.id === selected;
            return (
              <g key={m.id} className="cursor-pointer" onClick={() => select(isSel ? null : m.id)}>
                <path
                  d={m.path}
                  fill={isSel ? "#f5b04366" : "transparent"}
                  stroke={isSel ? "#c2502e" : "#b9b09e"}
                  strokeWidth={isSel ? 2 : 1}
                />
                <circle cx={m.cx} cy={m.cy} r={isSel ? 4 : 2.4} fill={isSel ? "#c2502e" : "#8a9099"} />
              </g>
            );
          })}
          {profile &&
            geom.municipalities
              .filter((m) => m.id !== profile.id)
              .map((m) => (
                <path
                  key={`arc-${m.id}`}
                  d={arcPath(
                    geom.municipalities.find((x) => x.id === profile.id)!.cx,
                    geom.municipalities.find((x) => x.id === profile.id)!.cy,
                    m.cx,
                    m.cy,
                    0.15,
                  )}
                  fill="none"
                  stroke="#00857a"
                  strokeWidth={1 + 2.4 * Math.sqrt(interiorTrips(profile, m.id) / Math.max(1, profile.originTrips))}
                  strokeOpacity="0.5"
                />
              ))}
          {profile && (
            <path
              d={arcPath(
                geom.municipalities.find((x) => x.id === profile.id)!.cx,
                geom.municipalities.find((x) => x.id === profile.id)!.cy,
                geom.toronto.x,
                geom.toronto.y,
                0.2,
              )}
              fill="none"
              stroke="#c2502e"
              strokeWidth={1 + 3 * Math.sqrt(profile.toronto / Math.max(1, profile.originTrips))}
              strokeOpacity="0.6"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

function interiorTrips(profile: OdMunicipalityProfile, muniId: string): number {
  const d = profile.topDestinations.find((x) => x.destinationId === muniId);
  return d?.trips ?? 0;
}

/** Deterministic narrative from computed data — every clause is checked. */
function orbitSentence(profile: OdMunicipalityProfile, mostTorontoOriented: OdMunicipalityProfile): string {
  const stayDurham = profile.orbitShares.same + profile.orbitShares.durham;
  const stayWord = stayDurham >= 0.9 ? "Nearly nine in ten" : stayDurham >= 0.8 ? "Around nine in ten" : stayDurham >= 0.7 ? "About seven in ten" : "Just over half";
  const sentences: string[] = [];
  sentences.push(
    `${stayWord} of the weekday trips that begin in ${profile.name} stay somewhere in Durham Region (${fmtPct(stayDurham, 0)}).`,
  );

  const strongest = profile.topDestinations.find((d) => d.group !== "same");
  if (strongest) {
    const withinDurham = strongest.group === "durham";
    sentences.push(
      withinDurham
        ? `Its strongest single connection is ${strongest.destinationName} — about ${fmtInt(strongest.trips)} weekday trips head there.`
        : `Its busiest single destination is ${strongest.destinationName}, drawing about ${fmtInt(strongest.trips)} trips a day.`,
    );
  }

  if (profile.id === mostTorontoOriented.id && profile.orbitShares.toronto >= 0.08) {
    sentences.push(
      `Of the eight communities, ${profile.name} is the most Toronto-oriented: ${fmtPct(profile.orbitShares.toronto, 0)} of its trips head there.`,
    );
  } else if (profile.orbitShares.toronto <= 0.04) {
    sentences.push(`Toronto draws only ${fmtPct(profile.orbitShares.toronto, 0)} of its trips.`);
  }

  if (profile.orbitShares.same >= 0.6) {
    sentences.push(`And most days, ${profile.name} mostly travels within itself: ${fmtPct(profile.orbitShares.same, 0)} of trips never leave the municipality.`);
  }
  return sentences.join(" ");
}
