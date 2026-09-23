"use client";

import { useMemo } from "react";
import { arcPath, type MapGeom } from "@/lib/od-map";
import { fmtInt, fmtPct } from "@/lib/format";
import { OD_MODE_LABEL } from "@/lib/metrics";
import type {
  OdMunicipalityProfile,
  OdRegionProfile,
  OdDestinationFlow,
  OdModeGroup,
} from "@/lib/types";
import type { PlaceSelection } from "@/lib/place-state";

const SEGMENTS = [
  { key: "same" as const, label: "Inside this municipality", color: "#f5b043" },
  { key: "durham" as const, label: "Elsewhere in Durham", color: "#00857a" },
  { key: "toronto" as const, label: "Toronto", color: "#c2502e" },
  { key: "outside" as const, label: "Beyond Durham and Toronto", color: "#98938a" },
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

/**
 * Destination panel of the community explorer. Population scope is explicit:
 * these are weekday trips ORIGINATING in the selected municipality made by
 * members of Durham households. The display floor (from od metadata) is
 * actually enforced on the visible list, the hidden-connection count is
 * shown, and the mini-map arcs use the complete distribution — never a
 * truncated slice (audit A02/A08).
 */
export function OrbitPanel({
  geom,
  selection,
  regionOd,
  municipalityOd,
  wardParentName,
  displayFloor,
}: {
  geom: MapGeom;
  selection: PlaceSelection | null;
  regionOd: OdRegionProfile;
  municipalityOd: OdMunicipalityProfile | null;
  wardParentName: string | null;
  displayFloor: number;
}) {
  if (!selection) {
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-ink-soft">
        Pick a community to see where its weekday trips go.
      </p>
    );
  }

  if (selection.kind === "ward") {
    if (!municipalityOd || !wardParentName) {
      return (
        <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-ink-soft">
          Destination detail is published at the municipality level, not for individual wards.
        </p>
      );
    }
    return (
      <div>
        <p className="mb-4 rounded-lg border border-line bg-paper-dim/60 px-4 py-2.5 text-sm text-ink-soft">
          The travel survey publishes origin–destination detail for municipalities, not wards —
          showing <strong className="text-ink">{wardParentName}</strong>, the municipality that
          contains {selection.id.replace(/-ward-\d+$/, "").replace(/^\w/, (c) => c.toUpperCase())}{" "}
          Ward {selection.id.match(/-ward-(\d+)$/)?.[1]}.
        </p>
        <OrbitContent geom={geom} profile={municipalityOd} displayFloor={displayFloor} />
      </div>
    );
  }

  if (selection.kind === "region") {
    return (
      <div>
        <p className="mb-4 rounded-lg border border-line bg-paper-dim/60 px-4 py-2.5 text-sm text-ink-soft">
          Showing the whole region: where weekday trips that <strong className="text-ink">start in Durham</strong>{" "}
          go. (All figures are trips by members of Durham households.)
        </p>
        <RegionOrbitContent regionOd={regionOd} displayFloor={displayFloor} />
      </div>
    );
  }

  if (!municipalityOd) {
    return (
      <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-ink-soft">
        Destination detail is unavailable for this community.
      </p>
    );
  }
  return <OrbitContent geom={geom} profile={municipalityOd} displayFloor={displayFloor} />;
}

