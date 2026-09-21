"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtPct, fmtShare, fmtX, fmtInt } from "@/lib/format";
import type { Profile, WardsFile } from "@/lib/types";

interface PlaceOption {
  id: string;
  name: string;
  kind: "municipality" | "ward";
  municipality?: string;
}

/**
 * Chapter 4 — Your Durham. A profile "postcard" for any ward or
 * municipality. URL state: ?place=<id>
 */
export function CommunityFinder({
  region,
  municipalities,
  wards,
}: {
  region: Profile;
  municipalities: Profile[];
  wards: WardsFile["wards"];
}) {
  const router = useRouter();
  const all: PlaceOption[] = useMemo(
    () => [
      ...municipalities.map((m) => ({ id: m.geographyId, name: m.geographyName, kind: "municipality" as const })),
      ...wards
        .slice()
        .sort((a, b) => a.geographyName.localeCompare(b.geographyName))
        .map((w) => ({ id: w.geographyId, name: w.geographyName, kind: "ward" as const, municipality: w.municipality })),
    ],
    [municipalities, wards],
  );

  const [placeId, setPlaceId] = useState<string>("ajax");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("place");
    if (p && all.some((x) => x.id === p)) setPlaceId(p);
  }, [all]);

  const select = (id: string) => {
    setPlaceId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("place", id);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  };

  const profile = useMemo(() => {
    if (placeId === "durham") return region;
    return [...municipalities, ...wards].find((p) => p.geographyId === placeId) ?? null;
  }, [placeId, municipalities, wards, region]);

  const grouped = useMemo(() => {
    const byMun = new Map<string, PlaceOption[]>();
    for (const w of all.filter((x) => x.kind === "ward")) {
      const key = w.municipality ?? "other";
      byMun.set(key, [...(byMun.get(key) ?? []), w]);
    }
    return byMun;
  }, [all]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      <div>
        <label htmlFor="place-select" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
          Choose your community
        </label>
        <select
          id="place-select"
          value={placeId}
          onChange={(e) => select(e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-4 py-3 text-base font-medium text-ink shadow-sm"
        >
          <optgroup label="Area municipalities">
            <option value="durham">Durham Region overall</option>
            {municipalities.map((m) => (
              <option key={m.geographyId} value={m.geographyId}>
                {m.geographyName}
              </option>
            ))}
          </optgroup>
          {[...grouped.entries()].map(([mun, wardsInMun]) => (
            <optgroup key={mun} label={wardsInMun[0]?.name.split(" Ward")[0] ?? mun}>
              {wardsInMun.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Ward-level figures come from the 2022 survey; several small categories are suppressed. Share
          this card with the link in your browser — it points here directly.
        </p>
      </div>

      {profile && <Postcard profile={profile} region={region} />}
    </div>
  );
}

function Postcard({ profile, region }: { profile: Profile; region: Profile }) {
  const isRegion = profile.geographyId === "durham";
  const modeRows = [
    { label: "Car driver", share: profile.modeShares.autoDriver, regionShare: region.modeShares.autoDriver, color: "var(--color-auto-driver)" },
    { label: "Car passenger", share: profile.modeShares.autoPassenger, regionShare: region.modeShares.autoPassenger, color: "var(--color-auto-passenger)" },
    { label: "Transit", share: profile.modeShares.transit, regionShare: region.modeShares.transit, color: "var(--color-transit)" },
    { label: "Walking", share: profile.modeShares.walk, regionShare: region.modeShares.walk, color: "var(--color-walk)" },
    { label: "Cycling", share: profile.modeShares.bicycle, regionShare: region.modeShares.bicycle, color: "var(--color-bicycle)" },
    { label: "School bus", share: profile.modeShares.schoolBus, regionShare: region.modeShares.schoolBus, color: "var(--color-school-bus)" },
  ];

  return (
    <article className="rounded-2xl border border-line bg-white p-6 shadow-[0_1px_0_rgba(28,32,36,0.06),0_12px_40px_-24px_rgba(28,32,36,0.35)] md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
        <div>
          <h3 className="font-display text-3xl font-semibold text-ink">{profile.geographyName}</h3>
          <p className="mt-1 text-xs text-ink-faint">
            {isRegion ? "The region overall" : profile.geographyType === "ward" ? "Community (ward)" : "Area municipality"} ·{" "}
            {fmtInt(profile.persons)} residents · {fmtInt(profile.households)} households · 2022 survey
          </p>
        </div>
        <p className="font-display text-lg text-ink-soft">{fmtInt(profile.tripsTotal)} weekday trips</p>
      </header>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <section aria-label="How people travel here">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">How people move</h4>
          <ul className="mt-3 space-y-2.5">
            {modeRows.map((row) => (
              <li key={row.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-ink">{row.label}</span>
                  <span className="text-ink-soft">
                    {fmtShare(row.share)}
                    {row.share.value !== null && (
                      <span className="ml-1.5 text-xs text-ink-faint">vs {fmtPct(row.regionShare.value)} region</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-dim">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${(row.share.value ?? 0) * 100}%`, backgroundColor: row.color, maxWidth: "100%" }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {profile.modeSuppressed && (
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              Some categories here were suppressed (fewer than four survey records) and are excluded from bars.
            </p>
          )}
        </section>

        <section aria-label="Household life" className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">Household life</h4>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Vehicles / household" value={profile.avgVehiclesPerHousehold === null ? "suppressed" : fmtX(profile.avgVehiclesPerHousehold)} />
            <Stat label="No-vehicle households" value={fmtShare(profile.zeroVehicleHouseholdShare)} />
            <Stat label="Work at home" value={fmtShare(profile.workAtHomeShare)} />
            <Stat label="Commute to Toronto" value={fmtShare(profile.torontoWorkShare, 0)} />
            <Stat label="Population 65+" value={fmtShare(profile.seniorsShare)} />
            <Stat label="Licensed drivers" value={fmtInt(profile.drivers)} />
          </dl>
          <p className="text-xs leading-relaxed text-ink-faint">
            ≈ marks approximate values: a small category (under four survey records) is excluded.
          </p>
        </section>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-display text-xl text-ink">{value}</dd>
    </div>
  );
}