/** Municipal-level orbit: composition, ranked destination list, mini-map. */
function OrbitContent({
  geom,
  profile,
  displayFloor,
}: {
  geom: MapGeom;
  profile: OdMunicipalityProfile;
  displayFloor: number;
}) {
  const shares = profile.orbitShares;
  const stayDurham = shares.same + shares.durham;

  // The visible list enforces the published display floor; the hidden count
  // is stated. Totals and shares always use the complete distribution.
  const visible = useMemo(
    () => profile.destinations.filter((d) => d.trips >= displayFloor).slice(0, 6),
    [profile.destinations, displayFloor],
  );
  const hiddenCount = useMemo(
    () => profile.destinations.filter((d) => d.trips < displayFloor).length,
    [profile.destinations, displayFloor],
  );

  const sentences: string[] = [
    `${fmtPct(stayDurham, 0)} of the weekday trips that begin in ${profile.name} stay somewhere in Durham Region.`,
  ];
  const strongest = profile.destinations.find((d) => d.group !== "same" && d.trips >= displayFloor);
  if (strongest) {
    sentences.push(
      `Its strongest single connection is ${strongest.destinationName} — about ${fmtInt(strongest.trips)} weekday trips head there.`,
    );
  }
  if (shares.toronto >= 0.08) {
    sentences.push(`Toronto draws ${fmtPct(shares.toronto, 0)} of its trips.`);
  } else if (shares.toronto <= 0.04) {
    sentences.push(`Toronto draws only ${fmtPct(shares.toronto, 0)} of its trips.`);
  }

  const maxVisible = visible[0]?.trips ?? 1;
  const originGeom = geom.municipalities.find((m) => m.id === profile.id);

  return (
    <div className="grid gap-8 rounded-xl border border-line bg-paper-dim/40 p-5 md:p-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <h4 className="font-display text-3xl font-semibold text-ink">{profile.name}&apos;s travel orbit</h4>
        <p className="prose-story mt-3 text-ink-soft">{sentences.join(" ")}</p>

        <div
          className="mt-5 flex h-9 w-full overflow-hidden rounded-md"
          role="img"
          aria-label={`Destinations of weekday trips beginning in ${profile.name}: ${SEGMENTS.map(
            (s) => `${s.label} ${fmtPct(shares[s.key], 0)}`,
          ).join(", ")}.`}
        >
          {SEGMENTS.map((s) => {
            const w = shares[s.key] * 100;
            if (w === 0) return null;
            return (
              <div
                key={s.key}
                className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${w}%`, backgroundColor: s.color }}
                title={`${s.label}: ${fmtPct(shares[s.key])}`}
              />
            );
          })}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums text-ink">{fmtPct(shares[s.key], 0)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
          How those trips are made
        </p>
        <div className="mt-2 flex h-5 w-full overflow-hidden rounded" aria-hidden>
          {(Object.keys(OD_MODE_LABEL) as OdModeGroup[]).map((g) => {
            const w = profile.modeGroupShares[g] * 100;
            return w === 0 ? null : (
              <div
                key={g}
                className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${w}%`, backgroundColor: MODE_COLOR[g]! }}
              />
            );
          })}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
          {(Object.keys(OD_MODE_LABEL) as OdModeGroup[]).map((g) => (
            <li key={g} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: MODE_COLOR[g]! }} />
              {OD_MODE_LABEL[g]} {fmtPct(profile.modeGroupShares[g], 0)}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
          Where trips from {profile.name} go
        </p>
        <ol className="mt-3 space-y-2.5">
          {visible.map((d: OdDestinationFlow) => (
            <li key={d.destinationId} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-ink">{d.destinationName}</span>
                <span className="tabular-nums text-ink-soft">
                  {fmtInt(d.trips)} · {fmtPct(d.share, 1)}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded bg-line/60">
                <div
                  className="h-1.5 rounded transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${Math.max(2, (d.trips / maxVisible) * 100)}%`,
                    backgroundColor:
                      d.group === "toronto" ? "#c2502e" : d.group === "outside" ? "#98938a" : "#00857a",
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Connections show where trips begin and end, not the roads used. Destinations below{" "}
          {fmtInt(displayFloor)} weekday trips are hidden for readability
          {hiddenCount > 0 ? ` (${hiddenCount} smaller connection${hiddenCount === 1 ? "" : "s"} not listed; every total and share includes them)` : ""}.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Trips also arrive in {profile.name}: {fmtInt(profile.destinationTrips)} weekday trips by
          members of Durham households end here — including trips that started elsewhere in Durham.
          This extract does not count visitors from outside Durham households.
        </p>

        {/* mini map — arcs sized from the complete distribution */}
        <div className="mt-5" aria-hidden>
          <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="mx-auto w-full max-w-[300px] opacity-90">
            <path d={geom.outlinePath} fill="#f1ece2" stroke="#c9c0b0" strokeWidth="1.4" />
            {geom.municipalities.map((m) => {
              const isSel = m.id === profile.id;
              return (
                <g key={m.id}>
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
            {originGeom &&
              geom.municipalities
                .filter((m) => m.id !== profile.id)
                .map((m) => {
                  const trips =
                    profile.destinations.find((x) => x.destinationId === m.id)?.trips ?? 0;
                  return (
                    <path
                      key={`arc-${m.id}`}
                      d={arcPath(originGeom.cx, originGeom.cy, m.cx, m.cy, 0.15)}
                      fill="none"
                      stroke="#00857a"
                      strokeWidth={1 + 2.4 * Math.sqrt(trips / Math.max(1, profile.originTrips))}
                      strokeOpacity={trips > 0 ? 0.5 : 0}
                    />
                  );
                })}
            {originGeom && (
              <path
                d={arcPath(originGeom.cx, originGeom.cy, geom.toronto.x, geom.toronto.y, 0.2)}
                fill="none"
                stroke="#c2502e"
                strokeWidth={1 + 3 * Math.sqrt(profile.toronto / Math.max(1, profile.originTrips))}
                strokeOpacity="0.6"
              />
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Region-level orbit content (origin-scoped shares). */
function RegionOrbitContent({ regionOd, displayFloor }: { regionOd: OdRegionProfile; displayFloor: number }) {
  const shares = regionOd.orbitShares;
  const visible = regionOd.destinations.filter((d) => d.trips >= displayFloor).slice(0, 8);
  const hiddenCount = regionOd.destinations.filter((d) => d.trips < displayFloor).length;
  const maxVisible = visible[0]?.trips ?? 1;
  return (
    <div className="grid gap-8 rounded-xl border border-line bg-paper-dim/40 p-5 md:p-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <h4 className="font-display text-3xl font-semibold text-ink">Durham Region&apos;s travel orbit</h4>
        <p className="prose-story mt-3 text-ink-soft">
          {fmtPct(shares.same + shares.durham, 0)} of weekday trips starting in Durham stay inside
          the region: {fmtPct(shares.same, 0)} never leave their own municipality and{" "}
          {fmtPct(shares.durham, 0)} cross a municipal boundary inside Durham. Toronto draws{" "}
          {fmtPct(shares.toronto, 1)}.
        </p>
        <div
          className="mt-5 flex h-9 w-full overflow-hidden rounded-md"
          role="img"
          aria-label={`Destinations of weekday trips beginning in Durham: ${SEGMENTS.map(
            (s) => `${s.label} ${fmtPct(shares[s.key], 0)}`,
          ).join(", ")}.`}
        >
          {SEGMENTS.map((s) => {
            const w = shares[s.key] * 100;
            if (w === 0) return null;
            return (
              <div key={s.key} className="h-full" style={{ width: `${w}%`, backgroundColor: s.color }} />
            );
          })}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums text-ink">{fmtPct(shares[s.key], 0)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
          Where trips starting in Durham go
        </p>
        <ol className="mt-3 space-y-2.5">
          {visible.map((d) => (
            <li key={d.destinationId} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-ink">{d.destinationName}</span>
                <span className="tabular-nums text-ink-soft">{fmtInt(d.trips)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded bg-line/60">
                <div
                  className="h-1.5 rounded"
                  style={{
                    width: `${Math.max(2, (d.trips / maxVisible) * 100)}%`,
                    backgroundColor:
                      d.group === "toronto" ? "#c2502e" : d.group === "outside" ? "#98938a" : "#00857a",
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Complete aggregated distribution; destinations below {fmtInt(displayFloor)} weekday trips
          are hidden from the list ({hiddenCount} smaller connections; totals include them).
        </p>
      </div>
    </div>
  );
}
